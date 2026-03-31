const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'templates', 'sppd_template.docx');

try {
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  console.log('✅ Success: Template is a valid ZIP/DOCX file.');
  console.log('File size:', fs.statSync(templatePath).size, 'bytes');
  
  // Try to find if it has internal XML
  if (zip.files['word/document.xml']) {
    console.log('✅ Success: Found word/document.xml inside ZIP.');
  } else {
    console.log('❌ Error: Not a valid DOCX file (missing word/document.xml).');
  }
} catch (err) {
  console.error('❌ Error: Failed to open template as ZIP.');
  console.error(err.message);
}
