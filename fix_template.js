/**
 * Fix split tags in sppdpenerimaan_template.docx
 * 
 * Problem: Microsoft Word splits {tag_name} across multiple <w:t> elements,
 * e.g., <w:t>{</w:t></w:r><w:r><w:t>nama_pegawai</w:t></w:r><w:r><w:t>}</w:t>
 * 
 * This script merges them back into single <w:t>{tag_name}</w:t> elements.
 */
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'templates', 'sppdpenerimaan_template.docx');
const outputPath = path.join(__dirname, 'templates', 'sppdpenerimaan_template.docx'); // overwrite

try {
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  let docXml = zip.files['word/document.xml'].asText();

  console.log('=== BEFORE FIX ===');
  const beforeClean = docXml.replace(/<[^>]+>/g, '');
  const beforeTags = [...beforeClean.matchAll(/\{[^}]+\}/g)].map(m => m[0]);
  console.log('Tags found:', beforeTags);

  // Strategy: Find all { ... } patterns that are split across <w:r>/<w:t> elements
  // and merge them into a single <w:r><w:t>{complete_tag}</w:t></w:r>
  
  // This regex finds a { in a <w:t>, then any XML elements in between, then the closing }
  // We need to handle cases like:
  //   <w:t>{</w:t></w:r>...<w:r>...<w:t>tag_name</w:t></w:r>...<w:r>...<w:t>}</w:t>
  //   <w:t>{#</w:t></w:r>...<w:r>...<w:t>tag_name</w:t></w:r>...<w:r>...<w:t>}</w:t>
  //   <w:t>{/</w:t></w:r>...<w:r>...<w:t>tag_name</w:t></w:r>...<w:r>...<w:t>}</w:t>

  // Step 1: Find sequences that contain a split tag pattern
  // Match from an opening { (possibly followed by # or /) inside a <w:t>, 
  // through intermediate XML, to a closing } in a <w:t>
  const splitTagRegex = /(<w:r[ >][^]*?<w:t[^>]*>)\{([#/]?)(<\/w:t>.*?<w:t[^>]*>)(.*?)(<\/w:t>.*?<w:t[^>]*>)\}(<\/w:t>)/gs;
  
  // More robust approach: extract all text content between <w:t> tags,
  // rebuild them if they form a complete {tag}
  
  // Actually, let's use a simpler, proven approach:
  // Replace the raw XML by finding patterns where { and } are in different <w:t> blocks
  
  function fixSplitTags(xml) {
    // This approach works by:
    // 1. Finding all <w:t> content
    // 2. If a <w:t> contains { but no }, look ahead for the matching }
    // 3. Merge everything between into a single <w:t>
    
    let result = xml;
    let changed = true;
    let iterations = 0;
    
    while (changed && iterations < 50) {
      changed = false;
      iterations++;
      
      // Pattern: <w:t>{something</w:t> followed by more XML then <w:t>more}</w:t>
      // We need to handle the entire <w:r> element wrapping
      
      // Match: a <w:t> containing { but not }, followed by XML, then <w:t> containing }
      // Capture the text parts to reconstruct the tag
      const pattern = /(<w:t[^>]*>)(\{[#/]?)(<\/w:t><\/w:r>)(.*?)(<w:r[^>]*><w:rPr>.*?<\/w:rPr><w:t[^>]*>)(.*?\})(<\/w:t>)/s;
      
      const match = result.match(pattern);
      if (match) {
        const fullTag = match[2] + match[6]; // e.g., {#nama_pegawai} or {tujuan}
        // Keep the first w:r's formatting, replace content with full tag
        const replacement = match[1] + fullTag + match[7];
        result = result.replace(match[0], replacement);
        changed = true;
        console.log(`  Fixed split tag: ${fullTag}`);
      }
    }
    
    return result;
  }

  // More aggressive fix: use a state machine approach
  function fixSplitTagsV2(xml) {
    // Find all positions where <w:t> content contains { without }
    // Then scan forward to find the closing }
    // Merge all text content between them
    
    // Split on <w:t and rebuild
    const parts = xml.split(/(<w:t[^>]*>)/);
    let i = 0;
    let result = '';
    
    while (i < parts.length) {
      const part = parts[i];
      
      // Check if this is a <w:t> tag
      if (part.match(/^<w:t[^>]*>$/)) {
        // Next part is the content
        const content = parts[i + 1] || '';
        
        // Check if content has { but no }
        if (content.includes('{') && !content.includes('}')) {
          // We have an unclosed tag - scan forward
          let fullText = content.split('</w:t>')[0]; // text before closing </w:t>
          let j = i + 2;
          
          // Scan forward through parts to find the closing }
          while (j < parts.length) {
            if (parts[j].match(/^<w:t[^>]*>$/)) {
              // Another <w:t> tag, get its content
              const nextContent = parts[j + 1] || '';
              const textPart = nextContent.split('</w:t>')[0];
              fullText += textPart;
              
              if (textPart.includes('}')) {
                // Found the closing brace! 
                // Now replace everything from i to j+1 with merged content
                const afterClosingBrace = nextContent.substring(nextContent.indexOf('</w:t>'));
                result += part + fullText + afterClosingBrace;
                
                // Skip all the intermediate parts
                i = j + 2;
                console.log(`  Merged split tag: ${fullText.match(/\{[^}]+\}/)?.[0] || fullText}`);
                break;
              }
              j += 2;
            } else {
              // Not a <w:t> tag, skip (but we lose the intermediate XML formatting)
              j++;
            }
          }
          
          if (j >= parts.length) {
            // Didn't find closing }, just output as-is
            result += part + parts[i + 1];
            i += 2;
          }
        } else {
          result += part + (parts[i + 1] || '');
          i += 2;
        }
      } else {
        result += part;
        i++;
      }
    }
    
    return result;
  }
  
  docXml = fixSplitTagsV2(docXml);
  
  // Verify
  console.log('\n=== AFTER FIX ===');
  const afterClean = docXml.replace(/<[^>]+>/g, '');
  const afterTags = [...afterClean.matchAll(/\{[^}]+\}/g)].map(m => m[0]);
  console.log('Tags found:', afterTags);
  
  // Check for remaining split tags
  const remainingSplits = docXml.match(/\{[^}]*<\/w:t>/g);
  if (remainingSplits) {
    console.log('\n⚠️  Still has split tags:', remainingSplits.length);
  } else {
    console.log('\n✅ All tags are now properly merged!');
  }
  
  // Save
  zip.file('word/document.xml', docXml);
  const output = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outputPath, output);
  console.log(`\n✅ Fixed template saved to: ${outputPath}`);
  
} catch (err) {
  console.error('Error:', err.message);
  console.error(err.stack);
}
