let lastSavedId = null;
let isEditMode = false;
let editingId = null;
let idToDelete = null;
let currentFileBase64 = null; // Store Base64 for upload

let sppdParentData = null;
let sppdFollowersRemaining = 0;
let sppdFollowerCurrentIndex = 1;

document.addEventListener('DOMContentLoaded', () => {
  initSppdForm();
  loadSppdData();
  loadStats();
  initFormInteractivity();
  initFollowerFlow();
});

// ── Form Interactivity (Datepicker & Nominal Format) ──
function initFormInteractivity() {
  // Flatpickr for Date Inputs
  const config = {
    dateFormat: "d/m/Y",
    disableMobile: true,
    onChange: function() {
      if (typeof hitungTanggalKembali === 'function') hitungTanggalKembali();
    }
  };
  
  flatpickr("#sppdTglBerangkat", config);
  // Tanggal Kembali is readonly/auto, but we initialize it for consistent look
  flatpickr("#sppdTglKembali", { ...config, clickOpens: false });

  // Nominal Thousand Separator
  const nominalInput = document.getElementById('sppdNominal');
  if (nominalInput) {
    nominalInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/[^0-9]/g, '');
      if (value) {
        e.target.value = new Intl.NumberFormat('id-ID').format(value);
      } else {
        e.target.value = '';
      }
    });
  }

  // Title Case for Text Inputs
  const titleCaseInputs = [
    'sppdNama', 'sppdJabatan', 'sppdAcara', 'sppdTujuan', 'sppdDasar',
    'sppdFollowerNama', 'sppdFollowerJabatan'
  ];
  titleCaseInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', function(e) {
        const start = this.selectionStart;
        const end = this.selectionEnd;
        // Convert to lowercase first, then uppercase first letter of each word
        this.value = this.value.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase());
        this.setSelectionRange(start, end);
      });
    }
  });
}

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
  const berangkatStr = document.getElementById('sppdTglBerangkat').value; // d/m/y
  const lama = parseInt(document.getElementById('sppdLama').value);

  if (!berangkatStr || isNaN(lama)) return;

  // Manual parse d/m/y to Date object
  const parts = berangkatStr.split('/');
  if (parts.length !== 3) return;
  
  // y can be 2 digits, convert to 20xx
  let yArr = parts[2];
  let y = parseInt(yArr);
  if (yArr.length === 2) y += 2000;
  
  const date = new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0]));
  // NEW LOGIC: Jika 1 hari berarti tgl sama. Jika 2 hari tgl kembali +1.
  date.setDate(date.getDate() + lama - 1);

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  
  const target = document.getElementById('sppdTglKembali');
  target.value = `${dd}/${mm}/${yyyy}`;
  
  // Update Flatpickr instance
  if (target._flatpickr) target._flatpickr.setDate(date, false);
}

// ── Initialize SPPD Form ──
function initSppdForm() {
  const form = document.getElementById('sppdForm');
  const btnCancel = document.getElementById('btnCancelSppd');
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

  btnPrintNo.addEventListener('click', closePrintModal);

  document.getElementById('printModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePrintModal();
  });

  // Delete modal
  document.getElementById('btnDeleteYes').addEventListener('click', async () => {
    if (idToDelete) {
      await executeDeletion(idToDelete);
      closeDeleteModal();
    }
  });
  document.getElementById('btnDeleteNo').addEventListener('click', closeDeleteModal);

  document.getElementById('deleteConfirmModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDeleteModal();
  });

  // File Upload Handler → Convert to Base64
  const fileInput = document.getElementById('sppdFile');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          showToast('File terlalu besar. Maksimal 5MB.', 'error');
          fileInput.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          currentFileBase64 = event.target.result;
          showToast('Berkas berhasil diunggah (siap simpan).', 'success');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Load nomor otomatis
  loadNextNomorSurat();
}

// ── Focus First Field ──
function focusSppdFirstField() {
  const firstField = document.getElementById('sppdDasar');
  if (firstField) {
    setTimeout(() => firstField.focus(), 100);
  }
}

// ── Reset form ke mode "tambah baru" ──
function resetFormToCreateMode() {
  isEditMode = false;
  editingId = null;
  currentFileBase64 = null;

  document.getElementById('sppdEditId').value = '';
  document.getElementById('sppdForm').reset();
  const fileInput = document.getElementById('sppdFile');
  if (fileInput) fileInput.value = '';

  document.getElementById('sppdTglKembali').value = '';

  document.getElementById('formSppdTitle').textContent = '✏️ Input Data SPPD';
  document.getElementById('btnSaveSppdText').textContent = 'Simpan';
  document.getElementById('btnCancelSppdText').textContent = 'Batal / Reset';

  // Default Kendaraan: Sepeda Motor
  const selectKendaraan = document.getElementById('sppdKendaraan');
  if (selectKendaraan) selectKendaraan.value = 'Sepeda Motor';

  loadNextNomorSurat();

  // Focus Dasar Surat
  focusSppdFirstField();

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
    tanggal_berangkat: reformatToISO(document.getElementById('sppdTglBerangkat').value),
    tanggal_kembali: reformatToISO(document.getElementById('sppdTglKembali').value),
    dasar_surat: document.getElementById('sppdDasar').value.trim(),
    nomor_surat_dasar: document.getElementById('sppdNomorDasar').value.trim(),
    nominal_rupiah: document.getElementById('sppdNominal').value.replace(/\./g, ''),
    file_base64: currentFileBase64
  };

  // Validate mandatory fields (skip file_base64)
  for (const [key, val] of Object.entries(data)) {
    if (key === 'file_base64') continue; 
    if (!val) { 
      showToast('Semua field wajib diisi.', 'error'); 
      return; 
    }
  }

  console.log('Memulai proses simpan SPPD...');
  console.log('Payload data:', { ...data, file_base64: data.file_base64 ? `(Base64 string, length: ${data.file_base64.length})` : 'null' });

  try {
    const btn = document.getElementById('btnSaveSppd');
    const btnText = document.getElementById('btnSaveSppdText');
    btn.disabled = true;
    btnText.textContent = 'Menyimpan...';

    const res = await fetch('/api/sppd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();

    if (result.success) {
      lastSavedId = result.id;
      
      // Cek apakah ada antrean pengikut (multi-SPPD)
      if (window.jumlahSppdTarget && window.jumlahSppdTarget > 1) {
        sppdParentData = { ...data };
        sppdFollowersRemaining = window.jumlahSppdTarget - 1;
        sppdFollowerCurrentIndex = 2; // Mulai dari peserta ke-2
        window.jumlahSppdTarget = 0; // Konsumsi target agar tidak berulang
        
        loadSppdData();
        loadStats();
        openFollowerModal();
      } else {
        resetFormToCreateMode();
        await loadNextNomorSurat();
        loadSppdData();
        loadStats();
        openPrintModal();
      }
    } else {
      showToast(result.message, 'error');
    }
  } catch (err) {
    console.error('SaveSppd Error:', err);
    showToast('Gagal menyimpan data SPPD.', 'error');
  } finally {
    const btn = document.getElementById('btnSaveSppd');
    if (btn) {
      btn.disabled = false;
      document.getElementById('btnSaveSppdText').textContent = isEditMode ? 'Update Data' : 'Simpan';
    }
  }
}

// ── Multi-SPPD Follower Form Logic ──
function initFollowerFlow() {
  const btnBatal = document.getElementById('btnSppdFollowerBatal');
  const btnSimpan = document.getElementById('btnSppdFollowerSimpan');

  if (btnBatal) {
    btnBatal.addEventListener('click', () => {
      closeFollowerModal();
      resetFormToCreateMode(); // reset base form just in case
      showToast('Penambahan peserta lainnya dibatalkan.', 'success');
    });
  }

  if (btnSimpan) {
    btnSimpan.addEventListener('click', saveFollowerSppd);
  }
}

function openFollowerModal() {
  document.getElementById('sppdFollowerNama').value = '';
  document.getElementById('sppdFollowerJabatan').value = '';
  
  const titles = ['', '', 'Kedua', 'Ketiga', 'Keempat', 'Kelima', 'Keenam', 'Ketujuh', 'Kedelapan', 'Kesembilan', 'Kesepuluh'];
  let titleText = titles[sppdFollowerCurrentIndex] || `Ke-${sppdFollowerCurrentIndex}`;
  
  document.getElementById('sppdFollowerTitle').textContent = `Peserta ${titleText}`;
  document.getElementById('sppdFollowerModal').classList.add('active');
  setTimeout(() => document.getElementById('sppdFollowerNama').focus(), 100);
}

function closeFollowerModal() {
  document.getElementById('sppdFollowerModal').classList.remove('active');
  sppdFollowersRemaining = 0;
  sppdParentData = null;
}

async function saveFollowerSppd() {
  const nama = document.getElementById('sppdFollowerNama').value.trim();
  const jabatan = document.getElementById('sppdFollowerJabatan').value.trim();

  if (!nama || !jabatan) {
    showToast('Nama dan Jabatan wajib diisi.', 'error');
    return;
  }

  const btn = document.getElementById('btnSppdFollowerSimpan');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    // Get newest number for the clone
    let newNomor = '';
    const numRes = await fetch('/api/sppd/next-number');
    if (numRes.ok) {
      const numResult = await numRes.json();
      if (numResult.success) newNomor = numResult.nomor;
    }

    const payload = {
      ...sppdParentData,
      nama_pegawai: nama,
      jabatan: jabatan,
      nomor_surat: newNomor || sppdParentData.nomor_surat // fallback (though might clash)
    };

    const res = await fetch('/api/sppd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      lastSavedId = result.id;
      loadSppdData();
      loadStats();
      
      sppdFollowersRemaining--;
      if (sppdFollowersRemaining > 0) {
        sppdFollowerCurrentIndex++;
        
        btn.disabled = false;
        btn.textContent = 'Simpan';
        
        openFollowerModal(); // Reset form and title for next
      } else {
        closeFollowerModal();
        resetFormToCreateMode();
        openPrintModal(); // Ask if want to print the last one (or maybe not? just standard flow)
      }
    } else {
      showToast(result.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  } catch (err) {
    showToast('Gagal menyimpan peserta.', 'error');
    btn.disabled = false;
    btn.textContent = 'Simpan';
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
    tanggal_berangkat: reformatToISO(document.getElementById('sppdTglBerangkat').value),
    tanggal_kembali: reformatToISO(document.getElementById('sppdTglKembali').value),
    dasar_surat: document.getElementById('sppdDasar').value.trim(),
    nomor_surat_dasar: document.getElementById('sppdNomorDasar').value.trim(),
    nominal_rupiah: document.getElementById('sppdNominal').value.replace(/\./g, ''),
    file_base64: currentFileBase64
  };

  for (const [key, val] of Object.entries(data)) {
    if (key === 'file_base64') continue; 
    if (!val) { 
      showToast('Semua field wajib diisi.', 'error'); 
      return; 
    }
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
      lastSavedId = editingId; // Store the ID for the download modal
      resetFormToCreateMode();
      loadSppdData();
      loadStats();
      openPrintModal();
    } else {
      showToast(result.message, 'error');
    }
  } catch {
    showToast('Gagal memperbarui data SPPD.', 'error');
  } finally {
    document.getElementById('btnSaveSppd').disabled = false;
    document.getElementById('btnSaveSppdText').textContent = isEditMode ? 'Update Data' : 'Simpan';
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
    currentFileBase64 = d.file_base64 || null;

    const fieldset = document.getElementById('sppdFormFieldset');
    if (fieldset) fieldset.disabled = false;

    // Isi form
    document.getElementById('sppdNomor').value = d.nomor_surat;
    document.getElementById('sppdNama').value = d.nama_pegawai;
    document.getElementById('sppdJabatan').value = d.jabatan;
    document.getElementById('sppdAcara').value = d.acara;
    document.getElementById('sppdKendaraan').value = d.kendaraan;
    document.getElementById('sppdTujuan').value = d.tujuan;
    document.getElementById('sppdLama').value = extractAngkaLama(d.lama_perjalanan);
    
    // Set dates in Flatpickr
    if (document.getElementById('sppdTglBerangkat')._flatpickr) {
      document.getElementById('sppdTglBerangkat')._flatpickr.setDate(new Date(d.tanggal_berangkat), false);
    }
    if (document.getElementById('sppdTglKembali')._flatpickr) {
      document.getElementById('sppdTglKembali')._flatpickr.setDate(new Date(d.tanggal_kembali), false);
    }
    
    document.getElementById('sppdDasar').value = d.dasar_surat || '';
    document.getElementById('sppdNomorDasar').value = d.nomor_surat_dasar || '';
    document.getElementById('sppdNominal').value = new Intl.NumberFormat('id-ID').format(d.nominal_rupiah || 0);

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
          <td style="text-align:center;">
            <input type="checkbox" class="sppd-checkbox" value="${item.id}" style="width: 16px; height: 16px; cursor: pointer;">
          </td>
          <td>${index + 1}</td>
          <td><strong>${item.nomor_surat}</strong></td>
          <td>${item.nama_pegawai}</td>
          <td>${item.jabatan}</td>
          <td>${item.tujuan}</td>
          <td>${tglBerangkat}</td>
          <td>
            <div class="action-btns">
              <button class="btn-action btn-view" onclick="viewSppdDetail(${item.id})" title="Lihat Dokumen" style="width:auto; padding:0 12px; font-size:0.75rem; font-weight:600;">
                Lihat
              </button>
              <a href="/api/sppd/generate-docx/${item.id}" class="btn-action btn-word" title="Download Word (.docx)" style="background:#2b579a; color:white; text-decoration:none; display:flex; align-items:center; justify-content:center;">
                📄
              </a>
              <button class="btn-action btn-edit" onclick="editSppd(${item.id})" title="Edit">
                ✏️
              </button>
              <button class="btn-action btn-delete" onclick="hapusSppd(${item.id})" title="Hapus">
                🗑️
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      // Setup checkbox listeners
      setupCheckboxListeners();
    } else {
      table.style.display = 'none';
      emptyState.style.display = 'block';
    }
  } catch (error) {
    console.error('Failed to load SPPD data:', error);
  }
}

// ── Checkbox Logic for SPPD Penerimaan ──
function setupCheckboxListeners() {
  const selectAllCb = document.getElementById('selectAllSppd');
  const itemCbs = document.querySelectorAll('.sppd-checkbox');
  const btnCetak = document.getElementById('btnCetakPenerimaan');

  function updateButtonVisibility() {
    const checkedCount = document.querySelectorAll('.sppd-checkbox:checked').length;
    btnCetak.style.display = checkedCount > 0 ? 'flex' : 'none';
  }

  // Header checkbox (Select All)
  if (selectAllCb) {
    selectAllCb.checked = false; // Reset state
    selectAllCb.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      itemCbs.forEach(cb => { cb.checked = isChecked; });
      updateButtonVisibility();
    });
  }

  // Individual checkboxes
  itemCbs.forEach(cb => {
    cb.addEventListener('change', () => {
      const allChecked = document.querySelectorAll('.sppd-checkbox:checked').length === itemCbs.length;
      if (selectAllCb) selectAllCb.checked = allChecked && itemCbs.length > 0;
      updateButtonVisibility();
    });
  });

  // Print button click
  btnCetak.onclick = () => {
    const checkedBoxes = document.querySelectorAll('.sppd-checkbox:checked');
    const ids = Array.from(checkedBoxes).map(cb => cb.value);
    if (ids.length > 0) {
      const url = `/api/sppd/generate-penerimaan-docx?ids=${ids.join(',')}`;
      window.open(url, '_blank');
    }
  };
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
window.hapusSppd = function(id) {
  console.log('Menampilkan modal konfirmasi hapus untuk ID:', id);
  idToDelete = id;
  document.getElementById('deleteConfirmModal').classList.add('active');
}

function closeDeleteModal() {
  document.getElementById('deleteConfirmModal').classList.remove('active');
  idToDelete = null;
}

async function executeDeletion(id) {
  try {
    const res = await fetch(`/api/sppd/${id}`, { method: 'DELETE' });
    const result = await res.json();

    if (result.success) {
      showToast('Data SPPD berhasil dihapus.', 'success');
      // Jika sedang edit data yang dihapus, reset form
      if (isEditMode && editingId == id) resetFormToCreateMode();
      loadSppdData();
      loadStats();
      loadNextNomorSurat();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    console.error('Gagal menghapus data:', error);
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

// ── View Detail ──
async function viewSppdDetail(id) {
  try {
    const res = await fetch(`/api/sppd/${id}`);
    const result = await res.json();
    if (!result.success) { showToast(result.message, 'error'); return; }

    const d = result.data;
    const body = document.getElementById('detailSppdBody');
    
    // Clear textual details as requested by user
    body.innerHTML = '';
    
    // Update Modal Title
    const modalTitle = document.querySelector('#detailSppdModal h3');
    if (modalTitle) modalTitle.textContent = `📄 Dokumen SPPD — ${d.nomor_surat}`;

    // Handle File Preview
    const docContainer = document.getElementById('detailSppdDocContainer');
    const docPreview = document.getElementById('detailSppdDocPreview');
    
    if (d.file_base64) {
      docContainer.style.display = 'block';
      const isPdf = typeof d.file_base64 === 'string' && d.file_base64.includes('application/pdf');
      
      const btnHtml = `
        <div style="margin-bottom:12px; display:flex; justify-content:flex-end;">
          <button class="btn-action btn-print" id="btnSppdFullscreen" style="width:auto; padding:0 14px; height:36px; font-size:0.8rem; gap:8px; background:var(--primary-light); color:white; border-radius:var(--radius-sm); display:flex; align-items:center; cursor:pointer; border:none; transition:var(--transition-fast);">
            <span style="font-size:1rem;">↗️</span> Buka Fullscreen
          </button>
          <a href="/api/sppd/generate-docx/${d.id}" class="btn-save" style="width:auto; padding:0 14px; height:36px; font-size:0.8rem; gap:8px; background:#2b579a; color:white; border-radius:var(--radius-sm); display:flex; align-items:center; cursor:pointer; border:none; transition:var(--transition-fast); text-decoration:none;">
            <span style="font-size:1rem;">📄</span> Unduh Word
          </a>
        </div>
      `;

      if (isPdf) {
        docPreview.innerHTML = btnHtml + `
          <iframe src="${d.file_base64}#toolbar=0" type="application/pdf" style="width:100%; height:800px; border:none; border-radius:var(--radius-sm);"></iframe>
        `;
      } else {
        docPreview.innerHTML = btnHtml + `
          <img src="${d.file_base64}" alt="Foto Surat" style="width:100%; display:block; object-fit:contain; max-height:1200px; border-radius:var(--radius-sm); cursor:zoom-in;">
        `;
        docPreview.onclick = (e) => {
          if (e.target.closest('#btnSppdFullscreen')) return;
          openFullscreen(d.file_base64);
        };
      }

      // Attach listener immediately after innerHTML set
      const fsBtn = document.getElementById('btnSppdFullscreen');
      if (fsBtn) {
        fsBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openFullscreen(d.file_base64);
        };
      }
    } else {
      docContainer.style.display = 'block'; 
      docPreview.innerHTML = `
        <div style="padding:40px; text-align:center; color:var(--text-muted); border:2px dashed var(--glass-border); border-radius:var(--radius-md);">
          <div style="font-size:3rem; margin-bottom:12px; opacity:0.5;">📭</div>
          <p style="font-weight:500;">Belum ada dokumen yang diunggah untuk data ini.</p>
        </div>
      `;
    }

    document.getElementById('detailSppdModal').classList.add('active');
  } catch (err) {
    console.error('ViewDetail Error:', err);
    showToast('Gagal memuat detail SPPD.', 'error');
  }
}

// Global helper to open base64 in new tab using Blob (bypass URI length limits)
function openFullscreen(base64Data) {
  if (!base64Data) return;
  try {
    console.log('Attempting to open fullscreen...');
    const parts = base64Data.split(',');
    if (parts.length < 2) {
      // If it's just raw base64 or doesn't have the data: prefix
      window.open(base64Data, '_blank');
      return;
    }
    
    const mimeMatch = base64Data.match(/data:([^;]+);/);
    const contentType = mimeMatch ? mimeMatch[1] : 'application/pdf';
    
    const byteCharacters = atob(parts[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });
    const url = URL.createObjectURL(blob);
    
    const win = window.open(url, '_blank');
    if (!win) {
      showToast('Pop-up terblokir. Silakan aktifkan izin pop-up browser Anda.', 'error');
    }
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) {
    console.error('Fullscreen Error:', e);
    // Ultimate fallback
    window.open(base64Data, '_blank');
  }
}

function closeDetailModal() {
  document.getElementById('detailSppdModal').classList.remove('active');
}

// ── Modal Konfirmasi Simpan (Cetak/Unduh) ──
function openPrintModal() {
  const btnDownloadWord = document.getElementById('btnDownloadWord');
  if (btnDownloadWord) {
    if (lastSavedId) {
      btnDownloadWord.href = `/api/sppd/generate-docx/${lastSavedId}`;
      btnDownloadWord.onclick = null; // Clear previous handler
      btnDownloadWord.style.display = 'flex'; // Ensure it's visible
    } else {
      btnDownloadWord.style.display = 'none'; // Hide if no ID (safety)
    }
  }
  document.getElementById('printModal').classList.add('active');
}

function closePrintModal() {
  document.getElementById('printModal').classList.remove('active');
}

// ── Format Tanggal ID (dd/mm/yyyy) ──
function formatDateID(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear(); 
  return `${day}/${month}/${year}`;
}

function reformatToISO(dmY) {
  if (!dmY) return '';
  const parts = dmY.split('/');
  if (parts.length !== 3) return dmY;
  let [d, m, y] = parts;
  let yearNum = parseInt(y);
  if (yearNum < 100) yearNum += 2000;
  return `${yearNum}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
