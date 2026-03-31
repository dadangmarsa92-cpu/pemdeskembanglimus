/**
 * RAB (Rencana Anggaran Biaya) - Hierarchical Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initRabForm();
  loadRabList();
});

function initRabForm() {
  const bidangSel = document.getElementById('rabBidang');
  const subBidangSel = document.getElementById('rabSubBidang');
  const subSubBidangSel = document.getElementById('rabSubSubBidang');
  const kegiatanSel = document.getElementById('rabKegiatan');
  const belanjaSel = document.getElementById('rabBelanja');
  const form = document.getElementById('rabForm');

  if (!bidangSel) return;

  // 1. Initial Load: Bidang
  loadBidang();

  // 2. Change Handlers
  bidangSel.addEventListener('change', () => {
    resetDropdowns(['subBidang', 'subSubBidang', 'kegiatan', 'belanja']);
    if (bidangSel.value) loadSubBidang(bidangSel.value);
  });

  subBidangSel.addEventListener('change', () => {
    resetDropdowns(['subSubBidang', 'kegiatan', 'belanja']);
    if (subBidangSel.value) loadSubSubBidang(subBidangSel.value);
  });

  subSubBidangSel.addEventListener('change', () => {
    resetDropdowns(['kegiatan', 'belanja']);
    if (subSubBidangSel.value) loadKegiatan(subSubBidangSel.value);
  });

  kegiatanSel.addEventListener('change', () => {
    resetDropdowns(['belanja']);
    if (kegiatanSel.value) loadBelanja(kegiatanSel.value);
  });

  // 3. Form Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveRab();
  });
}

// ── Dropdown Loaders ──

async function loadBidang() {
  const sel = document.getElementById('rabBidang');
  try {
    const res = await fetch('/api/rab/master/bidang');
    const data = await res.json();
    if (data.success) {
      data.list.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
      });
    }
  } catch (err) { console.error(err); }
}

async function loadSubBidang(bidang) {
  const sel = document.getElementById('rabSubBidang');
  try {
    const res = await fetch(`/api/rab/master/sub-bidang?bidang=${encodeURIComponent(bidang)}`);
    const data = await res.json();
    if (data.success) {
      data.list.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
      });
      sel.disabled = false;
    }
  } catch (err) { console.error(err); }
}

async function loadSubSubBidang(sub_bidang) {
  const sel = document.getElementById('rabSubSubBidang');
  try {
    const res = await fetch(`/api/rab/master/sub-sub-bidang?sub_bidang=${encodeURIComponent(sub_bidang)}`);
    const data = await res.json();
    if (data.success) {
      data.list.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
      });
      sel.disabled = false;
    }
  } catch (err) { console.error(err); }
}

async function loadKegiatan(sub_sub_bidang) {
  const sel = document.getElementById('rabKegiatan');
  try {
    const res = await fetch(`/api/rab/master/kegiatan?sub_sub_bidang=${encodeURIComponent(sub_sub_bidang)}`);
    const data = await res.json();
    if (data.success) {
      data.list.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
      });
      sel.disabled = false;
    }
  } catch (err) { console.error(err); }
}

async function loadBelanja(kegiatan) {
  const sel = document.getElementById('rabBelanja');
  try {
    const res = await fetch(`/api/rab/master/belanja?kegiatan=${encodeURIComponent(kegiatan)}`);
    const data = await res.json();
    if (data.success) {
      data.list.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.belanja;
        sel.appendChild(opt);
      });
      sel.disabled = false;
    }
  } catch (err) { console.error(err); }
}

// ── CRUD Operations ──

async function saveRab() {
  const masterId = document.getElementById('rabBelanja').value;
  const tahun = document.getElementById('rabTahun').value;
  const nominalRaw = document.getElementById('rabNominal').value;
  const sumberDana = document.getElementById('rabSumberDana').value;

  if (!masterId || !tahun || !nominalRaw) {
    showToast('Mohon lengkapi semua data.', 'error');
    return;
  }

  const nominal = nominalRaw.replace(/\./g, ''); // Clean format dots

  try {
    const res = await fetch('/api/rab/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ master_id: masterId, tahun, nominal, sumber_dana: sumberDana })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Data RAB berhasil disimpan!', 'success');
      document.getElementById('rabForm').reset();
      resetDropdowns(['subBidang', 'subSubBidang', 'kegiatan', 'belanja']);
      loadRabList();
      updateDashboardStats();
    } else {
      showToast('Gagal menyimpan: ' + data.message, 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Terjadi kesalahan sistem.', 'error');
  }
}

async function loadRabList() {
  const tbody = document.getElementById('rabTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/rab/list');
    const data = await res.json();

    if (data.success) {
      const list = data.data;
      if (list.length === 0) {
        document.getElementById('rabEmptyState').style.display = 'block';
        tbody.innerHTML = '';
        return;
      }

      document.getElementById('rabEmptyState').style.display = 'none';
      tbody.innerHTML = '';
      list.forEach((item, index) => {
        const tr = document.createElement('tr');
        const nominalStr = new Intl.NumberFormat('id-ID').format(item.nominal);
        tr.innerHTML = `
          <td>${index + 1}</td>
          <td>
            <div style="font-weight:600; color:var(--primary); font-size:0.85rem;">${item.bidang}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${item.sub_bidang} » ${item.sub_sub_bidang}</div>
            <div style="margin-top:4px; font-weight:500;">${item.kegiatan}</div>
          </td>
          <td>${item.belanja}</td>
          <td style="font-weight:600; color:var(--success);">Rp. ${nominalStr}</td>
          <td><span class="badge" style="background:rgba(0,0,0,0.05); color:var(--text-main); border:1px solid var(--border-color);">${item.tahun}</span></td>
          <td>
            <button class="btn-action btn-danger" onclick="hapusRab(${item.id})" title="Hapus">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) { console.error(err); }
}

async function hapusRab(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus data RAB ini?')) return;
  try {
    const res = await fetch(`/api/rab/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Data berhasil dihapus.', 'success');
      loadRabList();
      updateDashboardStats();
    }
  } catch (err) { console.error(err); }
}

// ── Helpers ──

function resetDropdowns(ids) {
  const map = {
    subBidang: 'rabSubBidang',
    subSubBidang: 'rabSubSubBidang',
    kegiatan: 'rabKegiatan',
    belanja: 'rabBelanja'
  };

  ids.forEach(idKey => {
    const el = document.getElementById(map[idKey]);
    if (el) {
      el.innerHTML = `<option value="" disabled selected>Pilih ${idKey.replace(/([A-Z])/g, ' $1').trim()}...</option>`;
      el.disabled = true;
    }
  });
}

function initRabNominalFormat() {
  const input = document.getElementById('rabNominal');
  if (input) {
    input.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val) {
        e.target.value = new Intl.NumberFormat('id-ID').format(val);
      } else {
        e.target.value = '';
      }
    });
  }
}

// Export for page switching
window.initRabPage = () => {
  initRabForm();
  loadRabList();
  initRabNominalFormat();
};
