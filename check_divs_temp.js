const fs = require('fs');
const html = fs.readFileSync('public/dashboard.html', 'utf8');

const contentIdx = html.indexOf('<div class="dashboard-content">');
const content = html.substring(contentIdx);
const sections = ['page-dashboard', 'page-sppd', 'page-sppdpenerimaan', 'page-rab', 'page-daftar-hadir', 'page-ijin-keramaian', 'page-ijin-tempat', 'page-surat-ahli-waris', 'page-pengantar-nikah', 'page-rak-kegiatan', 'page-rak-kalender', 'page-pengaturan'];

sections.forEach(id => {
    let idx = content.indexOf('<div id="' + id);
    if (idx === -1) idx = content.indexOf('<div class="page-section" id="' + id);
    if (idx > -1) {
        const sub = content.substring(0, idx);
        const opens = (sub.match(/<div/g) || []).length;
        const closes = (sub.match(/<\/div>/g) || []).length;
        console.log(id, opens - closes);
    } else {
        console.log(id, "NOT FOUND");
    }
});
