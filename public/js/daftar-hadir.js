/**
 * Logika UI untuk Halaman Daftar Hadir & Penerimaan
 */

document.addEventListener('DOMContentLoaded', () => {
    // ── TAB SWITCHING LOGIC ──
    const tabs = document.querySelectorAll('#daftarHadirTabs .tab-btn');
    const contents = document.querySelectorAll('.dh-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Hapus kelas aktif dari semua tab
            tabs.forEach(t => t.classList.remove('active'));
            // Sembunyikan semua konten
            contents.forEach(c => c.style.display = 'none');

            // Tambahkan kelas aktif pada tab yang diklik
            tab.classList.add('active');
            
            // Tampilkan konten yang sesuai
            const targetId = `dh-${tab.getAttribute('data-tab')}`;
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.style.display = 'block';
            }
        });
    });

    // ── INITIALIZE FLATPICKR ──
    if (document.getElementById('dhHariTanggal')) {
        flatpickr('#dhHariTanggal', {
            dateFormat: "l, d F Y",
            locale: "id"
        });
    }
    
    if (document.getElementById('dpHariTanggal')) {
        flatpickr('#dpHariTanggal', {
            dateFormat: "l, d F Y",
            locale: "id"
        });
    }
});

// ── FUNGSI CETAK DAFTAR HADIR PESERTA ──
window.cetakDaftarHadirPeserta = async function() {
    const btn = document.querySelector('#dh-peserta .btn-save');
    const originalText = btn.innerHTML;
    
    try {
        const payload = {
            hari_tanggal_pelaksanaan: document.getElementById('dhHariTanggal').value.trim(),
            judul_kegiatan: document.getElementById('dhJudulKegiatan').value.trim(),
            nama_pelaksana_kegiatan: document.getElementById('dhNamaPelaksana').value.trim(),
            jumlah_baris: parseInt(document.getElementById('dhJumlahBaris').value) || 10
        };
        
        btn.innerHTML = 'Mencetak...';
        btn.disabled = true;
        
        const response = await fetch('/api/cetak/daftar-hadir-peserta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (result.success) {
            window.location.href = result.downloadUrl;
        } else {
            alert('Gagal mencetak: ' + result.message);
        }
    } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan sistem saat mencetak.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// ── FUNGSI CETAK DAFTAR PENERIMAAN ──
window.cetakDaftarPenerimaan = async function() {
    const btn = document.querySelector('#dh-penerimaan .btn-save');
    const originalText = btn.innerHTML;
    
    try {
        const payload = {
            hari_tanggal_pelaksanaan: document.getElementById('dpHariTanggal').value.trim(),
            judul_kegiatan: document.getElementById('dpJudulKegiatan').value.trim(),
            pelaksana_kegiatan: document.getElementById('dpPelaksana').value.trim(),
            nominal: parseFloat(document.getElementById('dpNominal').value) || 0,
            jumlah_baris: parseInt(document.getElementById('dpJumlahBaris').value) || 10
        };
        
        btn.innerHTML = 'Mencetak...';
        btn.disabled = true;
        
        const response = await fetch('/api/cetak/daftar-penerimaan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (result.success) {
            window.location.href = result.downloadUrl;
        } else {
            alert('Gagal mencetak: ' + result.message);
        }
    } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan sistem saat mencetak.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};
