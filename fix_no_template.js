const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'templates', 'sppdpenerimaan_template.docx');

try {
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  let docXml = zip.files['word/document.xml'].asText();

  // Current state: {no} is in a separate cell BEFORE the {#nama_pegawai} cell
  // We need to move {no} INSIDE the loop, i.e., after {#nama_pegawai}
  // 
  // Strategy: Find {no} in its <w:tc> cell, then find the {#nama_pegawai} opening
  // and restructure so that {#nama_pegawai} comes first (opening the loop),
  // then {no} is inside the loop context.
  //
  // Simplest fix: swap the content so the cell order becomes:
  //   Cell 1: {#nama_pegawai}{no}   (loop opens, then shows number)
  //   Cell 2: {nama_pegawai}        (shows name)
  //   ...rest...
  //   Last cell: {/nama_pegawai}
  //
  // But actually in docxtemplater table row loops, {#loop} and {/loop} 
  // just need to be in the same row. ALL cells in the row are inside the loop.
  // So {no} being in cell 1 and {#nama_pegawai} in cell 2 should still work
  // because the entire row is repeated.
  
  // Wait - let me re-read docxtemplater docs. Actually, for table loops:
  // The {#tag} and {/tag} mark the SECTION. Everything between them is repeated.
  // If {no} is BEFORE {#nama_pegawai} in the same row, it's NOT inside the loop.
  
  // Fix: Put {#nama_pegawai} in the FIRST cell (same cell as {no})
  // So the NO cell becomes: {#nama_pegawai}{no}
  
  // Find the <w:tc> containing {no} and the <w:tc> containing {#nama_pegawai}
  // Then merge: put {#nama_pegawai} at start of the {no} cell
  
  // Actually simpler: just swap {no} text to be "{#nama_pegawai}{no}" 
  // and remove {#nama_pegawai} from its current cell (replace with empty or {nama_pegawai})
  
  // Let's find and replace in the XML
  // Step 1: Replace {no} with {#nama_pegawai}{no}
  docXml = docXml.replace(
    /(<w:t[^>]*>)\{no\}(<\/w:t>)/,
    '$1{#nama_pegawai}{no}$2'
  );
  
  // Step 2: Remove the standalone {#nama_pegawai} (which is now in another cell)
  // It might be: <w:t>{#nama_pegawai}</w:t> followed by space and {nama_pegawai}
  // or just <w:t>{#nama_pegawai}</w:t> alone
  // We want to remove ONLY the {#nama_pegawai} part, keep {nama_pegawai} if present
  
  // Find: {#nama_pegawai} that is NOT preceded by {no}
  // Since we already merged one, the remaining standalone one needs to be removed
  docXml = docXml.replace(
    /(<w:t[^>]*>)\{#nama_pegawai\}(<\/w:t>)/,
    '$1$2' // Remove the tag content, keep the XML structure
  );

  // Verify
  const cleanAfter = docXml.replace(/<[^>]+>/g, '');
  console.log('Loop row text:');
  const loopMatch = cleanAfter.match(/.*\{#nama_pegawai\}.*?\{\/nama_pegawai\}/);
  if (loopMatch) {
    console.log(loopMatch[0].trim());
  }
  
  // Check for split tags
  const splits = docXml.match(/\{[^}]*<\/w:t>/g);
  if (splits) {
    console.log(`\n⚠️ ${splits.length} split tags remaining`);
  } else {
    console.log('\n✅ No split tags');
  }

  // Save
  zip.file('word/document.xml', docXml);
  const output = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(templatePath, output);
  console.log('✅ Template saved!');

} catch (err) {
  console.error('Error:', err.message);
}
