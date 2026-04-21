const fs = require('fs');
const PizZip = require('pizzip');

const content = fs.readFileSync('templates/sppdpenerimaan_template.docx', 'binary');
const zip = new PizZip(content);
let xml = zip.files['word/document.xml'].asText();

// Reverse my previous bad replacements
xml = xml.replace(/<w:t>peserta}<\/w:t><\/w:r><w:r><w:t>{nama_pegawai<\/w:t>/g, '<w:t>nama_pegawai</w:t>');
xml = xml.replace(/<w:t>peserta}<\/w:t><\/w:r><w:r><w:t>{nominal<\/w:t>/g, '<w:t>nominal</w:t>');

// Now the XML is back to where the user had { ... # ... nama_pegawai ... } and { ... / ... nominal ... }
// Let's replace the whole { ... # ... nama_pegawai ... } with {#peserta}{nama_pegawai} in ONE clean text run.
xml = xml.replace(/<w:t>\{<\/w:t>.*?<w:t>#<\/w:t>.*?<w:t>nama_pegawai<\/w:t>.*?<w:t>\}<\/w:t>/, '<w:t>{#peserta}{nama_pegawai}</w:t>');
// Do the same for the closing tag
xml = xml.replace(/<w:t>\{<\/w:t>.*?<w:t>\/<\/w:t>.*?<w:t>nominal<\/w:t>.*?<w:t>\}<\/w:t>/, '<w:t>{nominal}{/peserta}</w:t>');

zip.file('word/document.xml', xml);
const out = zip.generate({type: 'nodebuffer'});
fs.writeFileSync('templates/sppdpenerimaan_template.docx', out);
console.log('Fixed docx');
