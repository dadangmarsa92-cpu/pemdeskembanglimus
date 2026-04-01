const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const target = 'narasumber_template.docx';
const templatePath = path.join(__dirname, 'templates', target);

try {
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  const docXml = zip.files['word/document.xml'].asText();
  
  // A more robust way to find tags: 
  // Tags in docxtemplater can be split across multiple <w:t> tags.
  // But usually, they are together.
  // Let's strip all XML tags and see.
  const cleanText = docXml.replace(/<[^>]+>/g, '');
  
  const regex = /\{([^}]+)\}/g;
  let match;
  const tags = new Set();
  
  while ((match = regex.exec(cleanText)) !== null) {
      // Sometimes tags have garbage around them if they were split in XML.
      // We take the whole thing and clean it.
      tags.add(match[1].trim());
  }
  
  console.log('--- TAGS EXTRACTED ---');
  console.log(JSON.stringify(Array.from(tags).sort(), null, 2));

} catch (err) {
  console.error('Error:', err.message);
}
