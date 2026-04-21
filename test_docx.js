const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

try {
    const templatePath = 'templates/sppdpenerimaan_template.docx';
    const content = fs.readFileSync(templatePath); 
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const templateData = {
      nomor_surat: "123",
      nama_desa: "Kembanglimus",
      nama_kecamatan: "Borobudur",
      nama_kabupaten: "Magelang",
      kepala_desa: "SOETJI ARIMBI",
      total_nominal: "Rp. 1.000",
      peserta: [
        {
          no: 1,
          nama_pegawai: "Test",
          gol: "-",
          tujuan: "Test",
          lama_perjalanan: "1",
          tgl_berangkat: "Test",
          tgl_kembali: "Test",
          nominal: "Rp. 1.000"
        }
      ],
      nama_pegawai: "Test",
      gol: "-",
      tujuan: "Test",
      lama_perjalanan: "1",
      tgl_berangkat: "Test",
      tgl_kembali: "Test",
      nominal: "Rp. 1.000"
    };

    doc.render(templateData);
    console.log("Success!");
} catch (error) {
    if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors.map(function (error) {
            return error.properties.explanation;
        }).join("\n");
        console.error('Syntax Errors:\n', errorMessages);
    } else {
        console.error('Error Details:', error);
    }
}
