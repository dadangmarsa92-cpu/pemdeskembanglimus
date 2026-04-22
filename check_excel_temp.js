const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

function checkHierarchy() {
    const bidangPath = path.join(__dirname, 'templates', 'daftar_bidang.xlsx');
    const hierarchyPath = path.join(__dirname, 'templates', 'daftar_sub__sub_bidang.xlsx');

    let bidangData = [];
    if (fs.existsSync(bidangPath)) {
      const wb = XLSX.readFile(bidangPath);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      bidangData = rows
        .filter(r => r[1]) // only rows with a bidang name
        .map(r => ({ no: r[0], nama_bidang: r[1] }));
    }

    console.log('Bidang Data:', JSON.stringify(bidangData, null, 2));
}

checkHierarchy();
