// ============================================================
// SPPD MODULE - Form handling, data table, print, edit
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initSppdForm();
  loadSppdData();
  loadStats();
});

let lastSavedId = null;
let isEditMode = false;
let editingId = null;

// ── Konversi angka ke kata Indonesia ──
function angkaKeHuruf(n) {
  if (isNaN(n) || n < 1) return '';
  n = parseInt(n);
  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
  const belasan = ['sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas',
    'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas'];
  const puluhan = ['', '', 'dua puluh', 'tiga puluh', 'empat puluh', 'lima puluh',
    'enam puluh', 'tujuh puluh', 'delapan puluh', 'sembilan puluh'];

  if (n < 10) return satuan[n];
  if (n < 20) return belasan[n - 10];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const s = n % 10;
    return puluhan[t] + (s ? ' ' + satuan[s] : '');
  }
  if (n === 100) return 'seratus';
  if (n < 200) return 'seratus ' + angkaKeHuruf(n - 100);
  if (n < 1000) {
    const r = Math.floor(n / 100);
    return satuan[r] + ' ratus' + (n % 100 ? ' ' + angkaKeHuruf(n % 100) : '');
  }
  return String(n);
}

// ── Format Lama Perjalanan untuk disimpan ──
function formatLamaPerjalanan(angka) {
  const n = parseInt(angka);
  if (isNaN(n) || n < 1) return '';
  const kata = angkaKeHuruf(n);
  return `${n} (${kata}) hari`;
}

// ── Ekstrak angka dari format tersimpan "1 (satu) hari" → "1" ──
function extractAngkaLama(lamaStr) {
  if (!lamaStr) return '';
  const match = String(lamaStr).match(/^(\d+)/);
  return match ? match[1] : '';
}

// ── Hitung tanggal kembali otomatis ──
function hitungTanggalKembali() {
  const berangkat = document.getElementById('sppdTglBerangkat').value;
  const lama = parseInt(document.getElementById('sppdLama').value);

  if (berangkat && lama && lama > 0) {
    const d = new Date(berangkat);
    d.setDate(d.getDate() + lama);
    // Format ke YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    document.getElementById('sppdTglKembali').value = `${y}-${m}-${day}`;
  } else {
    document.getElementById('sppdTglKembali').value = '';
  }
}

// ── Initialize SPPD Form ──
function initSppdForm() {
  const form = document.getElementById('sppdForm');
  const btnCancel = document.getElementById('btnCancelSppd');
  const btnPrintYes = document.getElementById('btnPrintYes');
  const btnPrintNo = document.getElementById('btnPrintNo');

  // Hitung tanggal kembali saat lama atau tanggal berangkat berubah
  document.getElementById('sppdLama').addEventListener('input', hitungTanggalKembali);
  document.getElementById('sppdTglBerangkat').addEventListener('change', hitungTanggalKembali);

  // Pastikan lama hanya angka positif (extra guard)
  document.getElementById('sppdLama').addEventListener('keypress', (e) => {
    if (!/[0-9]/.test(e.key)) e.preventDefault();
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isEditMode) {
      await updateSppd();
    } else {
      await saveSppd();
    }
  });

  // Cancel → reset ke mode tambah baru
  btnCancel.addEventListener('click', () => {
    resetFormToCreateMode();
  });

  // Print modal
  btnPrintYes.addEventListener('click', () => {
    closePrintModal();
    if (lastSavedId) printSppdAll(lastSavedId);
  });
  btnPrintNo.addEventListener('click', closePrintModal);

  document.getElementById('printModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePrintModal();
  });

  // Load nomor otomatis
  loadNextNomorSurat();
}

// ── Reset form ke mode "tambah baru" ──
function resetFormToCreateMode() {
  isEditMode = false;
  editingId = null;

  document.getElementById('sppdEditId').value = '';
  document.getElementById('sppdForm').reset();
  document.getElementById('sppdTglKembali').value = '';

  document.getElementById('formSppdTitle').textContent = '✏️ Input Data SPPD';
  document.getElementById('btnSaveSppdText').textContent = 'Simpan';
  document.getElementById('btnCancelSppdText').textContent = 'Batal / Reset';

  loadNextNomorSurat();

  // Scroll ke atas form
  document.getElementById('formSppdTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Load Next Nomor Surat (auto) ──
async function loadNextNomorSurat() {
  try {
    const res = await fetch('/api/sppd/next-number');
    if (!res.ok) return;
    const result = await res.json();
    if (result.success && !isEditMode) {
      const nomorField = document.getElementById('sppdNomor');
      if (nomorField) nomorField.value = result.nomor;
    }
  } catch (err) {
    console.warn('Gagal memuat nomor surat otomatis:', err);
  }
}

// ── Save SPPD (mode tambah baru) ──
async function saveSppd() {
  const lamaAngka = document.getElementById('sppdLama').value.trim();
  const lamaFormatted = formatLamaPerjalanan(lamaAngka);

  if (!lamaFormatted) {
    showToast('Lama perjalanan harus berupa angka valid (minimal 1).', 'error');
    return;
  }

  const data = {
    nomor_surat: document.getElementById('sppdNomor').value.trim(),
    nama_pegawai: document.getElementById('sppdNama').value.trim(),
    jabatan: document.getElementById('sppdJabatan').value.trim(),
    acara: document.getElementById('sppdAcara').value.trim(),
    kendaraan: document.getElementById('sppdKendaraan').value.trim(),
    tujuan: document.getElementById('sppdTujuan').value.trim(),
    lama_perjalanan: lamaFormatted,
    tanggal_berangkat: document.getElementById('sppdTglBerangkat').value,
    tanggal_kembali: document.getElementById('sppdTglKembali').value,
    dasar_surat: document.getElementById('sppdDasar').value.trim(),
    nomor_surat_dasar: document.getElementById('sppdNomorDasar').value.trim(),
    nominal_rupiah: document.getElementById('sppdNominal').value.trim()
  };

  for (const [, val] of Object.entries(data)) {
    if (!val) { showToast('Semua field wajib diisi.', 'error'); return; }
  }

  try {
    const res = await fetch('/api/sppd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();

    if (result.success) {
      lastSavedId = result.id;
      resetFormToCreateMode();
      await loadNextNomorSurat();
      loadSppdData();
      loadStats();
      openPrintModal();
    } else {
      showToast(result.message, 'error');
    }
  } catch {
    showToast('Gagal menyimpan data SPPD.', 'error');
  }
}

// ── Update SPPD (mode edit) ──
async function updateSppd() {
  const lamaAngka = document.getElementById('sppdLama').value.trim();
  const lamaFormatted = formatLamaPerjalanan(lamaAngka);

  if (!lamaFormatted) {
    showToast('Lama perjalanan harus berupa angka valid (minimal 1).', 'error');
    return;
  }

  const data = {
    nomor_surat: document.getElementById('sppdNomor').value.trim(),
    nama_pegawai: document.getElementById('sppdNama').value.trim(),
    jabatan: document.getElementById('sppdJabatan').value.trim(),
    acara: document.getElementById('sppdAcara').value.trim(),
    kendaraan: document.getElementById('sppdKendaraan').value.trim(),
    tujuan: document.getElementById('sppdTujuan').value.trim(),
    lama_perjalanan: lamaFormatted,
    tanggal_berangkat: document.getElementById('sppdTglBerangkat').value,
    tanggal_kembali: document.getElementById('sppdTglKembali').value,
    dasar_surat: document.getElementById('sppdDasar').value.trim(),
    nomor_surat_dasar: document.getElementById('sppdNomorDasar').value.trim(),
    nominal_rupiah: document.getElementById('sppdNominal').value.trim()
  };

  for (const [, val] of Object.entries(data)) {
    if (!val) { showToast('Semua field wajib diisi.', 'error'); return; }
  }

  try {
    const btn = document.getElementById('btnSaveSppd');
    btn.disabled = true;
    document.getElementById('btnSaveSppdText').textContent = 'Menyimpan...';

    const res = await fetch(`/api/sppd/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();

    if (result.success) {
      showToast('✅ Data SPPD berhasil diperbarui!', 'success');
      resetFormToCreateMode();
      loadSppdData();
      loadStats();
    } else {
      showToast(result.message, 'error');
    }
  } catch {
    showToast('Gagal memperbarui data SPPD.', 'error');
  } finally {
    document.getElementById('btnSaveSppd').disabled = false;
  }
}

// ── Edit SPPD — isi form dengan data yang ada ──
async function editSppd(id) {
  try {
    const res = await fetch(`/api/sppd/${id}`);
    const result = await res.json();
    if (!result.success) { showToast('Gagal memuat data.', 'error'); return; }

    const d = result.data;

    // Set edit mode
    isEditMode = true;
    editingId = id;
    document.getElementById('sppdEditId').value = id;

    // Isi form
    document.getElementById('sppdNomor').value = d.nomor_surat;
    document.getElementById('sppdNama').value = d.nama_pegawai;
    document.getElementById('sppdJabatan').value = d.jabatan;
    document.getElementById('sppdAcara').value = d.acara;
    document.getElementById('sppdKendaraan').value = d.kendaraan;
    document.getElementById('sppdTujuan').value = d.tujuan;
    document.getElementById('sppdLama').value = extractAngkaLama(d.lama_perjalanan);
    document.getElementById('sppdTglBerangkat').value = d.tanggal_berangkat;
    document.getElementById('sppdTglKembali').value = d.tanggal_kembali;
    document.getElementById('sppdDasar').value = d.dasar_surat || '';
    document.getElementById('sppdNomorDasar').value = d.nomor_surat_dasar || '';
    document.getElementById('sppdNominal').value = d.nominal_rupiah || '';

    // Update UI ke mode edit
    document.getElementById('formSppdTitle').textContent = `✏️ Edit Data SPPD — ${d.nomor_surat}`;
    document.getElementById('btnSaveSppdText').textContent = 'Update Data';
    document.getElementById('btnCancelSppdText').textContent = 'Batal Edit';

    // Scroll ke form
    document.getElementById('formSppdTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`Mode Edit: ${d.nomor_surat}`, 'success');
  } catch {
    showToast('Gagal memuat data untuk diedit.', 'error');
  }
}

// ── Load SPPD Data Table ──
async function loadSppdData() {
  try {
    const res = await fetch('/api/sppd');
    const result = await res.json();

    const tbody = document.getElementById('sppdTableBody');
    const emptyState = document.getElementById('sppdEmptyState');
    const table = document.getElementById('sppdTable');

    tbody.innerHTML = '';

    if (result.success && result.data.length > 0) {
      table.style.display = 'table';
      emptyState.style.display = 'none';

      result.data.forEach((item, index) => {
        const tr = document.createElement('tr');
        const tglBerangkat = formatDateID(item.tanggal_berangkat);

        tr.innerHTML = `
          <td>${index + 1}</td>
          <td><strong>${item.nomor_surat}</strong></td>
          <td>${item.nama_pegawai}</td>
          <td>${item.jabatan}</td>
          <td>${item.tujuan}</td>
          <td>${tglBerangkat}</td>
          <td>
            <div class="action-btns">
              <button class="btn-action btn-edit" onclick="editSppd(${item.id})" title="Edit">
                ✏️
              </button>
              <button class="btn-action btn-print" onclick="printSppdAll(${item.id})" title="Cetak Semua">
                🖨️
              </button>
              <button class="btn-action btn-delete" onclick="deleteSppd(${item.id})" title="Hapus">
                🗑️
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      table.style.display = 'none';
      emptyState.style.display = 'block';
    }
  } catch (error) {
    console.error('Failed to load SPPD data:', error);
  }
}

// ── Load Stats ──
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const result = await res.json();
    if (result.success) {
      document.getElementById('statSppd').textContent = result.stats.sppd;
      document.getElementById('statRab').textContent = result.stats.rab;
      document.getElementById('statPermohonan').textContent = result.stats.permohonan;
      document.getElementById('statSk').textContent = result.stats.sk;
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// ── Delete SPPD ──
async function deleteSppd(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus data SPPD ini?')) return;

  try {
    const res = await fetch(`/api/sppd/${id}`, { method: 'DELETE' });
    const result = await res.json();

    if (result.success) {
      showToast('Data SPPD berhasil dihapus.', 'success');
      // Jika sedang edit data yang dihapus, reset form
      if (isEditMode && editingId === id) resetFormToCreateMode();
      loadSppdData();
      loadStats();
      loadNextNomorSurat();
    } else {
      showToast(result.message, 'error');
    }
  } catch {
    showToast('Gagal menghapus data.', 'error');
  }
}

// ── Print SPPD (Single) ──
function printSppd(id) {
  const printWindow = window.open(`/sppd-print.html?id=${id}`, '_blank', 'width=800,height=1000');
  if (!printWindow) {
    showToast('Popup diblokir oleh browser. Izinkan popup untuk mencetak.', 'error');
  }
}

// ── Print All Documents ──
function printSppdAll(id) {
  const printWindow = window.open(`/print-all.html?id=${id}`, '_blank', 'width=850,height=1000');
  if (!printWindow) {
    showToast('Popup diblokir oleh browser. Izinkan popup untuk mencetak.', 'error');
  }
}

// ── Modal ──
function openPrintModal() {
  document.getElementById('printModal').classList.add('active');
}

function closePrintModal() {
  document.getElementById('printModal').classList.remove('active');
}

// ── Format Tanggal ID ──
function formatDateID(dateStr) {
  if (!dateStr) return '-';
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
