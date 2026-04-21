const fs = require('fs');
const PizZip = require('pizzip');

const content = fs.readFileSync('templates/sppdpenerimaan_template.docx', 'binary');
const zip = new PizZip(content);
const docXml = zip.files['word/document.xml'].asText();
console.log(docXml.includes('{#peserta') || docXml.includes('{#'));
