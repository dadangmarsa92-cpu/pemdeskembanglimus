// ============================================================
// SURAT AHLI WARIS PAGE LOGIC
// ============================================================

let ahliWarisIdToDelete = null;
let isAhliWarisEditMode = false;
let ahliWarisEditingId = null;

document.addEventListener('DOMContentLoaded', () => {
    initAhliWarisPage();
});

function initAhliWarisPage() {
    const form = document.getElementById('ahliWarisForm');
    const btnCancel = document.getElementById('btnCancelAhliWaris');

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            resetAhliWarisForm();
            loadNextAhliWarisNumber();
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveAhliWaris();
        });
    }

    // Initialize Datepickers
    const dateConfig = {
        dateFormat: "d/m/Y",
        disableMobile: true,
        allowInput: true
    };
    
    if (document.getElementById('ahliWarisTanggalSurat')) flatpickr("#ahliWarisTanggalSurat", dateConfig);
    if (document.getElementById('ahliWarisTglLahirPewaris')) flatpickr("#ahliWarisTglLahirPewaris", dateConfig);
    if (document.getElementById('ahliWarisTglMeninggal')) flatpickr("#ahliWarisTglMeninggal", dateConfig);
}

function resetAhliWarisForm() {
    document.getElementById('ahliWarisForm').reset();
    document.getElementById('ahliWarisEditId').value = '';
    document.getElementById('ahliWarisFormTitle').textContent = '📝 Input Surat Ahli Waris';
    document.getElementById('btnSaveAhliWarisText').textContent = 'Simpan Data';
    isAhliWarisEditMode = false;
    ahliWarisEditingId = null;
}

async function loadNextAhliWarisNumber() {
    try {
        const res = await fetch('/api/surat-ahli-waris/next-number');
        const result = await res.json();
        if (result.success) {
            document.getElementById('ahliWarisNomor').value = result.nomor;
        }
    } catch (err) {
        console.error('Gagal memuat nomor surat ahli waris:', err);
        document.getElementById('ahliWarisNomor').placeholder = 'Masukkan nomor secara manual';
        document.getElementById('ahliWarisNomor').readOnly = false;
        document.getElementById('ahliWarisNomor').style.opacity = '1';
        document.getElementById('ahliWarisNomor').style.cursor = 'text';
    }
}

async function loadAhliWarisData() {
    try {
        const res = await fetch('/api/surat-ahli-waris');
        const result = await res.json();
        const tbody = document.getElementById('ahliWarisTableBody');
        const emptyState = document.getElementById('ahliWarisEmptyState');

        tbody.innerHTML = '';

        if (result.success && result.data.length > 0) {
            emptyState.style.display = 'none';
            result.data.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td><strong>${item.nomor_surat}</strong></td>
                    <td>${item.nama_pewaris}</td>
                    <td>${item.nama_ahli_waris}</td>
                    <td><span class="role-badge user">${item.hubungan}</span></td>
                    <td>${formatDateID(item.tanggal_surat)}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-action btn-edit" onclick="editAhliWaris(${item.id})" title="Edit">✏️</button>
                            <button class="btn-action btn-delete" onclick="konfirmasiHapusAhliWaris(${item.id})" title="Hapus">🗑️</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            document.getElementById('statAhliWarisTotal').textContent = result.data.length;
        } else {
            emptyState.style.display = 'block';
            document.getElementById('statAhliWarisTotal').textContent = '0';
        }
    } catch (err) {
        console.error('Gagal memuat data surat ahli waris:', err);
    }
}

async function saveAhliWaris() {
    const id = document.getElementById('ahliWarisEditId').value;
    const data = {
        nomor_surat: document.getElementById('ahliWarisNomor').value,
        tanggal_surat: reformatToISO(document.getElementById('ahliWarisTanggalSurat').value),
        nama_pewaris: document.getElementById('ahliWarisNamaPewaris').value,
        tempat_lahir_pewaris: document.getElementById('ahliWarisTempatLahirPewaris').value,
        tgl_lahir_pewaris: reformatToISO(document.getElementById('ahliWarisTglLahirPewaris').value),
        tgl_meninggal: reformatToISO(document.getElementById('ahliWarisTglMeninggal').value),
        alamat_pewaris: document.getElementById('ahliWarisAlamatPewaris').value,
        nama_ahli_waris: document.getElementById('ahliWarisNamaAhliWaris').value,
        hubungan: document.getElementById('ahliWarisHubungan').value,
        nik_ahli_waris: document.getElementById('ahliWarisNIK').value,
        alamat_ahli_waris: document.getElementById('ahliWarisAlamatAhliWaris').value,
        keterangan: document.getElementById('ahliWarisKeterangan').value || ''
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/surat-ahli-waris/${id}` : '/api/surat-ahli-waris';

    try {
        const btn = document.getElementById('btnSaveAhliWaris');
        btn.disabled = true;
        document.getElementById('btnSaveAhliWarisText').textContent = 'Menyimpan...';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
            showToast(result.message, 'success');
            resetAhliWarisForm();
            loadNextAhliWarisNumber();
            loadAhliWarisData();
        } else {
            showToast(result.message, 'error');
        }
    } catch (err) {
        showToast('Gagal menyimpan data.', 'error');
    } finally {
        document.getElementById('btnSaveAhliWaris').disabled = false;
        document.getElementById('btnSaveAhliWarisText').textContent = isAhliWarisEditMode ? 'Update Data' : 'Simpan Data';
    }
}

async function editAhliWaris(id) {
    try {
        const res = await fetch(`/api/surat-ahli-waris/${id}`);
        const result = await res.json();
        if (result.success) {
            const d = result.data;
            isAhliWarisEditMode = true;
            ahliWarisEditingId = id;
            
            document.getElementById('ahliWarisEditId').value = id;
            document.getElementById('ahliWarisNomor').value = d.nomor_surat;
            document.getElementById('ahliWarisNamaPewaris').value = d.nama_pewaris;
            document.getElementById('ahliWarisTempatLahirPewaris').value = d.tempat_lahir_pewaris;
            document.getElementById('ahliWarisAlamatPewaris').value = d.alamat_pewaris;
            document.getElementById('ahliWarisNamaAhliWaris').value = d.nama_ahli_waris;
            document.getElementById('ahliWarisHubungan').value = d.hubungan;
            document.getElementById('ahliWarisNIK').value = d.nik_ahli_waris;
            document.getElementById('ahliWarisAlamatAhliWaris').value = d.alamat_ahli_waris;
            document.getElementById('ahliWarisKeterangan').value = d.keterangan || '';

            if (document.getElementById('ahliWarisTanggalSurat')._flatpickr) {
                document.getElementById('ahliWarisTanggalSurat')._flatpickr.setDate(new Date(d.tanggal_surat));
            }
            if (document.getElementById('ahliWarisTglLahirPewaris')._flatpickr) {
                document.getElementById('ahliWarisTglLahirPewaris')._flatpickr.setDate(new Date(d.tgl_lahir_pewaris));
            }
            if (document.getElementById('ahliWarisTglMeninggal')._flatpickr) {
                document.getElementById('ahliWarisTglMeninggal')._flatpickr.setDate(new Date(d.tgl_meninggal));
            }

            document.getElementById('ahliWarisFormTitle').textContent = '✏️ Edit Surat Ahli Waris';
            document.getElementById('btnSaveAhliWarisText').textContent = 'Update Data';
            
            document.getElementById('ahliWarisFormCard').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (err) {
        showToast('Gagal memuat data edit.', 'error');
    }
}

function konfirmasiHapusAhliWaris(id) {
    if (confirm('Apakah Anda yakin ingin menghapus data surat ahli waris ini?')) {
        executeAhliWarisDeletion(id);
    }
}

async function executeAhliWarisDeletion(id) {
    try {
        const res = await fetch(`/api/surat-ahli-waris/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            showToast('Data berhasil dihapus.', 'success');
            loadAhliWarisData();
        }
    } catch (err) {
        showToast('Gagal menghapus data.', 'error');
    }
}
