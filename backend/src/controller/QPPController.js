const fileProcessor = require('../utils/fileProcessor');
const DocumentFormatter = require('../utils/documentFormatter');
const { generateText } = require('../utils/githubModelsClient');
const QPPPaper = require('../models/QPPPaper.models');

// Initialize GitHub Models API with QPP API key
// Try multiple possible variable names and formats
let QPP_API_KEY = null;

// Try different possible variable names (including GITHUB_PAT)
const possibleKeys = [
  'GITHUB_PAT',
  'QPP_data',
  'QPP_DATA', 
  'QPP_DATA_KEY',
  'GEMINI_QPP_KEY',
  'QPP_API_KEY',
  'QPPAPIKEY',
  'QPP_DATA_API_KEY',
  'GEMINI_API',
  'GEMINI_API_DOUBTSOLVER'
];

for (const key of possibleKeys) {
  if (process.env[key]) {
    QPP_API_KEY = process.env[key].trim();
    console.log(`QPP API key found using variable: ${key}`);
    break;
  }
}

// Also check for any env var that contains 'QPP' and 'data' or 'api' or 'key'
if (!QPP_API_KEY) {
  const allEnvKeys = Object.keys(process.env);
  const qppRelated = allEnvKeys.filter(k => {
    const upper = k.toUpperCase();
    return (upper.includes('QPP') && (upper.includes('DATA') || upper.includes('API') || upper.includes('KEY')));
  });
  
  if (qppRelated.length > 0) {
    console.log('Found potential QPP-related environment variables:', qppRelated);
    // Try the first one
    QPP_API_KEY = process.env[qppRelated[0]]?.trim();
    if (QPP_API_KEY) {
      console.log(`Using QPP API key from variable: ${qppRelated[0]}`);
    }
  }
}

if (!QPP_API_KEY) {
  console.error('⚠️  QPP API key not found in environment variables');
  console.error('Checked for:', possibleKeys.join(', '));
  const allQppKeys = Object.keys(process.env).filter(k => k.toUpperCase().includes('QPP') || k.toUpperCase().includes('GITHUB'));
  if (allQppKeys.length > 0) {
    console.error('Found QPP/GitHub-related env vars (but not matching expected format):', allQppKeys);
    console.error('Please ensure your .env file has: GITHUB_PAT=YOUR_API_KEY');
  } else {
    console.error('No QPP/GitHub-related environment variables found at all');
    console.error('Please add to your .env file: GITHUB_PAT=your_github_pat_token');
  }
} else {
  console.log('✅ QPP API key loaded successfully (length:', QPP_API_KEY.length, ')');
}

/**
 * Build an excellent prompt for question paper generation
 */
function buildQPPPrompt({ syllabusText, previousPapersText, settings }) {
  const {
    subject = 'Computer Science',
    unit = 'All Units',
    totalMarks = 50,
    durationMinutes = 120,
    difficultyDistribution = { easy: 40, medium: 40, hard: 20 },
    sectionA = { numQuestions: 10, marksEach: 2 },
    sectionB = { numQuestions: 5, marksEach: 6 },
    sectionC = { numQuestions: 2, marksEach: 10 },
    instructions = '',
  } = settings || {};

  const prompt = `You are an expert academic question paper generator for university-level Computer Science (B.Sc. CS/MCA) examinations.

TASK: Generate a complete, high-quality unit question paper strictly based on the provided SYLLABUS and PREVIOUS YEAR PAPERS.

CRITICAL REQUIREMENTS:
1. The question paper MUST be accurate, comprehensive, and aligned with the syllabus
2. Questions should be inspired by previous year papers but NOT be exact copies
3. Maintain proper difficulty distribution: ${difficultyDistribution.easy}% easy, ${difficultyDistribution.medium}% medium, ${difficultyDistribution.hard}% hard
4. Each question must map to specific syllabus topics
5. Questions should test different cognitive levels: Remember, Understand, Apply, Analyze, Evaluate, Create
6. Ensure proper mark distribution across sections
7. Questions should be clear, unambiguous, and professionally worded

OUTPUT FORMAT (STRICT JSON):
{
  "paper_title": "string - Full title of the question paper",
  "subject": "${subject}",
  "unit": "${unit}",
  "duration_minutes": ${durationMinutes},
  "total_marks": ${totalMarks},
  "instructions": "string - General instructions for students",
  "sections": [
    {
      "section_name": "A",
      "section_title": "Section A - Short Answer Questions",
      "marks_each": ${sectionA.marksEach},
      "num_questions": ${sectionA.numQuestions},
      "total_marks": ${sectionA.numQuestions * sectionA.marksEach},
      "questions": [
        {
          "qno": "1",
          "question": "string - Clear and specific question",
          "marks": ${sectionA.marksEach},
          "difficulty": "easy|medium|hard",
          "topic": "string - Syllabus topic this question covers",
          "learning_outcome": "string - What learning outcome this tests",
          "cognitive_level": "remember|understand|apply|analyze|evaluate|create",
          "reference_previous_paper": "string - Year/paper ID or 'derived' if original"
        }
      ]
    },
    {
      "section_name": "B",
      "section_title": "Section B - Medium Answer Questions",
      "marks_each": ${sectionB.marksEach},
      "num_questions": ${sectionB.numQuestions},
      "total_marks": ${sectionB.numQuestions * sectionB.marksEach},
      "questions": [
        {
          "qno": "1",
          "question": "string",
          "marks": ${sectionB.marksEach},
          "difficulty": "easy|medium|hard",
          "topic": "string",
          "learning_outcome": "string",
          "cognitive_level": "remember|understand|apply|analyze|evaluate|create",
          "reference_previous_paper": "string"
        }
      ]
    },
    {
      "section_name": "C",
      "section_title": "Section C - Long Answer Questions",
      "marks_each": ${sectionC.marksEach},
      "num_questions": ${sectionC.numQuestions},
      "total_marks": ${sectionC.numQuestions * sectionC.marksEach},
      "questions": [
        {
          "qno": "1",
          "question": "string",
          "marks": ${sectionC.marksEach},
          "difficulty": "easy|medium|hard",
          "topic": "string",
          "learning_outcome": "string",
          "cognitive_level": "remember|understand|apply|analyze|evaluate|create",
          "reference_previous_paper": "string"
        }
      ]
    }
  ],
  "blueprint": {
    "topic_wise_marks": {
      "topic_name": marks_number
    },
    "cognitive_distribution": {
      "remember": percentage,
      "understand": percentage,
      "apply": percentage,
      "analyze": percentage,
      "evaluate": percentage,
      "create": percentage
    },
    "difficulty_distribution": {
      "easy": percentage,
      "medium": percentage,
      "hard": percentage
    }
  },
  "quality_metrics": {
    "syllabus_coverage": "percentage",
    "previous_paper_alignment": "percentage",
    "difficulty_balance": "excellent|good|fair"
  }
}

VALIDATION RULES:
1. Sum of all section marks MUST equal total_marks (${totalMarks})
2. Each section's total_marks must equal num_questions × marks_each
3. Difficulty distribution must match: ${difficultyDistribution.easy}% easy, ${difficultyDistribution.medium}% medium, ${difficultyDistribution.hard}% hard
4. All questions must reference syllabus topics
5. Cognitive levels should be distributed across all sections
6. Questions should be unique and not direct copies from previous papers

SYLLABUS CONTENT:
${syllabusText || 'No syllabus provided'}

PREVIOUS YEAR PAPERS (for reference and pattern analysis):
${previousPapersText || 'No previous papers provided'}

ADDITIONAL INSTRUCTIONS:
${instructions || 'None'}

Now generate the complete question paper in valid JSON format only. Ensure:
- All questions are academically sound and appropriate for university-level examination
- Questions test understanding, not just memorization
- Proper use of technical terminology
- Questions are progressive in difficulty within each section
- No grammatical errors or ambiguities
- JSON is valid and parseable

Generate the JSON output now:`;

  return prompt;
}

/**
 * Extract text from uploaded files
 */
async function extractTextFromFiles(files) {
  const texts = [];
  
  for (const file of files) {
    try {
      // Use FileProcessor's processFile method which handles all file types
      const text = await fileProcessor.processFile(file);
      
      texts.push({
        filename: file.originalname,
        text: text.substring(0, 50000) // Limit to avoid token limits
      });
    } catch (error) {
      console.error(`Error processing file ${file.originalname}:`, error);
      texts.push({
        filename: file.originalname,
        text: `[Error extracting text from this file: ${error.message}]`
      });
    }
  }

  return texts;
}

class QPPController {
  /**
   * Generate question paper with streaming support
   */
  static async generateQuestionPaper(req, res) {
    try {
      if (!QPP_API_KEY) {
        return res.status(500).json({
          success: false,
          error: 'QPP AI key not configured. Please set at least one of GITHUB_PAT or GEMINI_API in environment variables.'
        });
      }

      // Extract files - allow multiple files for both syllabus and previous papers
      const syllabusFiles = req.files?.syllabus || [];
      const previousPaperFiles = req.files?.previousPapers || [];

      if (!syllabusFiles || syllabusFiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one syllabus file is required'
        });
      }

      // Extract settings from request body
      let settings = {};
      try {
        if (req.body.difficultyDistribution && typeof req.body.difficultyDistribution === 'string') {
          settings.difficultyDistribution = JSON.parse(req.body.difficultyDistribution);
        } else {
          settings.difficultyDistribution = req.body.difficultyDistribution || { easy: 40, medium: 40, hard: 20 };
        }

        if (req.body.sectionA && typeof req.body.sectionA === 'string') {
          settings.sectionA = JSON.parse(req.body.sectionA);
        } else {
          settings.sectionA = req.body.sectionA || { numQuestions: 10, marksEach: 2 };
        }

        if (req.body.sectionB && typeof req.body.sectionB === 'string') {
          settings.sectionB = JSON.parse(req.body.sectionB);
        } else {
          settings.sectionB = req.body.sectionB || { numQuestions: 5, marksEach: 6 };
        }

        if (req.body.sectionC && typeof req.body.sectionC === 'string') {
          settings.sectionC = JSON.parse(req.body.sectionC);
        } else {
          settings.sectionC = req.body.sectionC || { numQuestions: 2, marksEach: 10 };
        }
      } catch (parseError) {
        console.warn('Error parsing settings JSON, using defaults:', parseError);
      }

      settings = {
        subject: req.body.subject || 'Computer Science',
        unit: req.body.unit || 'All Units',
        totalMarks: parseInt(req.body.totalMarks) || 50,
        durationMinutes: parseInt(req.body.durationMinutes) || 120,
        difficultyDistribution: settings.difficultyDistribution || { easy: 40, medium: 40, hard: 20 },
        sectionA: settings.sectionA || { numQuestions: 10, marksEach: 2 },
        sectionB: settings.sectionB || { numQuestions: 5, marksEach: 6 },
        sectionC: settings.sectionC || { numQuestions: 2, marksEach: 10 },
        instructions: req.body.instructions || '',
      };

      // Extract text from files
      console.log(`Extracting text from ${syllabusFiles.length} syllabus file(s)...`);
      let syllabusText = '';
      try {
        const syllabusTexts = await extractTextFromFiles(syllabusFiles);
        syllabusText = syllabusTexts
          .map((s, idx) => `--- Syllabus File ${idx + 1} (${s.filename}) ---\n${s.text}`)
          .join('\n\n');
        console.log(`Successfully extracted ${syllabusText.length} characters from syllabus files`);
      } catch (syllabusError) {
        console.error('Error extracting syllabus text:', syllabusError);
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            error: 'Failed to extract text from syllabus files',
            details: syllabusError.message
          });
        }
        throw syllabusError;
      }

      console.log(`Extracting text from ${previousPaperFiles.length} previous paper file(s)...`);
      let previousPapersText = '';
      try {
        const previousPapersTexts = await extractTextFromFiles(previousPaperFiles);
        previousPapersText = previousPapersTexts
          .map((p, idx) => `--- Previous Paper ${idx + 1} (${p.filename}) ---\n${p.text}`)
          .join('\n\n');
        console.log(`Successfully extracted ${previousPapersText.length} characters from previous papers`);
      } catch (papersError) {
        console.error('Error extracting previous papers text:', papersError);
        // Continue with empty previous papers text if extraction fails
        previousPapersText = '[Error extracting text from previous papers]';
      }

      // Build prompt
      const prompt = buildQPPPrompt({
        syllabusText,
        previousPapersText,
        settings
      });

      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'start', message: 'Starting question paper generation...' })}\n\n`);

      try {
        // Generate content via AI orchestrator (GitHub Models only)
        console.log('[AI API CALLED]', 'QPPController.generateContentStreamSmart', {
          timestamp: new Date().toISOString(),
          userId: req?.user?._id
        });
        
        // Generate full response (non-streaming) then simulate streaming to client
        const fullText = await generateText(
          prompt,
          { temperature: 0.2, max_tokens: 8192 }
        );
        
        // Simulate streaming by sending chunks
        const chunkSize = 100;
        for (let i = 0; i < fullText.length; i += chunkSize) {
          const chunk = fullText.substring(i, i + chunkSize);
          res.write(`data: ${JSON.stringify({ 
            type: 'chunk', 
            content: chunk 
          })}\n\n`);
          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Try to parse and validate JSON
        let parsedData = null;
        try {
          // Extract JSON from response (handle markdown code blocks)
          let jsonText = fullText.trim();
          if (jsonText.includes('```json')) {
            jsonText = jsonText.split('```json')[1].split('```')[0].trim();
          } else if (jsonText.includes('```')) {
            jsonText = jsonText.split('```')[1].split('```')[0].trim();
          }
          
          parsedData = JSON.parse(jsonText);
          
          // Validate structure
          if (!parsedData.sections || !Array.isArray(parsedData.sections)) {
            throw new Error('Invalid JSON structure: missing sections');
          }

          // Send completion with parsed data and previous paper text for format extraction
          res.write(`data: ${JSON.stringify({ 
            type: 'complete', 
            data: parsedData,
            rawText: fullText,
            previousPaperText: previousPapersText // Include for format extraction
          })}\n\n`);
        } catch (parseError) {
          // Send completion with raw text if JSON parsing fails
          res.write(`data: ${JSON.stringify({ 
            type: 'complete', 
            rawText: fullText,
            parseError: parseError.message,
            previousPaperText: previousPapersText // Include for format extraction
          })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
        res.end();

      } catch (genError) {
        console.error('Generation error:', genError);
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            error: 'Failed to generate question paper',
            details: genError.message
          });
        }
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: genError.message 
        })}\n\n`);
        res.end();
      }

    } catch (error) {
      console.error('QPP Controller Error:', error);
      console.error('Error stack:', error.stack);
      
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: 'Failed to generate question paper',
          details: error.message
        });
      } else {
        try {
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            error: error.message 
          })}\n\n`);
          res.end();
        } catch (writeError) {
          console.error('Error writing error response:', writeError);
        }
      }
    }
  }

  /**
   * Save generated question paper for the logged-in user
   */
  static async saveQuestionPaper(req, res) {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { paper } = req.body || {};
      if (!paper) {
        return res.status(400).json({
          success: false,
          error: 'Question paper data is required',
        });
      }

      const doc = new QPPPaper({
        userId,
        subject: paper.subject || req.body.subject || '',
        unit: paper.unit || req.body.unit || '',
        title:
          paper.paper_title ||
          `${paper.subject || 'Question Paper'} - ${new Date()
            .toISOString()
            .split('T')[0]}`,
        paper,
      });

      await doc.save();

      return res.json({
        success: true,
        paper: {
          _id: doc._id,
          title: doc.title,
          subject: doc.subject,
          unit: doc.unit,
          createdAt: doc.createdAt,
        },
      });
    } catch (error) {
      console.error('[QPP Controller] Save question paper error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save question paper',
        details: error.message,
      });
    }
  }

  /**
   * List saved question papers for current user (latest first)
   */
  static async listQuestionPapers(req, res) {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const papers = await QPPPaper.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('title subject unit createdAt');

      return res.json({
        success: true,
        papers,
      });
    } catch (error) {
      console.error('[QPP Controller] List question papers error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch saved question papers',
        details: error.message,
      });
    }
  }

  /**
   * Get a single saved question paper by id for the current user
   */
  static async getQuestionPaper(req, res) {
    try {
      const userId = req.user?._id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const doc = await QPPPaper.findOne({ _id: id, userId });
      if (!doc) {
        return res.status(404).json({
          success: false,
          error: 'Question paper not found',
        });
      }

      return res.json({
        success: true,
        paper: doc.paper,
        meta: {
          _id: doc._id,
          title: doc.title,
          subject: doc.subject,
          unit: doc.unit,
          createdAt: doc.createdAt,
        },
      });
    } catch (error) {
      console.error('[QPP Controller] Get question paper error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load question paper',
        details: error.message,
      });
    }
  }

  /**
   * Test connection to Gemini API
   */
  static async testConnection(req, res) {
    try {
      if (!QPP_API_KEY) {
        return res.status(500).json({
          success: false,
          error: 'QPP AI key not configured'
        });
      }

      console.log('[AI API CALLED]', 'QPPController.testConnectionSmart', {
        timestamp: new Date().toISOString(),
        userId: req?.user?._id
      });
      const response = await generateText(
        'Say "QPP service is working!"',
        { temperature: 0.1, max_tokens: 64 }
      );
      
      res.json({
        success: true,
        message: response,
        model: 'smart-orchestrator',
        apiKeyConfigured: !!QPP_API_KEY
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Connection test failed',
        details: error.message
      });
    }
  }

  /**
   * Generate PDF document from question paper
   */
  static async generatePDF(req, res) {
    try {
      console.log('[QPP Controller] PDF generation request received');
      console.log('[QPP Controller] Request body keys:', Object.keys(req.body || {}));
      
      const { paper } = req.body;

      if (!paper) {
        console.error('[QPP Controller] PDF generation failed: No paper data provided');
        return res.status(400).json({
          success: false,
          error: 'Question paper data is required'
        });
      }

      console.log('[QPP Controller] Paper data received:', {
        title: paper.paper_title,
        sections: paper.sections?.length || 0,
        hasPreviousPaperText: !!req.body.previousPaperText
      });

      // Extract format hints from previous papers if available
      let formatHints = {};
      if (req.body.previousPaperText) {
        formatHints = DocumentFormatter.extractFormatHints(req.body.previousPaperText);
        console.log('[QPP Controller] Format hints extracted:', Object.keys(formatHints));
      }

      // Generate PDF buffer
      console.log('[QPP Controller] Generating PDF buffer...');
      const pdfBuffer = await DocumentFormatter.generatePDFBuffer(paper, formatHints);
      console.log('[QPP Controller] PDF buffer generated, size:', pdfBuffer.length, 'bytes');

      // Set response headers
      const filename = `${(paper.paper_title || 'Question_Paper').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF buffer
      console.log('[QPP Controller] Sending PDF response...');
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[QPP Controller] PDF Generation Error:', error);
      console.error('[QPP Controller] Error stack:', error.stack);
      
      // Ensure we send JSON error, not HTML
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: 'Failed to generate PDF',
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }
  }

  /**
   * Generate Word document from question paper
   */
  static async generateWord(req, res) {
    try {
      console.log('[QPP Controller] Word generation request received');
      console.log('[QPP Controller] Request body keys:', Object.keys(req.body || {}));
      
      const { paper } = req.body;

      if (!paper) {
        console.error('[QPP Controller] Word generation failed: No paper data provided');
        return res.status(400).json({
          success: false,
          error: 'Question paper data is required'
        });
      }

      console.log('[QPP Controller] Paper data received:', {
        title: paper.paper_title,
        sections: paper.sections?.length || 0,
        hasPreviousPaperText: !!req.body.previousPaperText
      });

      // Extract format hints from previous papers if available
      let formatHints = {};
      if (req.body.previousPaperText) {
        formatHints = DocumentFormatter.extractFormatHints(req.body.previousPaperText);
        console.log('[QPP Controller] Format hints extracted:', Object.keys(formatHints));
      }

      // Generate Word buffer
      console.log('[QPP Controller] Generating Word buffer...');
      const wordBuffer = await DocumentFormatter.generateWordBuffer(paper, formatHints);
      console.log('[QPP Controller] Word buffer generated, size:', wordBuffer.length, 'bytes');

      // Set response headers
      const filename = `${(paper.paper_title || 'Question_Paper').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', wordBuffer.length);

      // Send Word buffer
      console.log('[QPP Controller] Sending Word response...');
      res.send(wordBuffer);
    } catch (error) {
      console.error('[QPP Controller] Word Generation Error:', error);
      console.error('[QPP Controller] Error stack:', error.stack);
      
      // Ensure we send JSON error, not HTML
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: 'Failed to generate Word document',
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }
  }
}

module.exports = QPPController;

