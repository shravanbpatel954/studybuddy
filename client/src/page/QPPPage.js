import React, { useState, useRef } from 'react';
import './QPPPage.css';
import api from '../services/api';
import useAuth from '../hooks/useAuth';

const QPPPage = () => {
  const { token } = useAuth();
  const [subject, setSubject] = useState('');
  const [unit, setUnit] = useState('');
  const [totalMarks, setTotalMarks] = useState(50);
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [instructions, setInstructions] = useState('');
  const [syllabusFiles, setSyllabusFiles] = useState([]);
  const [pastPapers, setPastPapers] = useState([]);
  const [generatedPaper, setGeneratedPaper] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [previousPaperText, setPreviousPaperText] = useState(''); // Store previous paper text for format extraction
  const abortControllerRef = useRef(null);

  const handleFileUpload = (e, type) => {
    const files = Array.from(e.target.files);
    if (type === 'syllabus') {
      setSyllabusFiles(files);
    } else {
      setPastPapers(files);
    }
  };

  const handleGenerate = async () => {
    if (!syllabusFiles || syllabusFiles.length === 0 || pastPapers.length === 0 || !subject) {
      setError('Please fill all required fields and upload at least one syllabus file and one previous year paper.');
      return;
    }

    setLoading(true);
    setError('');
    setStreamingText('');
    setGeneratedPaper(null);
    setProgress(0);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      // Prepare form data
      const formData = new FormData();
      // Append multiple syllabus files
      syllabusFiles.forEach((file) => {
        formData.append('syllabus', file);
      });
      // Append multiple previous papers
      pastPapers.forEach((file) => {
        formData.append('previousPapers', file);
      });
      formData.append('subject', subject);
      formData.append('unit', unit || 'All Units');
      formData.append('totalMarks', totalMarks.toString());
      formData.append('durationMinutes', durationMinutes.toString());
      formData.append('instructions', instructions);
      
      // Section configurations
      formData.append('sectionA', JSON.stringify({ numQuestions: 10, marksEach: 2 }));
      formData.append('sectionB', JSON.stringify({ numQuestions: 5, marksEach: 6 }));
      formData.append('sectionC', JSON.stringify({ numQuestions: 2, marksEach: 10 }));
      formData.append('difficultyDistribution', JSON.stringify({ easy: 40, medium: 40, hard: 20 }));

      // Make streaming request
      const apiBase = process.env.REACT_APP_API_BASE || 'https://studybuddy-backend-i649.onrender.com/api/v1';
      const response = await fetch(`${apiBase}/qpp/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      // Check if response is streaming (text/event-stream) or JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        // Non-streaming response - handle as JSON
        const data = await response.json();
        if (data.success && data.data) {
          setGeneratedPaper(data.data);
          setProgress(100);
        } else {
          throw new Error(data.error || 'Failed to generate question paper');
        }
        setLoading(false);
        return;
      }

      // Handle streaming response
      if (!response.body) {
        throw new Error('No response body received');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'start') {
                setProgress(10);
              } else if (data.type === 'chunk') {
                setStreamingText(prev => prev + data.content);
                setProgress(prev => Math.min(prev + 2, 90));
              } else if (data.type === 'complete') {
                if (data.data) {
                  setGeneratedPaper(data.data);
                  // Store previous paper text if available for format extraction
                  if (data.previousPaperText) {
                    setPreviousPaperText(data.previousPaperText);
                  }
                } else if (data.rawText) {
                  // Try to parse JSON from raw text
                  try {
                    let jsonText = data.rawText.trim();
                    if (jsonText.includes('```json')) {
                      jsonText = jsonText.split('```json')[1].split('```')[0].trim();
                    } else if (jsonText.includes('```')) {
                      jsonText = jsonText.split('```')[1].split('```')[0].trim();
                    }
                    const parsed = JSON.parse(jsonText);
                    setGeneratedPaper(parsed);
                    // Store previous paper text if available
                    if (data.previousPaperText) {
                      setPreviousPaperText(data.previousPaperText);
                    }
                  } catch (e) {
                    setStreamingText(data.rawText);
                  }
                }
                setProgress(100);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              } else if (data.type === 'end') {
                setProgress(100);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        setError('Generation cancelled');
      } else {
        setError(error.message || 'Failed to generate question paper');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
    setProgress(0);
  };

  const handleDownload = () => {
    if (!generatedPaper) return;

    const paperText = formatPaperForDownload(generatedPaper);
    const blob = new Blob([paperText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${subject}_Question_Paper_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async () => {
    if (!generatedPaper) return;

    try {
      const apiBase = process.env.REACT_APP_API_BASE || 'https://studybuddy-backend-i649.onrender.com/api/v1';
      const response = await fetch(`${apiBase}/qpp/download/pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paper: generatedPaper,
          previousPaperText: previousPaperText || '', // Pass previous paper text for format extraction
        }),
      });

      // Check content type first
      const contentType = response.headers.get('content-type') || '';
      
      if (!response.ok) {
        // Check if response is JSON before parsing
        let errorMessage = `Server error: ${response.status}`;
        
        if (contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch (e) {
            // If JSON parsing fails, try to get text
            const errorText = await response.text();
            if (errorText && !errorText.startsWith('<!DOCTYPE')) {
              errorMessage = errorText;
            }
          }
        } else {
          // Response is not JSON (likely HTML error page)
          const errorText = await response.text();
          if (errorText && errorText.includes('error')) {
            // Try to extract error message from HTML if possible
            const match = errorText.match(/error["\']?\s*[:=]\s*["\']?([^"\'<>]+)/i);
            if (match) {
              errorMessage = match[1];
            } else if (errorText.length < 500) {
              errorMessage = errorText;
            }
          }
        }
        throw new Error(errorMessage);
      }

      // Check if response is actually a PDF
      if (!contentType.includes('application/pdf')) {
        // Clone the response to read text without consuming the stream
        const clonedResponse = response.clone();
        const errorText = await clonedResponse.text();
        throw new Error(`Expected PDF but got ${contentType}. Server response: ${errorText.substring(0, 200)}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${subject || 'Question_Paper'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setError(`Failed to download PDF: ${error.message}`);
      console.error('PDF download error:', error);
    }
  };

  const handleDownloadWord = async () => {
    if (!generatedPaper) return;

    try {
      const apiBase = process.env.REACT_APP_API_BASE || 'https://studybuddy-backend-i649.onrender.com/api/v1';
      const response = await fetch(`${apiBase}/qpp/download/word`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paper: generatedPaper,
          previousPaperText: previousPaperText || '', // Pass previous paper text for format extraction
        }),
      });

      // Check content type first
      const contentType = response.headers.get('content-type') || '';
      
      if (!response.ok) {
        // Check if response is JSON before parsing
        let errorMessage = `Server error: ${response.status}`;
        
        if (contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch (e) {
            // If JSON parsing fails, try to get text
            const errorText = await response.text();
            if (errorText && !errorText.startsWith('<!DOCTYPE')) {
              errorMessage = errorText;
            }
          }
        } else {
          // Response is not JSON (likely HTML error page)
          const errorText = await response.text();
          if (errorText && errorText.includes('error')) {
            // Try to extract error message from HTML if possible
            const match = errorText.match(/error["\']?\s*[:=]\s*["\']?([^"\'<>]+)/i);
            if (match) {
              errorMessage = match[1];
            } else if (errorText.length < 500) {
              errorMessage = errorText;
            }
          }
        }
        throw new Error(errorMessage);
      }

      // Check if response is actually a Word document
      const expectedTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'];
      if (!expectedTypes.some(type => contentType.includes(type))) {
        // Clone the response to read text without consuming the stream
        const clonedResponse = response.clone();
        const errorText = await clonedResponse.text();
        throw new Error(`Expected Word document but got ${contentType}. Server response: ${errorText.substring(0, 200)}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${subject || 'Question_Paper'}_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setError(`Failed to download Word document: ${error.message}`);
      console.error('Word download error:', error);
    }
  };

  const formatPaperForDownload = (paper) => {
    let text = `\n${'='.repeat(80)}\n`;
    text += `${paper.paper_title || 'Question Paper'}\n`;
    text += `${'='.repeat(80)}\n\n`;
    text += `Subject: ${paper.subject || subject}\n`;
    text += `Unit: ${paper.unit || unit}\n`;
    text += `Duration: ${paper.duration_minutes || durationMinutes} minutes\n`;
    text += `Total Marks: ${paper.total_marks || totalMarks}\n\n`;
    
    if (paper.instructions) {
      text += `Instructions:\n${paper.instructions}\n\n`;
    }

    if (paper.sections) {
      paper.sections.forEach((section) => {
        text += `\n${'-'.repeat(80)}\n`;
        text += `${section.section_title || `Section ${section.section_name}`}\n`;
        text += `${'-'.repeat(80)}\n\n`;
        
        section.questions?.forEach((q) => {
          text += `Q${q.qno}. ${q.question} [${q.marks} marks]\n`;
          if (q.topic) text += `   Topic: ${q.topic}\n`;
          if (q.difficulty) text += `   Difficulty: ${q.difficulty}\n`;
          text += '\n';
        });
      });
    }

    return text;
  };

  return (
    <div className="qpp-page">
      <div className="qpp-container">
        <div className="qpp-header">
          <h1>AI Question Paper Generator</h1>
          <p>Generate high-quality question papers based on syllabus and previous year papers</p>
        </div>

        <div className="qpp-form-section">
          <div className="form-grid">
            <div className="form-group">
              <label>Subject *</label>
              <input
                type="text"
                placeholder="e.g., Computer Science, Mathematics"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Unit</label>
              <input
                type="text"
                placeholder="e.g., Unit 1, All Units"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Total Marks</label>
              <input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(parseInt(e.target.value) || 50)}
                disabled={loading}
                min="10"
                max="100"
              />
            </div>

            <div className="form-group">
              <label>Duration (minutes)</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 120)}
                disabled={loading}
                min="30"
                max="300"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Additional Instructions</label>
            <textarea
              placeholder="e.g., MCA, Mumbai University, All questions are compulsory"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={loading}
              rows="3"
            />
          </div>

          <div className="file-upload-section">
            <div className="file-upload-group">
              <label>
                <span className="upload-icon">📄</span>
                Upload Syllabus Files (PDF/DOCX/TXT) - Multiple files allowed *
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt"
                onChange={(e) => handleFileUpload(e, 'syllabus')}
                disabled={loading}
              />
              {syllabusFiles.length > 0 && (
                <div className="file-list">
                  {syllabusFiles.map((file, idx) => (
                    <span key={idx} className="file-name">{file.name}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="file-upload-group">
              <label>
                <span className="upload-icon">📚</span>
                Upload Previous Year Papers - Multiple files allowed *
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt"
                onChange={(e) => handleFileUpload(e, 'past')}
                disabled={loading}
              />
              {pastPapers.length > 0 && (
                <div className="file-list">
                  {pastPapers.map((file, idx) => (
                    <span key={idx} className="file-name">{file.name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="action-buttons">
            {loading ? (
              <>
                <button className="btn-cancel" onClick={handleCancel}>
                  Cancel
                </button>
                <div className="progress-container">
                  <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                  <span className="progress-text">{progress}%</span>
                </div>
              </>
            ) : (
              <button className="btn-generate" onClick={handleGenerate}>
                Generate Question Paper
              </button>
            )}
          </div>
        </div>

        {/* Streaming Output */}
        {loading && streamingText && (
          <div className="streaming-output">
            <h3>Generating...</h3>
            <pre>{streamingText}</pre>
          </div>
        )}

        {/* Generated Paper Display */}
        {generatedPaper && !loading && (
          <div className="generated-paper">
            <div className="paper-header">
              <h2>{generatedPaper.paper_title || 'Generated Question Paper'}</h2>
              <div className="download-buttons">
                <button className="btn-download btn-download-word" onClick={handleDownloadWord} title="Download as Word">
                  📝 Word
                </button>
                <button className="btn-download btn-download-txt" onClick={handleDownload} title="Download as Text">
                  📄 TXT
                </button>
              </div>
            </div>

            <div className="paper-info">
              <div className="info-item">
                <span className="info-label">Subject:</span>
                <span>{generatedPaper.subject || subject}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Unit:</span>
                <span>{generatedPaper.unit || unit}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Duration:</span>
                <span>{generatedPaper.duration_minutes || durationMinutes} minutes</span>
              </div>
              <div className="info-item">
                <span className="info-label">Total Marks:</span>
                <span>{generatedPaper.total_marks || totalMarks}</span>
              </div>
            </div>

            {generatedPaper.instructions && (
              <div className="paper-instructions">
                <h4>Instructions:</h4>
                <p>{generatedPaper.instructions}</p>
              </div>
            )}

            {generatedPaper.sections && generatedPaper.sections.map((section, idx) => (
              <div key={idx} className="paper-section">
                <h3>{section.section_title || `Section ${section.section_name}`}</h3>
                <p className="section-info">
                  {section.num_questions} questions × {section.marks_each} marks = {section.total_marks} marks
                </p>
                
                <div className="questions-list">
                  {section.questions && section.questions.map((q, qIdx) => (
                    <div key={qIdx} className="question-item">
                      <div className="question-header">
                        <span className="question-number">Q{q.qno}.</span>
                        <span className="question-marks">[{q.marks} marks]</span>
                        <span className={`question-difficulty ${q.difficulty}`}>
                          {q.difficulty}
                        </span>
                      </div>
                      <p className="question-text">{q.question}</p>
                      {q.topic && (
                        <div className="question-meta">
                          <span>Topic: {q.topic}</span>
                          {q.cognitive_level && <span>Level: {q.cognitive_level}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {generatedPaper.blueprint && (
              <div className="paper-blueprint">
                <h4>Question Paper Blueprint</h4>
                {generatedPaper.blueprint.topic_wise_marks && (
                  <div className="blueprint-section">
                    <h5>Topic-wise Marks Distribution:</h5>
                    <div className="blueprint-grid">
                      {Object.entries(generatedPaper.blueprint.topic_wise_marks).map(([topic, marks]) => (
                        <div key={topic} className="blueprint-item">
                          <span className="blueprint-topic">{topic}</span>
                          <span className="blueprint-marks">{marks} marks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QPPPage;
