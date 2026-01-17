const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Use Microsoft Edge to print to PDF
const htmlPath = path.join(__dirname, 'JubileeOutlook_Feature_Status.html');
const pdfPath = path.join(__dirname, 'JubileeOutlook_Feature_Status.pdf');

console.log('Generating PDF from:', htmlPath);
console.log('Output PDF:', pdfPath);

// Use msedge with print-to-pdf flag
const edgePath = '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"';
const command = `${edgePath} --headless --disable-gpu --print-to-pdf="${pdfPath}" "file:///${htmlPath.replace(/\\/g, '/')}"`;

console.log('Running command:', command);

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    if (stderr) {
        console.log('stderr:', stderr);
    }
    console.log('PDF generated successfully!');
});
