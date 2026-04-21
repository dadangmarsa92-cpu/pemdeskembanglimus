const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const target = 'sppdpenerimaan_template.docx';
const templatePath = path.join(__dirname, 'templates', target);

try {
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  const docXml = zip.files['word/document.xml'].asText();
  
  // Strip XML tags to get raw text
  const cleanText = docXml.replace(/<[^>]+>/g, '');
  
  console.log('=== RAW TEXT FROM TEMPLATE ===');
  console.log(cleanText);
  console.log('\n=== TAGS FOUND ===');
  
  const regex = /\{([^}]+)\}/g;
  let match;
  const tags = [];
  
  while ((match = regex.exec(cleanText)) !== null) {
    tags.push(match[0]); // full tag with braces
  }
  
  if (tags.length === 0) {
    console.log('❌ NO TAGS FOUND! The template has no {tag} markers.');
  } else {
    tags.forEach((t, i) => console.log(`  ${i+1}. ${t}`));
  }

  // Also check raw XML for split tags (e.g. {nama split across <w:t> elements)
  console.log('\n=== CHECKING FOR SPLIT TAGS IN XML ===');
  const splitCheck = docXml.match(/\{[^}]*<\/w:t>/g);
  if (splitCheck) {
    console.log('⚠️  Found potential split tags (tags broken across XML elements):');
    splitCheck.forEach(s => console.log('  ', s));
  } else {
    console.log('✅ No split tags detected.');
  }

} catch (err) {
  console.error('Error:', err.message);
}
