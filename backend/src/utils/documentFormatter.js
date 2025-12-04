const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = require('docx');
const { jsPDF } = require('jspdf');

/**
 * Document Formatter - Formats question papers for PDF and Word export
 * Maintains format consistency with previous year papers
 */
class DocumentFormatter {
  /**
   * Extract format hints from previous year paper text
   */
  static extractFormatHints(previousPaperText) {
    const hints = {
      hasHeader: false,
      hasFooter: false,
      fontFamily: 'Times', // Default for academic papers
      fontSize: 12,
      lineSpacing: 1.5,
      sectionStyle: 'lettered', // 'numbered' or 'lettered' - default to lettered (A, B, C)
      questionStyle: 'numbered', // 'numbered' or 'lettered'
      hasInstructions: true, // Default to true for question papers
      hasMarksDistribution: false,
      alignment: 'left',
      headerText: '',
      footerText: '',
      titleStyle: 'centered', // 'centered' or 'left'
      sectionTitleStyle: 'bold', // 'bold', 'underline', 'both'
      questionNumberStyle: 'bold', // 'bold', 'normal'
      showMarksInline: true, // Show marks next to question
      showTopic: false, // Show topic for each question
    };

    const text = previousPaperText.toLowerCase();

    // Detect header patterns (university name, college, etc.)
    if (text.match(/university|college|institute|department|faculty/i)) {
      hints.hasHeader = true;
      // Try to extract header text
      const headerMatch = previousPaperText.match(/(?:university|college|institute|department)[^\.\n]{0,100}/i);
      if (headerMatch) {
        hints.headerText = headerMatch[0].trim();
      }
    }

    // Detect footer patterns
    if (text.match(/page\s*\d+|footer|total\s*marks/i)) {
      hints.hasFooter = true;
    }

    // Detect section style (A, B, C vs 1, 2, 3)
    if (text.match(/section\s*[a-z]|part\s*[a-z]/i)) {
      hints.sectionStyle = 'lettered';
    } else if (text.match(/section\s*\d+|part\s*\d+/i)) {
      hints.sectionStyle = 'numbered';
    }

    // Detect question numbering style
    if (text.match(/q\d+|question\s*\d+/i)) {
      hints.questionStyle = 'numbered';
    } else if (text.match(/q[a-z]|question\s*[a-z]/i)) {
      hints.questionStyle = 'lettered';
    }

    // Detect instructions
    if (text.match(/instructions?|note|read\s*carefully/i)) {
      hints.hasInstructions = true;
    }

    // Detect marks distribution
    if (text.match(/marks?\s*distribution|blueprint|allocation/i)) {
      hints.hasMarksDistribution = true;
    }

    // Detect title alignment (usually centered in question papers)
    if (text.match(/question\s*paper|examination|test/i)) {
      hints.titleStyle = 'centered';
    }

    // Detect if marks are shown inline with questions
    if (text.match(/\[\d+\s*marks?\]|\(\d+\s*marks?\)|\d+\s*marks?/i)) {
      hints.showMarksInline = true;
    }

    // Detect if topics are shown
    if (text.match(/topic|unit|chapter/i)) {
      hints.showTopic = true;
    }

    return hints;
  }

  /**
   * Format paper data for display/download
   */
  static formatPaperData(paper, formatHints = {}) {
    const {
      paper_title = 'Question Paper',
      subject = '',
      unit = '',
      duration_minutes = 120,
      total_marks = 50,
      instructions = '',
      sections = [],
      subject_code = '',
    } = paper;

    return {
      title: paper_title,
      subject,
      unit,
      duration: duration_minutes,
      totalMarks: total_marks,
      instructions,
      subject_code,
      sections: sections.map((section, idx) => ({
        name: section.section_name || `Section ${String.fromCharCode(65 + idx)}`,
        title: section.section_title || `Section ${String.fromCharCode(65 + idx)}`,
        marksEach: section.marks_each || 0,
        numQuestions: section.num_questions || 0,
        questions: (section.questions || []).map((q, qIdx) => ({
          number: q.qno || (qIdx + 1).toString(),
          text: q.question || q.text || '',
          question: q.question || q.text || '', // Keep both for compatibility
          marks: q.marks || q.marks_each || 0,
          difficulty: q.difficulty || 'medium',
          topic: q.topic || '',
          learning_outcome: q.learning_outcome || q.co || '',
          cognitive_level: q.cognitive_level || q.bl || '',
          co: q.co || q.learning_outcome || '',
          bl: q.bl || q.cognitive_level || '',
        })),
      })),
    };
  }

  /**
   * Generate PDF document in professional question paper format
   */
  static generatePDF(paper, formatHints = {}) {
    if (!paper) {
      throw new Error('Paper data is required');
    }

    try {
      const formatted = this.formatPaperData(paper, formatHints);
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = 25; // Start position
      const lineHeight = 6;
      const sectionSpacing = 8;

      // Set white background (default)
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Header - Paper / Subject Code format
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const subjectCode = paper.subject_code || 'N20131';
      const headerLine1 = `Paper / Subject Code: ${subjectCode} / ${formatted.subject || formatted.title}`;
      doc.text(headerLine1, margin, yPos);
      yPos += lineHeight * 1.2;

      // Date and course info - format: DD/MM/YYYY Course Info
      const now = new Date();
      const currentDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const courseInfo = `${currentDate} ${formatted.unit || 'MCA SEM-I'} ${formatted.subject || ''}`;
      doc.text(courseInfo, margin, yPos);
      yPos += lineHeight * 1.2;

      // Time and Total Marks
      doc.setFont('helvetica', 'bold');
      const hours = Math.floor(formatted.duration / 60);
      const minutes = formatted.duration % 60;
      const timeText = hours > 0 ? `${hours} Hour${hours > 1 ? 's' : ''}` : `${minutes} Minutes`;
      doc.text(`Time: ${timeText}`, margin, yPos);
      doc.text(`Total Marks: ${formatted.totalMarks}`, pageWidth - margin - 30, yPos, { align: 'right' });
      yPos += lineHeight * 1.5;

      // Instructions section (Note)
      if (formatted.instructions || formatHints.hasInstructions) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Note:', margin, yPos);
        yPos += lineHeight;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const instructionText = formatted.instructions || 'All questions are compulsory.';
        const instructionLines = doc.splitTextToSize(instructionText, pageWidth - 2 * margin);
        instructionLines.forEach(line => {
          if (yPos > pageHeight - margin - 15) {
            doc.addPage();
            yPos = 25;
          }
          doc.text(line, margin + 5, yPos);
          yPos += lineHeight * 0.9;
        });
        yPos += lineHeight;
      }

      // Questions - Professional format like question papers
      let questionNumber = 1;
      formatted.sections.forEach((section, sectionIdx) => {
        // Check if new page needed
        if (yPos > pageHeight - margin - 25) {
          doc.addPage();
          yPos = 25;
        }

        // Section Title (if multiple sections)
        if (formatted.sections.length > 1) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          const sectionTitle = section.title || `Section ${String.fromCharCode(65 + sectionIdx)}`;
          doc.text(sectionTitle, margin, yPos);
          yPos += lineHeight * 1.2;
        }

        // Questions in the section
        doc.setFontSize(10);
        section.questions.forEach((question, qIdx) => {
          // Check if new page needed
          if (yPos > pageHeight - margin - 20) {
            doc.addPage();
            yPos = 25;
          }

          // Question Number - bold
          doc.setFont('helvetica', 'bold');
          const qNum = question.number || questionNumber.toString();
          
          // Check if question has sub-questions (a, b, c, d format)
          const questionText = question.question || question.text || '';
          const hasSubQuestions = questionText.includes('a.') || questionText.includes('a)') || 
                                  questionText.includes('Attempt following') || 
                                  questionText.includes('following questions');
          
          if (hasSubQuestions) {
            // Main question with sub-questions
            const mainQuestion = questionText.match(/^[^a-z]*attempt[^a-z]*following[^a-z]*questions?[^a-z]*\.?/i)?.[0] || 
                                 questionText.split(/[a-z]\.\s*"/i)[0] || 
                                 'Attempt following questions.';
            doc.text(`Q${qNum}: ${mainQuestion.trim()}`, margin, yPos);
            yPos += lineHeight * 1.0;
            doc.setFont('helvetica', 'normal');
            
            // Split question text by sub-questions
            const subQuestions = this.extractSubQuestions(questionText);
            subQuestions.forEach((subQ, subIdx) => {
              if (yPos > pageHeight - margin - 15) {
                doc.addPage();
                yPos = 25;
              }
              
              const subLetter = String.fromCharCode(97 + subIdx); // a, b, c, d
              const subQData = typeof subQ === 'object' ? subQ : { text: subQ, marks: 0, co: '', bl: '' };
              const marks = subQData.marks || question.marks || question.marks_each || 0;
              const co = subQData.co || question.learning_outcome || question.co || '';
              const bl = subQData.bl || question.cognitive_level || question.bl || '';
              
              // Format: a. "Question text" [Marks] CO BL
              doc.setFont('helvetica', 'normal');
              const subQText = `${subLetter}. "${subQData.text || subQData}"`;
              doc.text(subQText, margin + 5, yPos);
              
              // Marks, CO, BL on the right (table-like format)
              const rightX = pageWidth - margin - 50;
              doc.setFont('helvetica', 'bold');
              if (marks > 0) {
                doc.text(`[${marks.toString().padStart(2, '0')}]`, rightX, yPos);
              }
              if (co) {
                doc.text(co, rightX + 12, yPos);
              }
              if (bl) {
                doc.text(bl, rightX + 22, yPos);
              }
              
              yPos += lineHeight * 1.2;
            });
          } else {
            // Single question format
            doc.text(`Q${qNum}:`, margin, yPos);
            yPos += lineHeight * 0.8;
            doc.setFont('helvetica', 'normal');
            
            // Question text - format like question papers
            const marks = question.marks || 0;
            const co = question.learning_outcome || question.co || '';
            const bl = question.cognitive_level || question.bl || '';
            
            // Calculate available width for question text (leave space for marks/CO/BL)
            const rightColumnWidth = 50; // Space for [marks] CO BL
            const questionWidth = pageWidth - 2 * margin - rightColumnWidth;
            
            const questionLines = doc.splitTextToSize(questionText, questionWidth);
            questionLines.forEach((line, lineIdx) => {
              if (yPos > pageHeight - margin - 15) {
                doc.addPage();
                yPos = 25;
              }
              doc.text(line, margin + 5, yPos);
              
              // Add marks, CO, BL on first line (right-aligned)
              if (lineIdx === 0) {
                const rightX = pageWidth - margin - 50;
                doc.setFont('helvetica', 'bold');
                if (marks > 0) {
                  doc.text(`[${marks.toString().padStart(2, '0')}]`, rightX, yPos);
                }
                if (co) {
                  doc.text(co, rightX + 12, yPos);
                }
                if (bl) {
                  doc.text(bl, rightX + 22, yPos);
                }
                doc.setFont('helvetica', 'normal');
              }
              yPos += lineHeight * 0.9;
            });
          }

          questionNumber++;
          yPos += lineHeight * 0.8; // Spacing between questions
        });

        yPos += sectionSpacing; // Spacing between sections
      });

      // Add page numbers
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      return doc;
    } catch (error) {
      console.error('Error in generatePDF:', error);
      throw new Error(`PDF generation error: ${error.message}`);
    }
  }

  /**
   * Extract sub-questions from question text
   */
  static extractSubQuestions(questionText) {
    const subQuestions = [];
    
    // Remove the main question text (e.g., "Attempt following questions.")
    let text = questionText.replace(/^[^a-z]*attempt[^a-z]*following[^a-z]*questions?[^a-z]*\.?/i, '').trim();
    
    // Try multiple patterns to extract sub-questions
    // Pattern 1: a. "text" [marks] CO BL
    const pattern1 = /([a-z])\.\s*"([^"]+)"\s*\[(\d+)\]\s*([A-Z0-9]+)\s*([A-Z0-9]+)/gi;
    let matches = [...text.matchAll(pattern1)];
    if (matches.length > 0) {
      matches.forEach(match => {
        subQuestions.push({
          text: match[2].trim(),
          marks: parseInt(match[3]) || 0,
          co: match[4] || '',
          bl: match[5] || ''
        });
      });
      return subQuestions;
    }
    
    // Pattern 2: a. "text" [marks]
    const pattern2 = /([a-z])\.\s*"([^"]+)"\s*\[(\d+)\]/gi;
    matches = [...text.matchAll(pattern2)];
    if (matches.length > 0) {
      matches.forEach(match => {
        subQuestions.push({
          text: match[2].trim(),
          marks: parseInt(match[3]) || 0,
          co: '',
          bl: ''
        });
      });
      return subQuestions;
    }
    
    // Pattern 3: a. "text"
    const pattern3 = /([a-z])\.\s*"([^"]+)"/gi;
    matches = [...text.matchAll(pattern3)];
    if (matches.length > 0) {
      matches.forEach(match => {
        subQuestions.push({
          text: match[2].trim(),
          marks: 0,
          co: '',
          bl: ''
        });
      });
      return subQuestions;
    }
    
    // Pattern 4: a. text [marks] CO BL (without quotes)
    const pattern4 = /([a-z])\.\s*([^\[]+?)\s*\[(\d+)\]\s*([A-Z0-9]+)\s*([A-Z0-9]+)/gi;
    matches = [...text.matchAll(pattern4)];
    if (matches.length > 0) {
      matches.forEach(match => {
        subQuestions.push({
          text: match[2].trim(),
          marks: parseInt(match[3]) || 0,
          co: match[4] || '',
          bl: match[5] || ''
        });
      });
      return subQuestions;
    }
    
    // If no sub-questions found, return the whole text as one question
    return [{
      text: questionText.trim(),
      marks: 0,
      co: '',
      bl: ''
    }];
  }

  /**
   * Generate Word document
   */
  static generateWord(paper, formatHints = {}) {
    if (!paper) {
      throw new Error('Paper data is required');
    }

    try {
      const formatted = this.formatPaperData(paper, formatHints);

      const children = [];

      // Header if detected
      if (formatHints.hasHeader && formatHints.headerText) {
        children.push(
          new Paragraph({
            text: formatHints.headerText,
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          })
        );
        children.push(
          new Paragraph({
            text: '',
            spacing: { after: 50 },
            border: {
              bottom: {
                color: '000000',
                size: 6,
                style: BorderStyle.SINGLE,
              },
            },
          })
        );
      }

      // Title - centered and bold
      const titleAlign = formatHints.titleStyle === 'centered' ? AlignmentType.CENTER : AlignmentType.LEFT;
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: formatted.title, bold: true, size: 32 }),
          ],
          heading: HeadingLevel.TITLE,
          alignment: titleAlign,
          spacing: { after: 300 },
        })
      );

      // Subject and Unit Info - formatted like question papers
      const infoParagraphs = [];
      if (formatted.subject) {
        infoParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Subject: ', bold: true }),
              new TextRun({ text: formatted.subject }),
            ],
            spacing: { after: 80 },
          })
        );
      }
      if (formatted.unit) {
        infoParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Unit: ', bold: true }),
              new TextRun({ text: formatted.unit }),
            ],
            spacing: { after: 80 },
          })
        );
      }
      infoParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Duration: ', bold: true }),
            new TextRun({ text: `${formatted.duration} minutes` }),
          ],
          spacing: { after: 80 },
        })
      );
      infoParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Total Marks: ', bold: true, size: 24 }),
            new TextRun({ text: formatted.totalMarks.toString(), bold: true, size: 24 }),
          ],
          spacing: { after: 200 },
        })
      );
      children.push(...infoParagraphs);
      
      // Draw a line separator
      children.push(
        new Paragraph({
          text: '',
          spacing: { after: 100 },
          border: {
            bottom: {
              color: '000000',
              size: 4,
              style: BorderStyle.SINGLE,
            },
          },
        })
      );

      // Instructions - formatted like question papers
      if (formatted.instructions || formatHints.hasInstructions) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Instructions:', bold: true, size: 24 }),
            ],
            spacing: { after: 100 },
          })
        );
        const instructionText = formatted.instructions || 'All questions are compulsory.';
        children.push(
          new Paragraph({
            text: instructionText,
            spacing: { after: 200 },
          })
        );
      }

    // Sections
    formatted.sections.forEach((section, sectionIdx) => {
      // Section Title
      children.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 100 },
        })
      );

      // Section Info
      children.push(
        new Paragraph({
          text: `${section.numQuestions} questions × ${section.marksEach} marks = ${section.numQuestions * section.marksEach} marks`,
          spacing: { after: 200 },
        })
      );

        // Questions - formatted like question papers
        section.questions.forEach((question, qIdx) => {
          const questionChildren = [
            new TextRun({ text: `Q${question.number}. `, bold: true, size: 22 }),
          ];
          
          if (formatHints.showMarksInline) {
            questionChildren.push(new TextRun({ text: question.text, size: 22 }));
            questionChildren.push(new TextRun({ text: ` [${question.marks} marks]`, bold: true, size: 22 }));
          } else {
            questionChildren.push(new TextRun({ text: question.text, size: 22 }));
          }

          children.push(
            new Paragraph({
              children: questionChildren,
              spacing: { after: 120 },
              indent: { left: 200 }, // Indent question text
            })
          );

          // Topic (if available and format hints say to show it)
          if (question.topic && formatHints.showTopic) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `(Topic: ${question.topic})`, italics: true, size: 20, color: '666666' }),
                ],
                spacing: { after: 80 },
                indent: { left: 200 },
              })
            );
          }
        });
    });

    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    return doc;
    } catch (error) {
      console.error('Error in generateWord:', error);
      throw new Error(`Word generation error: ${error.message}`);
    }
  }

  /**
   * Generate PDF buffer
   */
  static async generatePDFBuffer(paper, formatHints = {}) {
    try {
      const doc = this.generatePDF(paper, formatHints);
      if (!doc) {
        throw new Error('Failed to generate PDF document');
      }
      // Use 'arraybuffer' for binary data
      const arrayBuffer = doc.output('arraybuffer');
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('PDF output is empty');
      }
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Error generating PDF buffer:', error);
      console.error('Error details:', error.stack);
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Generate Word buffer
   */
  static async generateWordBuffer(paper, formatHints = {}) {
    try {
      const doc = this.generateWord(paper, formatHints);
      if (!doc) {
        throw new Error('Failed to generate Word document');
      }
      return await Packer.toBuffer(doc);
    } catch (error) {
      console.error('Error generating Word buffer:', error);
      throw new Error(`Word generation failed: ${error.message}`);
    }
  }
}

module.exports = DocumentFormatter;

