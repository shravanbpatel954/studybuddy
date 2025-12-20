const Tesseract = require('tesseract.js');
const mammoth = require('mammoth');
const textract = require('textract');
const util = require('util');
const textractFromBuffer = util.promisify(textract.fromBufferWithMime);

// Import PDF.js legacy build
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
// Set up the workerSrc
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker');

class FileProcessor {

    async extractTextFromImage(buffer, mimetype) {
        try {
            const { data: { text } } = await Tesseract.recognize(
                buffer,
                'eng',
                { logger: m => console.log(m) }
            );
            return text;
        } catch (error) {
            throw new Error('Error processing image: ' + error.message);
        }
    }

    async extractTextFromWord(buffer) {
        try {
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        } catch (error) {
            throw new Error('Error processing Word document: ' + error.message);
        }
    }

    async extractTextFromOtherFormats(buffer, mimetype) {
        // Handle plain text files directly
        if (mimetype === 'text/plain') {
            try {
                // Buffer to string
                return buffer.toString('utf-8');
            } catch (error) {
                throw new Error('Error processing plain text file: ' + error.message);
            }
        }
        // For other formats, use textract
        try {
            const text = await textractFromBuffer(buffer, mimetype);
            return text;
        } catch (error) {
            throw new Error(`Error processing ${mimetype}: ${error.message}`);
        }
    }

    // Helper function to determine file type
    getMimeCategory(mimetype) {
        const mimeCategories = {
            'application/pdf': 'pdf',
            'image/jpeg': 'image',
            'image/png': 'image',
            'image/gif': 'image',
            'image/webp': 'image',
            'image/tiff': 'image',
            'application/msword': 'word',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
            'application/vnd.ms-powerpoint': 'powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
            'application/vnd.oasis.opendocument.text': 'word',
            'application/vnd.oasis.opendocument.presentation': 'powerpoint',
            'text/plain': 'text',
            'text/rtf': 'text'
        };
        return mimeCategories[mimetype] || 'other';
    }

    // Main processing function
    async processFile(file) {
        if (!file || !file.buffer) {
            throw new Error('No file provided or invalid file format');
        }

        const mimeCategory = this.getMimeCategory(file.mimetype);
        console.log(`Processing file of type: ${mimeCategory} (${file.mimetype})`);
        
        let extractedText;

        try {
            console.log('Starting text extraction...');
            
            // Handle PDF files using PDF.js legacy build
            if (file.mimetype === 'application/pdf') {
                console.log('Processing PDF using PDF.js legacy build...');
                
                try {
                    // Convert buffer to Uint8Array
                    const data = new Uint8Array(file.buffer);
                    console.log(`PDF buffer size: ${file.buffer.length} bytes`);
                    
                    // Load the PDF document
                    const loadingTask = pdfjsLib.getDocument(data);
                    const pdf = await loadingTask.promise;
                    console.log(`PDF loaded successfully. Number of pages: ${pdf.numPages}`);
                    
                    let finalText = '';
                    
                    // Get all pages
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        finalText += pageText + '\n';
                        if (i % 10 === 0) {
                            console.log(`Processed ${i}/${pdf.numPages} pages...`);
                        }
                    }
                    
                    extractedText = finalText.trim();
                    console.log(`PDF.js extraction complete. Extracted ${extractedText.length} characters`);
                    
                    if (!extractedText || extractedText.length === 0) {
                        throw new Error('No text extracted from PDF. The PDF might be image-based (scanned) or contain no text.');
                    }
                    
                    console.log(`Successfully extracted ${extractedText.length} characters using PDF.js`);
                    return extractedText;
                } catch (pdfError) {
                    console.error('PDF extraction error:', pdfError);
                    throw new Error('Failed to extract text from PDF: ' + pdfError.message);
                }
            }
            switch (mimeCategory) {
                case 'image':
                    // Handwritten notes: If image contains handwriting, Tesseract OCR will attempt to extract text.
                    // Accuracy depends on image quality and handwriting clarity.
                    console.log('Using Tesseract OCR...');
                    extractedText = await this.extractTextFromImage(file.buffer, file.mimetype);
                    break;
                case 'word':
                    console.log('Using Word document parser...');
                    extractedText = await this.extractTextFromWord(file.buffer);
                    break;
                case 'powerpoint':
                case 'text':
                case 'other':
                    console.log('Using general text extractor...');
                    extractedText = await this.extractTextFromOtherFormats(file.buffer, file.mimetype);
                    break;
                default:
                    throw new Error('Unsupported file type');
            }

            if (!extractedText || extractedText.trim().length === 0) {
                throw new Error('No text could be extracted from the file');
            }

            console.log(`Successfully extracted ${extractedText.length} characters of text`);
            return extractedText;
        } catch (error) {
            console.error('Error processing file:', error);
            console.error('Error details:', error.stack);
            // Don't double-wrap errors that are already user-friendly
            if (error.message && (
                error.message.includes('Failed to extract text from PDF') ||
                error.message.includes('No text could be extracted') ||
                error.message.includes('Error processing') ||
                error.message.includes('Unsupported file type')
            )) {
                throw error; // Re-throw as-is
            }
            throw new Error(`Failed to process file: ${error.message}`);
        }
    }

    // Get supported file types
    getSupportedFileTypes() {
        return [
            '.pdf',  // PDF documents
            '.doc', '.docx', '.odt',  // Word documents
            '.ppt', '.pptx', '.odp',  // PowerPoint presentations
            '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff',  // Images
            '.txt', '.rtf'  // Text files
        ];
    }
}

module.exports = new FileProcessor();