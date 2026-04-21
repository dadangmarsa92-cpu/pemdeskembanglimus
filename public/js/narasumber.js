let narasumberIdToDelete = null;
let isNaraEditMode = false;
let naraEditingId = null;
let lastSavedNaraId = null;

document.addEventListener('DOMContentLoaded', () => {
    initNarasumberPage();
});

function initNarasumberPage() {
    const form = document.getElementById('narasumberForm');
    const btnCancel = document.getElementById('btnCancelNarasumber');

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            resetNarasumberForm();
            loadNextNaraNumber();
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveNarasumber();
        });
    }

    // Initialize Datepickers
    const dateConfig = {
        dateFormat: "d/m/Y",
        disableMobile: true,
        allowInput: true
    };
    
    if (document.getElementById('naraTanggalSurat')) flatpickr("#naraTanggalSurat", dateConfig);
    if (document.getElementById('naraTanggal')) flatpickr("#naraTanggal", dateConfig);

    // Initial load
    loadNarasumberData();
    loadNextNaraNumber();

    // ── Input Validations: Title Case (Capital at start of each word) ──
    const titleCaseFields = ['naraNama', 'naraBidang', 'naraKegiatan', 'naraTempat'];
    titleCaseFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('blur', () => {
                if (el.value) {
                    el.value = el.value.toLowerCase().split(' ').map(word => {
                        return word.charAt(0).toUpperCase() + word.slice(1);
                    }).join(' ');
                }
            });
        }
    });
}

function resetNarasumberForm() {
    document.getElementById('narasumberForm').reset();
    document.getElementById('narasumberEditId').value = '';
    document.getElementById('narasumberFormTitle').textContent = '📝 Input Data Narasumber';
    document.getElementById('btnSaveNarasumberText').textContent = 'Simpan Data';
}

async function loadNextNaraNumber() {
    try {
        const res = await fetch('/api/narasumber/next-number');
        const result = await res.json();
        if (result.success) {
            document.getElementById('naraNomor').value = result.nomor;
        }
    } catch (err) {
        console.error('Gagal memuat nomor narasumber:', err);
        showToast('Gagal memuat nomor otomatis. Cek koneksi server.', 'warning');
        document.getElementById('naraNomor').placeholder = 'Masukkan nomor secara manual';
        document.getElementById('naraNomor').readOnly = false;
        document.getElementById('naraNomor').style.opacity = '1';
        document.getElementById('naraNomor').style.cursor = 'text';
    }
}

async function loadNarasumberData() {
    try {
        const res = await fetch('/api/narasumber');
        const result = await res.json();
        const tbody = document.getElementById('narasumberTableBody');
        const emptyState = document.getElementById('narasumberEmptyState');

        tbody.innerHTML = '';

        if (result.success && result.data.length > 0) {
            emptyState.style.display = 'none';
            result.data.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td><strong>${item.nomor_surat}</strong></td>
                    <td>${item.nama_narasumber}</td>
                    <td>${item.kegiatan}</td>
                    <td>${formatDateID(item.tanggal_pelaksanaan)}</td>
                    <td>
                        <div class="action-btns">
                            <a href="/api/narasumber/generate-docx/${item.id}" class="btn-action btn-word" title="Unduh Word" style="background:#2b579a; color:white; text-decoration:none; display:flex; align-items:center; justify-content:center;">
                                📄
                            </a>
                            <button class="btn-action btn-edit" onclick="editNarasumber(${item.id})" title="Edit">✏️</button>
                            <button class="btn-action btn-delete" onclick="konfirmasiHapusNara(${item.id})" title="Hapus">🗑️</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            document.getElementById('statNarasumberTotal').textContent = result.data.length;
        } else {
            emptyState.style.display = 'block';
            document.getElementById('statNarasumberTotal').textContent = '0';
        }
    } catch (err) {
        console.error('Gagal memuat data narasumber:', err);
    }
}

async function saveNarasumber() {
    const id = document.getElementById('narasumberEditId').value;
    const data = {
        nomor_surat: document.getElementById('naraNomor').value,
        tanggal_surat: reformatToISO(document.getElementById('naraTanggalSurat').value),
        nama_narasumber: document.getElementById('naraNama').value,
        bidang: document.getElementById('naraBidang').value,
        kegiatan: document.getElementById('naraKegiatan').value,
        tempat_pelaksanaan: document.getElementById('naraTempat').value,
        tanggal_pelaksanaan: reformatToISO(document.getElementById('naraTanggal').value),
        waktu_pelaksanaan: document.getElementById('naraWaktu').value
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/narasumber/${id}` : '/api/narasumber';

    try {
        const btn = document.getElementById('btnSaveNarasumber');
        btn.disabled = true;
        document.getElementById('btnSaveNarasumberText').textContent = 'Menyimpan...';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
            showToast(result.message, 'success');
            resetNarasumberForm();
            loadNextNaraNumber();
            loadNarasumberData();
            if (typeof loadStats === 'function') loadStats();
            
            // If new record, show docx download option
            if (!id) {
                lastSavedNaraId = result.id;
                openNaraPrintModal(result.id);
            }
        } else {
            showToast(result.message, 'error');
        }
    } catch (err) {
        showToast('Gagal menyimpan data.', 'error');
    } finally {
        document.getElementById('btnSaveNarasumber').disabled = false;
        document.getElementById('btnSaveNarasumberText').textContent = isNaraEditMode ? 'Update Data' : 'Simpan Data';
    }
}

async function editNarasumber(id) {
    try {
        const res = await fetch(`/api/narasumber/${id}`);
        const result = await res.json();
        if (result.success) {
            const d = result.data;
            isNaraEditMode = true;
            naraEditingId = id;
            
            document.getElementById('narasumberEditId').value = id;
            document.getElementById('naraNomor').value = d.nomor_surat;
            document.getElementById('naraNama').value = d.nama_narasumber;
            document.getElementById('naraBidang').value = d.bidang;
            document.getElementById('naraKegiatan').value = d.kegiatan;
            document.getElementById('naraTempat').value = d.tempat_pelaksanaan;
            document.getElementById('naraWaktu').value = d.waktu_pelaksanaan;

            if (document.getElementById('naraTanggalSurat')._flatpickr) {
                document.getElementById('naraTanggalSurat')._flatpickr.setDate(new Date(d.tanggal_surat));
            }
            if (document.getElementById('naraTanggal')._flatpickr) {
                document.getElementById('naraTanggal')._flatpickr.setDate(new Date(d.tanggal_pelaksanaan));
            }

            document.getElementById('narasumberFormTitle').textContent = '✏️ Edit Data Narasumber';
            document.getElementById('btnSaveNarasumberText').textContent = 'Update Data';
            
            document.getElementById('narasumberFormCard').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (err) {
        showToast('Gagal memuat data edit.', 'error');
    }
}

function konfirmasiHapusNara(id) {
    // Reuse SPPD delete modal logic or separate it
    // For simplicity, let's just use window.confirm for now or implement a specific modal
    if (confirm('Apakah Anda yakin ingin menghapus data narasumber ini?')) {
        executeNaraDeletion(id);
    }
}

async function executeNaraDeletion(id) {
    try {
        const res = await fetch(`/api/narasumber/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            showToast('Data berhasil dihapus.', 'success');
            loadNarasumberData();
            if (typeof loadStats === 'function') loadStats();
        }
    } catch (err) {
        showToast('Gagal menghapus data.', 'error');
    }
}

function openNaraPrintModal(id) {
    const modal = document.getElementById('printModal');
    const btnWord = document.getElementById('btnDownloadWord');
    const p = modal.querySelector('p');
    
    p.textContent = 'Apakah Anda ingin mengunduh Surat Narasumber ini dalam format Word?';
    btnWord.onclick = null;
    btnWord.href = `/api/narasumber/generate-docx/${id}`;
    
    modal.classList.add('active');
}
