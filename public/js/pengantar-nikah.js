// ============================================================
// PENGANTAR NIKAH PAGE LOGIC
// ============================================================

// ── State ──
let isPNEditMode = false;
let pnEditingId = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initPengantarNikahPage();
});

function initPengantarNikahPage() {
    // ── Form ──
    const form = document.getElementById('pengantarNikahForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await savePengantarNikah();
        });
    }

    const btnCancel = document.getElementById('btnCancelPengantarNikah');
    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            resetPengantarNikahForm();
            loadNextPNNumber();
        });
    }

    // ── Flatpickr Date Pickers ──
    const dateConfig = { dateFormat: "d/m/Y", disableMobile: true, allowInput: true };
    if (document.getElementById('pnTanggalPengajuan'))    flatpickr('#pnTanggalPengajuan',    dateConfig);
    if (document.getElementById('pnTanggalLahirPemohon')) flatpickr('#pnTanggalLahirPemohon', dateConfig);
    if (document.getElementById('pnTanggalLahirAyah'))    flatpickr('#pnTanggalLahirAyah',    dateConfig);
    if (document.getElementById('pnTanggalLahirIbu'))     flatpickr('#pnTanggalLahirIbu',     dateConfig);
    if (document.getElementById('pnTanggalLahirCalon'))   flatpickr('#pnTanggalLahirCalon',   dateConfig);

    // ── Flatpickr untuk Hari/Tanggal Nikah (output nama hari + tanggal Indonesia) ──
    const hariTanggalConfig = {
        dateFormat: 'Y-m-d',
        disableMobile: true,
        allowInput: false,
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length > 0) {
                const formatted = formatHariTanggalIDPN(selectedDates[0]);
                instance.element.value = formatted;
            }
        }
    };
    if (document.getElementById('pnHariTanggalNikah')) {
        flatpickr('#pnHariTanggalNikah', hariTanggalConfig);
    }
}

// ============================================================
// AUTO NUMBER
// ============================================================
async function loadNextPNNumber() {
    try {
        const res = await fetch('/api/pengantar-nikah/next-number');
        const result = await res.json();
        if (result.success) {
            const el = document.getElementById('pnNomor');
            if (el) el.value = result.nomor;
        }
    } catch (err) {
        console.error('Gagal memuat nomor surat pengantar nikah:', err);
        const el = document.getElementById('pnNomor');
        if (el) {
            el.placeholder = 'Masukkan nomor secara manual';
            el.readOnly = false;
            el.style.opacity = '1';
            el.style.cursor = 'text';
        }
    }
}

// ============================================================
// LOAD DATA
// ============================================================
async function loadPengantarNikahData() {
    try {
        const res = await fetch('/api/pengantar-nikah');
        const result = await res.json();
        const tbody = document.getElementById('pengantarNikahTableBody');
        const emptyState = document.getElementById('pengantarNikahEmptyState');
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
                    <td>${item.nama_calon || '-'}</td>
                    <td>${item.hari_tanggal_nikah || '-'}</td>
                    <td>${item.tempat_akad_nikah || '-'}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-action btn-edit" onclick="editPengantarNikah(${item.id})" title="Edit">✏️</button>
                            <button class="btn-action" style="background:rgba(43,87,154,0.12); color:#2b579a;" onclick="cetakPengantarNikah(${item.id})" title="Cetak DOCX">📄</button>
                            <button class="btn-action btn-delete" onclick="hapusPengantarNikah(${item.id})" title="Hapus">🗑️</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            const statEl = document.getElementById('statPengantarNikahTotal');
            if (statEl) statEl.textContent = result.data.length;
        } else {
            emptyState.style.display = 'block';
            const statEl = document.getElementById('statPengantarNikahTotal');
            if (statEl) statEl.textContent = '0';
        }
    } catch (err) {
        console.error('Gagal memuat data pengantar nikah:', err);
    }
}

// ============================================================
// SAVE
// ============================================================
async function savePengantarNikah() {
    const id = document.getElementById('pengantarNikahEditId').value;

    // Collect all fields
    const nomorSurat        = document.getElementById('pnNomor').value;
    const tanggalPengajuan  = document.getElementById('pnTanggalPengajuan').value;
    const namaPemohon       = document.getElementById('pnNamaPemohon').value.trim();
    const nikPemohon        = document.getElementById('pnNIKPemohon').value.trim();
    const jenisKelamin      = document.getElementById('pnJenisKelaminPemohon').value;
    const tempatLahir       = document.getElementById('pnTempatLahirPemohon').value.trim();
    const tanggalLahir      = document.getElementById('pnTanggalLahirPemohon').value;
    const kewarganegaraan   = document.getElementById('pnKewarganegaraanPemohon').value.trim();
    const agama             = document.getElementById('pnAgamaPemohon').value;
    const pekerjaan         = document.getElementById('pnPekerjaanPemohon').value.trim();
    const alamat            = document.getElementById('pnAlamatPemohon').value.trim();
    const statusPemohon     = document.getElementById('pnStatusPemohon').value;
    const statusWaliNasab   = document.getElementById('pnStatusWaliNasab').value.trim();

    // Validate required
    if (!tanggalPengajuan) return showToast('Tanggal Pengajuan wajib diisi.', 'error');
    if (!namaPemohon) return showToast('Nama Pemohon wajib diisi.', 'error');
    if (!nikPemohon) return showToast('NIK Pemohon wajib diisi.', 'error');

    const data = {
        nomor_surat:                  nomorSurat,
        tanggal_pengajuan:            reformatToISO(tanggalPengajuan),
        nama_pemohon:                 namaPemohon,
        nik_pemohon:                  nikPemohon,
        jenis_kelamin_pemohon:        jenisKelamin,
        tempat_lahir_pemohon:         tempatLahir,
        tanggal_lahir_pemohon:        tanggalLahir ? reformatToISO(tanggalLahir) : '',
        kewarganegaraan_pemohon:      kewarganegaraan,
        agama_pemohon:                agama,
        pekerjaan_pemohon:            pekerjaan,
        alamat_pemohon:               alamat,
        status_pemohon:               statusPemohon,
        status_wali_nasab:            statusWaliNasab,
        // Ayah
        nama_ayah_pemohon:            document.getElementById('pnNamaAyah').value.trim(),
        nik_ayah_pemohon:             document.getElementById('pnNIKAyah').value.trim(),
        tempat_lahir_ayah_pemohon:    document.getElementById('pnTempatLahirAyah').value.trim(),
        tanggal_lahir_ayah_pemohon:   document.getElementById('pnTanggalLahirAyah').value ? reformatToISO(document.getElementById('pnTanggalLahirAyah').value) : '',
        kewarganegaraan_ayah_pemohon: document.getElementById('pnKewarganegaraanAyah').value.trim(),
        agama_ayah_pemohon:           document.getElementById('pnAgamaAyah').value,
        pekerjaan_ayah_pemohon:       document.getElementById('pnPekerjaanAyah').value.trim(),
        alamat_ayah_pemohon:          document.getElementById('pnAlamatAyah').value.trim(),
        nama_kakek_dari_ayah_pemohon: document.getElementById('pnNamaKakekAyah').value.trim(),
        // Ibu
        nama_ibu_pemohon:             document.getElementById('pnNamaIbu').value.trim(),
        nik_ibu_pemohon:              document.getElementById('pnNIKIbu').value.trim(),
        tempat_lahir_ibu_pemohon:     document.getElementById('pnTempatLahirIbu').value.trim(),
        tanggal_lahir_ibu_pemohon:    document.getElementById('pnTanggalLahirIbu').value ? reformatToISO(document.getElementById('pnTanggalLahirIbu').value) : '',
        kewarganegaraan_ibu_pemohon:  document.getElementById('pnKewarganegaraanIbu').value.trim(),
        agama_ibu_pemohon:            document.getElementById('pnAgamaIbu').value,
        pekerjaan_ibu_pemohon:        document.getElementById('pnPekerjaanIbu').value.trim(),
        alamat_ibu_pemohon:           document.getElementById('pnAlamatIbu').value.trim(),
        nama_kakek_dari_ayah_ibu:     document.getElementById('pnNamaKakekIbu').value.trim(),
        // Calon
        nama_calon:                   document.getElementById('pnNamaCalon').value.trim(),
        nama_ayah_calon:              document.getElementById('pnNamaAyahCalon').value.trim(),
        nik_calon:                    document.getElementById('pnNIKCalon').value.trim(),
        tempat_lahir_calon:           document.getElementById('pnTempatLahirCalon').value.trim(),
        tanggal_lahir_calon:          document.getElementById('pnTanggalLahirCalon').value ? reformatToISO(document.getElementById('pnTanggalLahirCalon').value) : '',
        kewarganegaraan_calon:        document.getElementById('pnKewarganegaraanCalon').value.trim(),
        agama_calon:                  document.getElementById('pnAgamaCalon').value,
        pekerjaan_calon:              document.getElementById('pnPekerjaanCalon').value.trim(),
        alamat_calon:                 document.getElementById('pnAlamatCalon').value.trim(),
        // Akad
        calon_pasangan_pemohon:       document.getElementById('pnCalonPasanganPemohon').value,
        hari_tanggal_nikah:           document.getElementById('pnHariTanggalNikah').value,
        jam_nikah:                    document.getElementById('pnJamNikah').value.trim(),
        tempat_akad_nikah:            document.getElementById('pnTempatAkadNikah').value.trim(),
    };

    const method = id ? 'PUT' : 'POST';
    const url    = id ? `/api/pengantar-nikah/${id}` : '/api/pengantar-nikah';

    try {
        const btn = document.getElementById('btnSavePengantarNikah');
        btn.disabled = true;
        document.getElementById('btnSavePengantarNikahText').textContent = 'Menyimpan...';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
            showToast(result.message, 'success');
            resetPengantarNikahForm();
            loadNextPNNumber();
            loadPengantarNikahData();
        } else {
            showToast(result.message || 'Gagal menyimpan.', 'error');
        }
    } catch (err) {
        showToast('Gagal menyimpan data.', 'error');
    } finally {
        document.getElementById('btnSavePengantarNikah').disabled = false;
        document.getElementById('btnSavePengantarNikahText').textContent = isPNEditMode ? 'Update Data' : 'Simpan Data';
    }
}

// ============================================================
// EDIT
// ============================================================
async function editPengantarNikah(id) {
    try {
        const res = await fetch(`/api/pengantar-nikah/${id}`);
        const result = await res.json();
        if (!result.success) return showToast('Gagal memuat data.', 'error');

        const d = result.data;
        isPNEditMode = true;
        pnEditingId = id;

        document.getElementById('pengantarNikahEditId').value = id;
        document.getElementById('pnNomor').value = d.nomor_surat;
        document.getElementById('pnNomor').readOnly = true;
        document.getElementById('pnNamaPemohon').value = d.nama_pemohon;
        document.getElementById('pnNIKPemohon').value = d.nik_pemohon;
        document.getElementById('pnJenisKelaminPemohon').value = d.jenis_kelamin_pemohon || '';
        document.getElementById('pnTempatLahirPemohon').value = d.tempat_lahir_pemohon || '';
        document.getElementById('pnKewarganegaraanPemohon').value = d.kewarganegaraan_pemohon || 'WNI';
        document.getElementById('pnAgamaPemohon').value = d.agama_pemohon || '';
        document.getElementById('pnPekerjaanPemohon').value = d.pekerjaan_pemohon || '';
        document.getElementById('pnAlamatPemohon').value = d.alamat_pemohon || '';
        document.getElementById('pnStatusPemohon').value = d.status_pemohon || '';
        document.getElementById('pnStatusWaliNasab').value = d.status_wali_nasab || '';

        // Ayah
        document.getElementById('pnNamaAyah').value = d.nama_ayah_pemohon || '';
        document.getElementById('pnNIKAyah').value = d.nik_ayah_pemohon || '';
        document.getElementById('pnTempatLahirAyah').value = d.tempat_lahir_ayah_pemohon || '';
        document.getElementById('pnKewarganegaraanAyah').value = d.kewarganegaraan_ayah_pemohon || 'WNI';
        document.getElementById('pnAgamaAyah').value = d.agama_ayah_pemohon || '';
        document.getElementById('pnPekerjaanAyah').value = d.pekerjaan_ayah_pemohon || '';
        document.getElementById('pnAlamatAyah').value = d.alamat_ayah_pemohon || '';
        document.getElementById('pnNamaKakekAyah').value = d.nama_kakek_dari_ayah_pemohon || '';

        // Ibu
        document.getElementById('pnNamaIbu').value = d.nama_ibu_pemohon || '';
        document.getElementById('pnNIKIbu').value = d.nik_ibu_pemohon || '';
        document.getElementById('pnTempatLahirIbu').value = d.tempat_lahir_ibu_pemohon || '';
        document.getElementById('pnKewarganegaraanIbu').value = d.kewarganegaraan_ibu_pemohon || 'WNI';
        document.getElementById('pnAgamaIbu').value = d.agama_ibu_pemohon || '';
        document.getElementById('pnPekerjaanIbu').value = d.pekerjaan_ibu_pemohon || '';
        document.getElementById('pnAlamatIbu').value = d.alamat_ibu_pemohon || '';
        document.getElementById('pnNamaKakekIbu').value = d.nama_kakek_dari_ayah_ibu || '';

        // Calon
        document.getElementById('pnNamaCalon').value = d.nama_calon || '';
        document.getElementById('pnNamaAyahCalon').value = d.nama_ayah_calon || '';
        document.getElementById('pnNIKCalon').value = d.nik_calon || '';
        document.getElementById('pnTempatLahirCalon').value = d.tempat_lahir_calon || '';
        document.getElementById('pnKewarganegaraanCalon').value = d.kewarganegaraan_calon || 'WNI';
        document.getElementById('pnAgamaCalon').value = d.agama_calon || '';
        document.getElementById('pnPekerjaanCalon').value = d.pekerjaan_calon || '';
        document.getElementById('pnAlamatCalon').value = d.alamat_calon || '';

        // Akad
        document.getElementById('pnCalonPasanganPemohon').value = d.calon_pasangan_pemohon || '';
        const htEl = document.getElementById('pnHariTanggalNikah');
        if (htEl) htEl.value = d.hari_tanggal_nikah || '';
        if (htEl && htEl._flatpickr) htEl._flatpickr.setDate(d.hari_tanggal_nikah, false);
        document.getElementById('pnJamNikah').value = d.jam_nikah || '';
        document.getElementById('pnTempatAkadNikah').value = d.tempat_akad_nikah || '';

        // Set flatpickr dates
        if (document.getElementById('pnTanggalPengajuan')._flatpickr)
            document.getElementById('pnTanggalPengajuan')._flatpickr.setDate(new Date(d.tanggal_pengajuan));
        if (d.tanggal_lahir_pemohon && document.getElementById('pnTanggalLahirPemohon')._flatpickr)
            document.getElementById('pnTanggalLahirPemohon')._flatpickr.setDate(new Date(d.tanggal_lahir_pemohon));
        if (d.tanggal_lahir_ayah_pemohon && document.getElementById('pnTanggalLahirAyah')._flatpickr)
            document.getElementById('pnTanggalLahirAyah')._flatpickr.setDate(new Date(d.tanggal_lahir_ayah_pemohon));
        if (d.tanggal_lahir_ibu_pemohon && document.getElementById('pnTanggalLahirIbu')._flatpickr)
            document.getElementById('pnTanggalLahirIbu')._flatpickr.setDate(new Date(d.tanggal_lahir_ibu_pemohon));
        if (d.tanggal_lahir_calon && document.getElementById('pnTanggalLahirCalon')._flatpickr)
            document.getElementById('pnTanggalLahirCalon')._flatpickr.setDate(new Date(d.tanggal_lahir_calon));

        document.getElementById('pengantarNikahFormTitle').textContent = '✏️ Edit Data Pengantar Nikah';
        document.getElementById('btnSavePengantarNikahText').textContent = 'Update Data';
        document.getElementById('pengantarNikahFormCard').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        showToast('Gagal memuat data edit.', 'error');
    }
}

// ============================================================
// DELETE
// ============================================================
async function hapusPengantarNikah(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus data pengantar nikah ini?')) return;
    try {
        const res = await fetch(`/api/pengantar-nikah/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            showToast('Data berhasil dihapus.', 'success');
            loadPengantarNikahData();
            loadNextPNNumber();
        } else {
            showToast(result.message || 'Gagal menghapus.', 'error');
        }
    } catch (err) {
        showToast('Gagal menghapus data.', 'error');
    }
}

// ============================================================
// CETAK DOCX
// ============================================================
async function cetakPengantarNikah(id) {
    try {
        showToast('Membuat dokumen DOCX...', 'info');
        const res = await fetch(`/api/pengantar-nikah/generate-docx/${id}`);
        if (!res.ok) {
            const text = await res.text();
            showToast('Gagal membuat dokumen: ' + text, 'error');
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Pengantar_Nikah_${id}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Dokumen berhasil diunduh.', 'success');
    } catch (err) {
        showToast('Gagal mengunduh dokumen.', 'error');
    }
}

// ============================================================
// RESET FORM
// ============================================================
function resetPengantarNikahForm() {
    document.getElementById('pengantarNikahForm').reset();
    document.getElementById('pengantarNikahEditId').value = '';
    document.getElementById('pengantarNikahFormTitle').textContent = '📝 Input Data Pengantar Nikah';
    document.getElementById('btnSavePengantarNikahText').textContent = 'Simpan Data';
    document.getElementById('pnKewarganegaraanPemohon').value = 'WNI';
    document.getElementById('pnKewarganegaraanAyah').value = 'WNI';
    document.getElementById('pnKewarganegaraanIbu').value = 'WNI';
    document.getElementById('pnKewarganegaraanCalon').value = 'WNI';
    isPNEditMode = false;
    pnEditingId = null;

    const nomorEl = document.getElementById('pnNomor');
    if (nomorEl) {
        nomorEl.readOnly = true;
        nomorEl.style.opacity = '0.8';
        nomorEl.style.cursor = 'not-allowed';
    }
}

// ============================================================
// HELPER: Format tanggal ke "Hari, DD Bulan YYYY" (Indonesia)
// ============================================================
function formatHariTanggalIDPN(date) {
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
