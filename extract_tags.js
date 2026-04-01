const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const target = 'narasumber_template.docx';
const templatePath = path.join(__dirname, 'templates', target);

try {
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  const docXml = zip.files['word/document.xml'].asText();
  
  // Clean XML tags but keep characters that might be inside tags like <w:t>{tag}</w:t>
  // Actually, docxtemplater handles tags split across XML tags.
  // For a simple extraction, stripping XML is usually okay if we're lucky.
  const cleanText = docXml.replace(/<[^>]+>/g, '');
  
  const regex = /\{([^}]+)\}/g;
  let match;
  const tags = new Set();
  
  while ((match = regex.exec(cleanText)) !== null) {
    tags.add(match[1].trim());
  }
  
  console.log('--- TAGS IN ' + target + ' ---');
  Array.from(tags).sort().forEach(tag => console.log('- ' + tag));
  console.log('------------------------------');

} catch (err) {
  console.error('Error:', err.message);
}
