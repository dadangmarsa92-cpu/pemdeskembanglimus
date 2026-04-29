// ============================================================
// IJIN KERAMAIAN & IJIN TEMPAT PAGE LOGIC
// ============================================================

// ── State ──
let isIKEditMode = false;
let ikEditingId = null;
let isITEditMode = false;
let itEditingId = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initIjinKeramaianPage();
});

function initIjinKeramaianPage() {
    // ── Tab switching for Ijin Keramaian page ──
    const ikTabs = document.getElementById('ijinKeramaianTabs');
    if (ikTabs) {
        ikTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            const tabId = btn.dataset.tab;

            ikTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.ik-tab-content').forEach(c => c.style.display = 'none');
            const targetTab = document.getElementById(tabId);
            if (targetTab) targetTab.style.display = 'block';

            // Load data when switching tabs
            if (tabId === 'ik-keramaian') loadIjinKeramaianData();
            if (tabId === 'ik-tempat') loadIjinTempatData();
        });
    }

    // ── Ijin Keramaian Form ──
    const ikForm = document.getElementById('ijinKeramaianForm');
    if (ikForm) {
        ikForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveIjinKeramaian();
        });
    }

    const ikBtnCancel = document.getElementById('btnCancelIjinKeramaian');
    if (ikBtnCancel) {
        ikBtnCancel.addEventListener('click', () => {
            resetIjinKeramaianForm();
            loadNextIKNumber();
        });
    }

    // ── Ijin Tempat Form ──
    const itForm = document.getElementById('ijinTempatForm');
    if (itForm) {
        itForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveIjinTempat();
        });
    }

    const itBtnCancel = document.getElementById('btnCancelIjinTempat');
    if (itBtnCancel) {
        itBtnCancel.addEventListener('click', () => {
            resetIjinTempatForm();
        });
    }

    // ── Flatpickr Date Pickers ──
    const dateConfig = { dateFormat: "d/m/Y", disableMobile: true, allowInput: true };
    if (document.getElementById('ikTanggalSurat'))        flatpickr('#ikTanggalSurat',        dateConfig);
    if (document.getElementById('ikTanggalLahir'))        flatpickr('#ikTanggalLahir',        dateConfig);
    if (document.getElementById('itTanggalSurat'))        flatpickr('#itTanggalSurat',        dateConfig);
    if (document.getElementById('itTanggalLahirPemilik')) flatpickr('#itTanggalLahirPemilik', dateConfig);

    // ── Flatpickr untuk Hari/Tanggal Acara (output nama hari + tanggal Indonesia) ──
    const hariTanggalConfig = {
        dateFormat: 'Y-m-d',
        disableMobile: true,
        allowInput: false,
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length > 0) {
                const formatted = formatHariTanggalID(selectedDates[0]);
                // Simpan nilai yang terformat ke hidden field
                const hiddenId = instance.element.id + '_value';
                const hidden = document.getElementById(hiddenId);
                if (hidden) hidden.value = formatted;
                // Tampilkan di input
                instance.element.value = formatted;
            }
        }
    };
    if (document.getElementById('ikHariTanggalAcara')) {
        flatpickr('#ikHariTanggalAcara', hariTanggalConfig);
    }
    if (document.getElementById('itHariTanggalAcara')) {
        flatpickr('#itHariTanggalAcara', hariTanggalConfig);
    }
}

// Called from dashboard.js when page-ijin-keramaian or page-ijin-tempat is activated
function onPageIjinKeramaianActivated() {
    loadNextIKNumber();
    loadIjinKeramaianData();
}
function onPageIjinTempatActivated() {
    // Switch to ijin-tempat tab automatically
    const ikTabs = document.getElementById('ijinKeramaianTabs');
    if (ikTabs) {
        ikTabs.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === 'ik-tempat');
        });
    }
    document.querySelectorAll('.ik-tab-content').forEach(c => c.style.display = 'none');
    const tab = document.getElementById('ik-tempat');
    if (tab) tab.style.display = 'block';

    loadIjinTempatData();
}

// ============================================================
// IJIN KERAMAIAN — CRUD
// ============================================================

async function loadNextIKNumber() {
    try {
        const res = await fetch('/api/ijin-keramaian/next-number');
        const result = await res.json();
        if (result.success) {
            const el = document.getElementById('ikNomor');
            if (el) el.value = result.nomor;
        }
    } catch (err) {
        console.error('Gagal memuat nomor surat ijin keramaian:', err);
        const el = document.getElementById('ikNomor');
        if (el) {
            el.placeholder = 'Masukkan nomor secara manual';
            el.readOnly = false;
            el.style.opacity = '1';
            el.style.cursor = 'text';
        }
    }
}

async function loadIjinKeramaianData() {
    try {
        const res = await fetch('/api/ijin-keramaian');
        const result = await res.json();
        const tbody = document.getElementById('ijinKeramaianTableBody');
        const emptyState = document.getElementById('ijinKeramaianEmptyState');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (result.success && result.data.length > 0) {
            emptyState.style.display = 'none';
            result.data.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td><strong>${item.nomor_surat}</strong></td>
                    <td>${item.nama_pemohon}</td>
                    <td>${item.nama_acara}</td>
                    <td>${item.hari_tanggal_acara}</td>
                    <td>${item.lokasi_acara}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-action btn-edit" onclick="editIjinKeramaian(${item.id})" title="Edit">✏️</button>
                            <button class="btn-action" style="background:rgba(43,87,154,0.12); color:#2b579a;" onclick="cetakIjinKeramaian(${item.id})" title="Cetak DOCX">📄</button>
                            <button class="btn-action btn-delete" onclick="hapusIjinKeramaian(${item.id})" title="Hapus">🗑️</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            const statEl = document.getElementById('statIjinKeramaianTotal');
            if (statEl) statEl.textContent = result.data.length;
        } else {
            emptyState.style.display = 'block';
            const statEl = document.getElementById('statIjinKeramaianTotal');
            if (statEl) statEl.textContent = '0';
        }
    } catch (err) {
        console.error('Gagal memuat data ijin keramaian:', err);
    }
}

async function saveIjinKeramaian() {
    const id = document.getElementById('ijinKeramaianEditId').value;
    const nomorSurat        = document.getElementById('ikNomor').value;
    const nomorIjin         = document.getElementById('ikNomorIjin').value || '';
    const tanggalSurat      = document.getElementById('ikTanggalSurat').value;
    const namaPemohon       = document.getElementById('ikNamaPemohon').value.trim();
    const nikPemohon        = document.getElementById('ikNIKPemohon').value.trim();
    const tempatLahir       = document.getElementById('ikTempatLahir').value.trim();
    const tanggalLahir      = document.getElementById('ikTanggalLahir').value;
    const jenisKelamin      = document.getElementById('ikJenisKelamin').value;
    const agama             = document.getElementById('ikAgama').value;
    const kewarganegaraan   = document.getElementById('ikKewarganegaraan').value.trim();
    const pekerjaan         = document.getElementById('ikPekerjaan').value.trim();
    const alamat            = document.getElementById('ikAlamat').value.trim();
    const namaAcara         = document.getElementById('ikNamaAcara').value.trim();
    const jenisAcara        = document.getElementById('ikJenisAcara').value || '';
    const jumlahPengunjung  = document.getElementById('ikJumlahPengunjung').value || '';
    const hariTanggalAcara  = document.getElementById('ikHariTanggalAcara').value || '';
    const waktuAcara        = document.getElementById('ikWaktuAcara').value.trim();
    const lokasiAcara       = document.getElementById('ikLokasiAcara').value.trim();

    // Validasi manual
    if (!tanggalSurat) return showToast('Tanggal Surat wajib diisi.', 'error');
    if (!namaPemohon) return showToast('Nama Pemohon wajib diisi.', 'error');
    if (!nikPemohon) return showToast('NIK Pemohon wajib diisi.', 'error');
    if (!tempatLahir) return showToast('Tempat Lahir wajib diisi.', 'error');
    if (!tanggalLahir) return showToast('Tanggal Lahir wajib diisi.', 'error');
    if (!jenisKelamin) return showToast('Jenis Kelamin wajib dipilih.', 'error');
    if (!agama) return showToast('Agama wajib dipilih.', 'error');
    if (!kewarganegaraan) return showToast('Kewarganegaraan wajib diisi.', 'error');
    if (!pekerjaan) return showToast('Pekerjaan wajib diisi.', 'error');
    if (!alamat) return showToast('Alamat wajib diisi.', 'error');
    if (!namaAcara) return showToast('Nama Acara wajib diisi.', 'error');
    if (!hariTanggalAcara) return showToast('Hari / Tanggal Acara wajib diisi.', 'error');
    if (!waktuAcara) return showToast('Waktu Acara wajib diisi.', 'error');
    if (!lokasiAcara) return showToast('Lokasi / Tempat Acara wajib diisi.', 'error');

    const data = {
        nomor_surat:             nomorSurat,
        nomor_ijin_keramaian:    nomorIjin,
        tanggal_surat:           reformatToISO(tanggalSurat),
        nama_pemohon:            namaPemohon,
        nik_pemohon:             nikPemohon,
        tempat_lahir_pemohon:    tempatLahir,
        tanggal_lahir_pemohon:   reformatToISO(tanggalLahir),
        jenis_kelamin_pemohon:   jenisKelamin,
        agama_pemohon:           agama,
        kewarganegaraan_pemohon: kewarganegaraan,
        pekerjaan_pemohon:       pekerjaan,
        alamat_pemohon:          alamat,
        nama_acara:              namaAcara,
        jenis_acara:             jenisAcara,
        jumlah_pengunjung:       jumlahPengunjung,
        hari_tanggal_acara:      hariTanggalAcara,
        waktu_acara:             waktuAcara,
        lokasi_acara:            lokasiAcara,
    };

    const method = id ? 'PUT' : 'POST';
    const url    = id ? `/api/ijin-keramaian/${id}` : '/api/ijin-keramaian';

    try {
        const btn = document.getElementById('btnSaveIjinKeramaian');
        btn.disabled = true;
        document.getElementById('btnSaveIjinKeramaianText').textContent = 'Menyimpan...';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
            showToast(result.message, 'success');
            resetIjinKeramaianForm();
            loadNextIKNumber();
            loadIjinKeramaianData();
        } else {
            showToast(result.message || 'Gagal menyimpan.', 'error');
        }
    } catch (err) {
        showToast('Gagal menyimpan data.', 'error');
    } finally {
        document.getElementById('btnSaveIjinKeramaian').disabled = false;
        document.getElementById('btnSaveIjinKeramaianText').textContent = isIKEditMode ? 'Update Data' : 'Simpan Data';
    }
}

async function editIjinKeramaian(id) {
    try {
        const res = await fetch(`/api/ijin-keramaian/${id}`);
        const result = await res.json();
        if (!result.success) return showToast('Gagal memuat data.', 'error');

        const d = result.data;
        isIKEditMode = true;
        ikEditingId = id;

        document.getElementById('ijinKeramaianEditId').value        = id;
        document.getElementById('ikNomor').value                    = d.nomor_surat;
        document.getElementById('ikNomor').readOnly                 = true;
        document.getElementById('ikNomorIjin').value                = d.nomor_ijin_keramaian || '';
        document.getElementById('ikNamaPemohon').value              = d.nama_pemohon;
        document.getElementById('ikNIKPemohon').value               = d.nik_pemohon;
        document.getElementById('ikTempatLahir').value              = d.tempat_lahir_pemohon;
        document.getElementById('ikJenisKelamin').value             = d.jenis_kelamin_pemohon;
        document.getElementById('ikAgama').value                    = d.agama_pemohon;
        document.getElementById('ikKewarganegaraan').value          = d.kewarganegaraan_pemohon;
        document.getElementById('ikPekerjaan').value                = d.pekerjaan_pemohon;
        document.getElementById('ikAlamat').value                   = d.alamat_pemohon;
        document.getElementById('ikNamaAcara').value                = d.nama_acara;
        document.getElementById('ikJenisAcara').value               = d.jenis_acara || '';
        document.getElementById('ikJumlahPengunjung').value         = d.jumlah_pengunjung || '';
        // Isi field hari/tanggal acara
        const ikHtaEl = document.getElementById('ikHariTanggalAcara');
        if (ikHtaEl) ikHtaEl.value = d.hari_tanggal_acara || '';
        if (ikHtaEl && ikHtaEl._flatpickr) ikHtaEl._flatpickr.setDate(d.hari_tanggal_acara, false);
        document.getElementById('ikWaktuAcara').value               = d.waktu_acara;
        document.getElementById('ikLokasiAcara').value              = d.lokasi_acara;

        if (document.getElementById('ikTanggalSurat')._flatpickr)
            document.getElementById('ikTanggalSurat')._flatpickr.setDate(new Date(d.tanggal_surat));
        if (document.getElementById('ikTanggalLahir')._flatpickr)
            document.getElementById('ikTanggalLahir')._flatpickr.setDate(new Date(d.tanggal_lahir_pemohon));

        document.getElementById('ijinKeramaianFormTitle').textContent = '✏️ Edit Data Ijin Keramaian';
        document.getElementById('btnSaveIjinKeramaianText').textContent = 'Update Data';
        document.getElementById('ijinKeramaianFormCard').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        showToast('Gagal memuat data edit.', 'error');
    }
}

async function hapusIjinKeramaian(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus data ijin keramaian ini?')) return;
    try {
        const res = await fetch(`/api/ijin-keramaian/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            showToast('Data berhasil dihapus.', 'success');
            loadIjinKeramaianData();
            loadNextIKNumber();
        } else {
            showToast(result.message || 'Gagal menghapus.', 'error');
        }
    } catch (err) {
        showToast('Gagal menghapus data.', 'error');
    }
}

async function cetakIjinKeramaian(id) {
    try {
        showToast('Membuat dokumen DOCX...', 'info');
        const res = await fetch(`/api/ijin-keramaian/generate-docx/${id}`);
        if (!res.ok) {
            const text = await res.text();
            showToast('Gagal membuat dokumen: ' + text, 'error');
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ijin_Keramaian_${id}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Dokumen berhasil diunduh.', 'success');
    } catch (err) {
        showToast('Gagal mengunduh dokumen.', 'error');
    }
}

function resetIjinKeramaianForm() {
    document.getElementById('ijinKeramaianForm').reset();
    document.getElementById('ijinKeramaianEditId').value = '';
    document.getElementById('ijinKeramaianFormTitle').textContent = '📝 Input Data Ijin Keramaian';
    document.getElementById('btnSaveIjinKeramaianText').textContent = 'Simpan Data';
    document.getElementById('ikKewarganegaraan').value = 'WNI';
    isIKEditMode = false;
    ikEditingId = null;

    const nomorEl = document.getElementById('ikNomor');
    if (nomorEl) {
        nomorEl.readOnly = true;
        nomorEl.style.opacity = '0.8';
        nomorEl.style.cursor = 'not-allowed';
    }
}

// ============================================================
// IJIN TEMPAT — CRUD
// ============================================================

async function loadIjinTempatData() {
    try {
        const res = await fetch('/api/ijin-tempat');
        const result = await res.json();
        const tbody = document.getElementById('ijinTempatTableBody');
        const emptyState = document.getElementById('ijinTempatEmptyState');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (result.success && result.data.length > 0) {
            emptyState.style.display = 'none';
            result.data.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${item.nama_pemilik_lahan}</td>
                    <td>${item.nik_pemilik_lahan}</td>
                    <td>${item.nama_acara}</td>
                    <td>${item.hari_tanggal_acara}</td>
                    <td>${item.tempat_acara}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-action btn-edit" onclick="editIjinTempat(${item.id})" title="Edit">✏️</button>
                            <button class="btn-action" style="background:rgba(43,87,154,0.12); color:#2b579a;" onclick="cetakIjinTempat(${item.id})" title="Cetak DOCX">📄</button>
                            <button class="btn-action btn-delete" onclick="hapusIjinTempat(${item.id})" title="Hapus">🗑️</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            const statEl = document.getElementById('statIjinTempatTotal');
            if (statEl) statEl.textContent = result.data.length;
        } else {
            emptyState.style.display = 'block';
            const statEl = document.getElementById('statIjinTempatTotal');
            if (statEl) statEl.textContent = '0';
        }
    } catch (err) {
        console.error('Gagal memuat data ijin tempat:', err);
    }
}

async function saveIjinTempat() {
    const id = document.getElementById('ijinTempatEditId').value;

    // Kumpulkan nilai field
    const tanggalSurat      = document.getElementById('itTanggalSurat').value;
    const namaPemilik       = document.getElementById('itNamaPemilikLahan').value.trim();
    const nikPemilik        = document.getElementById('itNIKPemilik').value.trim();
    const tempatLahir       = document.getElementById('itTempatLahirPemilik').value.trim();
    const tanggalLahir      = document.getElementById('itTanggalLahirPemilik').value;
    const pekerjaan         = document.getElementById('itPekerjaanPemilik').value.trim();
    const jabatan           = document.getElementById('itJabatanPemilik').value || '-';
    const alamatPemilik     = document.getElementById('itAlamatPemilik').value.trim();
    const namaAcara         = document.getElementById('itNamaAcara').value.trim();
    const hariTanggalAcara  = document.getElementById('itHariTanggalAcara').value.trim();
    const waktuAcara        = document.getElementById('itWaktuAcara').value.trim();
    const tempatAcara       = document.getElementById('itTempatAcara').value.trim();

    // Validasi manual
    if (!tanggalSurat) return showToast('Tanggal Surat wajib diisi.', 'error');
    if (!namaPemilik)  return showToast('Nama Pemilik Lahan wajib diisi.', 'error');
    if (!nikPemilik)   return showToast('NIK Pemilik wajib diisi.', 'error');
    if (!namaAcara)    return showToast('Nama Acara wajib diisi.', 'error');
    if (!hariTanggalAcara) return showToast('Hari/Tanggal Acara wajib diisi.', 'error');
    if (!waktuAcara)   return showToast('Waktu Acara wajib diisi.', 'error');
    if (!tempatAcara)  return showToast('Tempat Acara wajib diisi.', 'error');

    const data = {
        tanggal_surat:               reformatToISO(tanggalSurat),
        nama_pemilik_lahan:          namaPemilik,
        nik_pemilik_lahan:           nikPemilik,
        tempat_lahir_pemilik_lahan:  tempatLahir || '',
        tanggal_lahir_pemilik_lahan: tanggalLahir ? reformatToISO(tanggalLahir) : '',
        pekerjaan_pemilik_lahan:     pekerjaan || '',
        jabatan_pemilik_lahan:       jabatan,
        alamat_pemilik_lahan:        alamatPemilik || '',
        nama_acara:                  namaAcara,
        hari_tanggal_acara:          hariTanggalAcara,
        waktu_acara:                 waktuAcara,
        tempat_acara:                tempatAcara,
    };

    const method = id ? 'PUT' : 'POST';
    const url    = id ? `/api/ijin-tempat/${id}` : '/api/ijin-tempat';

    try {
        const btn = document.getElementById('btnSaveIjinTempat');
        btn.disabled = true;
        document.getElementById('btnSaveIjinTempatText').textContent = 'Menyimpan...';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
            showToast(result.message, 'success');
            resetIjinTempatForm();
            loadIjinTempatData();
        } else {
            showToast(result.message || 'Gagal menyimpan.', 'error');
        }
    } catch (err) {
        showToast('Gagal menyimpan data.', 'error');
    } finally {
        document.getElementById('btnSaveIjinTempat').disabled = false;
        document.getElementById('btnSaveIjinTempatText').textContent = isITEditMode ? 'Update Data' : 'Simpan Data';
    }
}

async function editIjinTempat(id) {
    try {
        const res = await fetch(`/api/ijin-tempat/${id}`);
        const result = await res.json();
        if (!result.success) return showToast('Gagal memuat data.', 'error');

        const d = result.data;
        isITEditMode = true;
        itEditingId = id;

        document.getElementById('ijinTempatEditId').value           = id;
        document.getElementById('itNamaPemilikLahan').value         = d.nama_pemilik_lahan;
        document.getElementById('itNIKPemilik').value               = d.nik_pemilik_lahan;
        document.getElementById('itTempatLahirPemilik').value       = d.tempat_lahir_pemilik_lahan;
        document.getElementById('itPekerjaanPemilik').value         = d.pekerjaan_pemilik_lahan;
        document.getElementById('itJabatanPemilik').value           = d.jabatan_pemilik_lahan || '';
        document.getElementById('itAlamatPemilik').value            = d.alamat_pemilik_lahan || '';
        document.getElementById('itNamaAcara').value                = d.nama_acara;
        // Isi field hari/tanggal acara
        const itHtaEl = document.getElementById('itHariTanggalAcara');
        if (itHtaEl) itHtaEl.value = d.hari_tanggal_acara || '';
        if (itHtaEl && itHtaEl._flatpickr) itHtaEl._flatpickr.setDate(d.hari_tanggal_acara, false);
        document.getElementById('itWaktuAcara').value               = d.waktu_acara;
        document.getElementById('itTempatAcara').value              = d.tempat_acara;

        if (document.getElementById('itTanggalSurat')._flatpickr)
            document.getElementById('itTanggalSurat')._flatpickr.setDate(new Date(d.tanggal_surat));
        if (document.getElementById('itTanggalLahirPemilik')._flatpickr)
            document.getElementById('itTanggalLahirPemilik')._flatpickr.setDate(new Date(d.tanggal_lahir_pemilik_lahan));

        document.getElementById('ijinTempatFormTitle').textContent = '✏️ Edit Data Ijin Tempat';
        document.getElementById('btnSaveIjinTempatText').textContent = 'Update Data';
        document.getElementById('ijinTempatFormCard').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        showToast('Gagal memuat data edit.', 'error');
    }
}

async function hapusIjinTempat(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus data ijin tempat ini?')) return;
    try {
        const res = await fetch(`/api/ijin-tempat/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            showToast('Data berhasil dihapus.', 'success');
            loadIjinTempatData();
        } else {
            showToast(result.message || 'Gagal menghapus.', 'error');
        }
    } catch (err) {
        showToast('Gagal menghapus data.', 'error');
    }
}

async function cetakIjinTempat(id) {
    try {
        showToast('Membuat dokumen DOCX...', 'info');
        const res = await fetch(`/api/ijin-tempat/generate-docx/${id}`);
        if (!res.ok) {
            const text = await res.text();
            showToast('Gagal membuat dokumen: ' + text, 'error');
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ijin_Tempat_${id}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Dokumen berhasil diunduh.', 'success');
    } catch (err) {
        showToast('Gagal mengunduh dokumen.', 'error');
    }
}

function resetIjinTempatForm() {
    document.getElementById('ijinTempatForm').reset();
    document.getElementById('ijinTempatEditId').value = '';
    document.getElementById('ijinTempatFormTitle').textContent = '📝 Input Data Ijin Tempat';
    document.getElementById('btnSaveIjinTempatText').textContent = 'Simpan Data';
    isITEditMode = false;
    itEditingId = null;
}

// ============================================================
// HELPER: Format tanggal ke "Hari, DD Bulan YYYY" (Indonesia)
// ============================================================
function formatHariTanggalID(date) {
    const hariID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const bulanID = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const hari  = hariID[date.getDay()];
    const tgl   = date.getDate();
    const bulan = bulanID[date.getMonth()];
    const tahun = date.getFullYear();
    return `${hari}, ${tgl} ${bulan} ${tahun}`;
}
