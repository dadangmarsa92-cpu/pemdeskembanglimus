// ============================================================
// SPPD MODULE - Form handling, data table, print
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initSppdForm();
  loadSppdData();
  loadStats();
});

let lastSavedId = null;

// ── Initialize SPPD Form ──
function initSppdForm() {
  const form = document.getElementById('sppdForm');
  const btnCancel = document.getElementById('btnCancelSppd');
  const btnPrintYes = document.getElementById('btnPrintYes');
  const btnPrintNo = document.getElementById('btnPrintNo');

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSppd();
  });

  // Cancel button
  btnCancel.addEventListener('click', () => {
    form.reset();
  });

  // Print modal buttons
  btnPrintYes.addEventListener('click', () => {
    closePrintModal();
    if (lastSavedId) {
      printSppd(lastSavedId);
    }
  });

  btnPrintNo.addEventListener('click', () => {
    closePrintModal();
  });

  // Close modal on overlay click
  document.getElementById('printModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closePrintModal();
    }
  });
}

// ── Save SPPD ──
async function saveSppd() {
  const data = {
    nomor_surat: document.getElementById('sppdNomor').value.trim(),
    nama_pegawai: document.getElementById('sppdNama').value.trim(),
    jabatan: document.getElementById('sppdJabatan').value.trim(),
    acara: document.getElementById('sppdAcara').value.trim(),
    kendaraan: document.getElementById('sppdKendaraan').value.trim(),
    tujuan: document.getElementById('sppdTujuan').value.trim(),
    lama_perjalanan: document.getElementById('sppdLama').value.trim(),
    tanggal_berangkat: document.getElementById('sppdTglBerangkat').value,
    tanggal_kembali: document.getElementById('sppdTglKembali').value
  };

  // Validate all fields
  for (const [key, val] of Object.entries(data)) {
    if (!val) {
      showToast('Semua field wajib diisi.', 'error');
      return;
    }
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
      document.getElementById('sppdForm').reset();
      loadSppdData();
      loadStats();
      openPrintModal();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Gagal menyimpan data SPPD.', 'error');
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
              <button class="btn-action btn-print" onclick="printSppd(${item.id})" title="Cetak">
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

// ── Load Stats for Dashboard ──
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
      loadSppdData();
      loadStats();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('Gagal menghapus data.', 'error');
  }
}

// ── Print SPPD ──
function printSppd(id) {
  const printWindow = window.open(`/sppd-print.html?id=${id}`, '_blank', 'width=800,height=1000');
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

// ── Format Date ──
function formatDateID(dateStr) {
  if (!dateStr) return '-';
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
