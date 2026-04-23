const fs = require('fs');
const PizZip = require('pizzip');

function patchTemplate() {
    const filePath = 'templates/daftar_penerimaan_template.docx';
    const content = fs.readFileSync(filePath, 'binary');
    const zip = new PizZip(content);
    let xml = zip.files['word/document.xml'].asText();

    // Split by <w:tr to find rows
    const rows = xml.split('<w:tr ');
    
    // In xml, rows[0] is preamble
    // rows[1] is Header row
    // rows[2] is Empty row
    
    let targetRow = rows[2];
    
    // Find all <w:p> blocks in this row
    const pRegex = /<w:p[\s>].*?<\/w:p>/g;
    const pMatches = targetRow.match(pRegex);
    
    if (pMatches && pMatches.length >= 8) {
        let currentIndex = 0;
        let newRow = targetRow;
        
        const injectTags = [
            '<w:r><w:t>{#penerima}{no}</w:t></w:r>',
            '<w:r><w:t>{nik}</w:t></w:r>',
            '<w:r><w:t>{nama}</w:t></w:r>',
            '<w:r><w:t>{jabatan}</w:t></w:r>',
            '<w:r><w:t>{penerimaan}</w:t></w:r>',
            '<w:r><w:t>{pph21}</w:t></w:r>',
            '<w:r><w:t>{bersih}</w:t></w:r>',
            '<w:r><w:t>{tanda_tangan}{/penerima}</w:t></w:r>'
        ];

        for (let i = 0; i < 8; i++) {
            const patchedP = pMatches[i].replace('</w:p>', `${injectTags[i]}</w:p>`);
            newRow = newRow.substring(0, currentIndex) + newRow.substring(currentIndex).replace(pMatches[i], patchedP);
            currentIndex += patchedP.length;
        }
        
        rows[2] = newRow;
        
        xml = rows.join('<w:tr ');
        zip.file('word/document.xml', xml);
        
        const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        fs.writeFileSync(filePath, buf);
        console.log('Template daftar_penerimaan_template.docx patched successfully.');
    } else {
        console.log('Failed to patch: Could not find 8 <w:p> blocks in the row. Found: ' + (pMatches ? pMatches.length : 0));
    }
}

patchTemplate();
