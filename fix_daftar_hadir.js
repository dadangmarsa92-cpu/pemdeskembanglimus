const fs = require('fs');
const PizZip = require('pizzip');

function patchTemplate() {
    const filePath = 'templates/daftar_hadir_template.docx';
    const content = fs.readFileSync(filePath, 'binary');
    const zip = new PizZip(content);
    let xml = zip.files['word/document.xml'].asText();

    // Split by <w:tr to find rows
    const rows = xml.split('<w:tr ');
    
    // row 0 is before the first row.
    // row 1 is Hari Tanggal
    // row 2 is Kegiatan
    // row 3 is NO NAMA JABATAN ALAMAT TANDA TANGAN
    // row 4 is the empty row
    // row 5 is Pelaksana Kegiatan

    // In split, the first element is the XML preamble up to the first <w:tr.
    // So row index in the split array matches the 1-based row number.
    // The empty row is index 4.
    
    let targetRow = rows[4];
    
    // We split the target row by <w:tc
    const cells = targetRow.split('<w:tc>'); // Note: <w:tc> or <w:tcPr> usually comes after <w:tc> or <w:tc ...>
    // Wait, the XML dump shows <w:tc><w:tcPr>
    
    // A better approach is to use regex replacement on the exact row string
    let newRow = targetRow;
    
    // Find all <w:p> blocks in this row
    const pRegex = /<w:p[\s>].*?<\/w:p>/g;
    const pMatches = newRow.match(pRegex);
    
    if (pMatches && pMatches.length >= 5) {
        // We only care about the first 5 <w:p> blocks which correspond to the 5 cells in the empty row.
        
        // We need to replace carefully using string manipulation to only replace the EXACT match of that specific block once.
        // Since pMatches[0] to pMatches[4] might be identical strings, replace() will just replace the first occurrence.
        // We can do this by keeping a running index.
        let currentIndex = 0;
        
        // Cell 1: Add {#peserta}{no}
        const p1 = pMatches[0].replace('</w:p>', '<w:r><w:t>{#peserta}{no}</w:t></w:r></w:p>');
        newRow = newRow.substring(0, currentIndex) + newRow.substring(currentIndex).replace(pMatches[0], p1);
        currentIndex += p1.length;
        
        // Cell 2: Add {nama}
        const p2 = pMatches[1].replace('</w:p>', '<w:r><w:t>{nama}</w:t></w:r></w:p>');
        newRow = newRow.substring(0, currentIndex) + newRow.substring(currentIndex).replace(pMatches[1], p2);
        currentIndex += p2.length;
        
        // Cell 3: Add {jabatan}
        const p3 = pMatches[2].replace('</w:p>', '<w:r><w:t>{jabatan}</w:t></w:r></w:p>');
        newRow = newRow.substring(0, currentIndex) + newRow.substring(currentIndex).replace(pMatches[2], p3);
        currentIndex += p3.length;
        
        // Cell 4: Add {alamat}
        const p4 = pMatches[3].replace('</w:p>', '<w:r><w:t>{alamat}</w:t></w:r></w:p>');
        newRow = newRow.substring(0, currentIndex) + newRow.substring(currentIndex).replace(pMatches[3], p4);
        currentIndex += p4.length;
        
        // Cell 5: Add {tanda_tangan}{/peserta}
        const p5 = pMatches[4].replace('</w:p>', '<w:r><w:t>{tanda_tangan}{/peserta}</w:t></w:r></w:p>');
        newRow = newRow.substring(0, currentIndex) + newRow.substring(currentIndex).replace(pMatches[4], p5);
    }

    rows[4] = newRow;
    
    xml = rows.join('<w:tr ');
    zip.file('word/document.xml', xml);
    
    const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(filePath, buf);
    console.log('Template daftar_hadir_template.docx patched successfully.');
}

patchTemplate();
