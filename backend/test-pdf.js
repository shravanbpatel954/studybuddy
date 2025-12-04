const fs = require('fs');
const path = require('path');
const fileProcessor = require('./src/utils/fileProcessor');

async function testPDFProcessing() {
    try {
        // You can replace this with any PDF file path
        const pdfPath = process.argv[2] || 'test.pdf';
        
        if (!fs.existsSync(pdfPath)) {
            console.log('Please provide a valid PDF file path as argument');
            console.log('Usage: node test-pdf.js path/to/your.pdf');
            return;
        }

        console.log(`Testing PDF processing with file: ${pdfPath}`);
        const buffer = fs.readFileSync(pdfPath);
        
        console.log('Starting text extraction...');
        const text = await fileProcessor.processFile({
            buffer,
            mimetype: 'application/pdf'
        });

        console.log('\nExtracted text preview (first 500 chars):');
        console.log('----------------------------------------');
        console.log(text.substring(0, 500));
        console.log('----------------------------------------');
        console.log(`\nTotal extracted text length: ${text.length} characters`);

    } catch (error) {
        console.error('Test failed:', error.message);
        console.error('Error details:', error);
    }
}

testPDFProcessing();