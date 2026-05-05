/**
 * RAK Kegiatan (Rencana Anggaran Kegiatan)
 * Displays all RAB activities that have budget allocated,
 * and allows users to assign execution months (Jan-Dec).
 * Now includes expandable rincian detail items per kegiatan.
 */

let rakData = [];
let rakDirty = false; // Track unsaved changes
let rakExpandedItems = new Set(); // Track which items are expanded

const BULAN_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e'
];
const BULAN_FOOT_IDS = ['rakFootJan', 'rakFootFeb', 'rakFootMar', 'rakFootApr', 'rakFootMei', 'rakFootJun', 'rakFootJul', 'rakFootAgt', 'rakFootSep', 'rakFootOkt', 'rakFootNov', 'rakFootDes'];

async function initRak() {
  const sel = document.getElementById('rakTahunSelector');
  if (sel && sel.options.length === 0) {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      const currentYear = data.settings?.tahun ? parseInt(data.settings.tahun) : new Date().getFullYear();
      sel.innerHTML = '';
      for (let i = currentYear - 5; i <= currentYear + 20; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.text = i;
        if (i === currentYear) opt.selected = true;
        sel.appendChild(opt);
      }
    } catch (e) {
      const cy = new Date().getFullYear();
      sel.innerHTML = `<option value="${cy}" selected>${cy}</option>`;
    }
  }

  if (sel && !sel.onchange) {
    sel.onchange = loadRakData;
  }

  loadRakData();
}

async function loadRakData() {
  const tbody = document.getElementById('rakTableBody');
  const tfoot = document.getElementById('rakTableFoot');
  const sel = document.getElementById('rakTahunSelector');
  const tahun = sel ? sel.value : new Date().getFullYear().toString();

  tbody.innerHTML = '<tr><td colspan="16" style="text-align:center; padding:50px 20px; color:var(--text-muted);"><div style="font-size:1.5rem; margin-bottom:8px;">⏳</div>Memuat data RAK Kegiatan...</td></tr>';

  try {
    const res = await fetch(`/api/rak?tahun=${tahun}`);
    const result = await res.json();

    if (result.success) {
      rakData = result.data;
      rakDirty = false;
      renderRakTable(rakData);
      renderRakSummaryCards(rakData);
      if (tfoot) tfoot.style.display = rakData.length > 0 ? '' : 'none';
    } else {
      tbody.innerHTML = `<tr><td colspan="16" style="text-align:center; padding:50px; color:#ef4444;">${result.message}</td></tr>`;
    }
  } catch (err) {
    console.error('Failed to load RAK data:', err);
    tbody.innerHTML = '<tr><td colspan="16" style="text-align:center; padding:50px; color:#ef4444;">Gagal memuat data RAK.</td></tr>';
  }
}

function toggleRakExpand(ssCode) {
  if (rakExpandedItems.has(ssCode)) {
    rakExpandedItems.delete(ssCode);
  } else {
    rakExpandedItems.add(ssCode);
  }
  renderRakTable(rakData);
}

function toggleAllRakExpand() {
  if (rakExpandedItems.size === rakData.filter(d => d.rincian && d.rincian.length > 0).length) {
    // All expanded, collapse all
    rakExpandedItems.clear();
  } else {
    // Expand all that have rincian
    rakData.forEach(d => {
      if (d.rincian && d.rincian.length > 0) {
        rakExpandedItems.add(d.ss_code);
      }
    });
  }
  renderRakTable(rakData);
}

function renderRakTable(data) {
  const tbody = document.getElementById('rakTableBody');
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="16" style="text-align:center; padding:60px 20px; color:var(--text-muted);">
        <div style="font-size:2.5rem; margin-bottom:12px;">📭</div>
        <h3 style="margin:0 0 8px; color:var(--text-dark);">Belum Ada Data</h3>
        <p style="margin:0; font-size:0.9rem;">Tidak ada kegiatan RAB yang memiliki anggaran terisi untuk tahun ini.<br>Silakan isi anggaran di menu <strong>RAB</strong> terlebih dahulu.</p>
      </td></tr>`;
    return;
  }

  // Group data by bidang
  const grouped = {};
  const bidangOrder = [];
  data.forEach(item => {
    const key = item.bidang_name || 'Lainnya';
    if (!grouped[key]) {
      grouped[key] = { bidang_no: item.bidang_no, items: [] };
      bidangOrder.push(key);
    }
    grouped[key].items.push(item);
  });

  let globalNo = 0;
  let html = '';

  // Toggle all button row
  const totalWithRincian = data.filter(d => d.rincian && d.rincian.length > 0).length;
  if (totalWithRincian > 0) {
    const allExpanded = rakExpandedItems.size === totalWithRincian;
    html += `
      <tr style="background: #fefce8;">
        <td colspan="16" style="padding:8px 16px; border-bottom: 1px solid #fde68a;">
          <button onclick="toggleAllRakExpand()" style="
            background: none; border: 1px solid #d97706; color: #92400e; cursor: pointer;
            padding: 4px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 600;
            display: inline-flex; align-items: center; gap: 6px;
            transition: all 0.2s;
          " onmouseover="this.style.background='#fef3c7'" onmouseout="this.style.background='none'">
            <span style="font-size:0.9rem;">${allExpanded ? '📁' : '📂'}</span>
            ${allExpanded ? 'Tutup Semua Rincian' : 'Buka Semua Rincian'} (${totalWithRincian} kegiatan)
          </button>
        </td>
      </tr>`;
  }

  bidangOrder.forEach(bidangName => {
    const group = grouped[bidangName];

    // Group sub-bidang within bidang
    const subGroups = {};
    const subOrder = [];
    group.items.forEach(item => {
      const subKey = item.sub_name || 'Umum';
      if (!subGroups[subKey]) {
        subGroups[subKey] = { sub_no: item.sub_no, items: [] };
        subOrder.push(subKey);
      }
      subGroups[subKey].items.push(item);
    });

    // Bidang header row
    html += `
      <tr class="rak-bidang-header" style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe);">
        <td colspan="16" style="padding:12px 16px; font-weight:800; font-size:0.9rem; color:#0c4a6e; border-bottom: 2px solid #bae6fd;">
          <span style="display:inline-flex; align-items:center; gap:8px;">
            <span style="background:#0284c7; color:white; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;">${group.bidang_no || '-'}</span>
            📁 ${bidangName}
          </span>
        </td>
      </tr>`;

    subOrder.forEach(subName => {
      const sub = subGroups[subName];

      // Sub-bidang header
      html += `
        <tr class="rak-sub-header" style="background: #f8fafc;">
          <td colspan="16" style="padding:10px 16px 10px 36px; font-weight:700; font-size:0.85rem; color:#334155; border-bottom: 1px solid #e2e8f0;">
            <span style="color:#64748b; font-size:0.75rem; margin-right:6px;">${sub.sub_no || '-'}</span>
            ${subName}
          </td>
        </tr>`;

      // Activity rows
      sub.items.forEach(item => {
        globalNo++;
        const selectedBulan = item.bulan || [];
        const hasRincian = item.rincian && item.rincian.length > 0;
        const isExpanded = rakExpandedItems.has(item.ss_code);

        let monthCells = '';
        for (let m = 1; m <= 12; m++) {
          const mStr = String(m);
          const isChecked = selectedBulan.includes(mStr);

          monthCells += `
            <td style="text-align:center; padding:6px 2px; border-right: 1px solid #f1f5f9;">
              <label style="display:flex; align-items:center; justify-content:center; cursor:pointer;">
                <input type="checkbox" 
                  class="rak-month-cb" 
                  data-ss-code="${item.ss_code}" 
                  data-bulan="${m}" 
                  ${isChecked ? 'checked' : ''}
                  onchange="onRakCheckChange(this)"
                  style="
                    width:18px; height:18px; cursor:pointer; 
                    accent-color:${BULAN_COLORS[m - 1]};
                    border-radius:4px;
                  "
                >
              </label>
            </td>`;
        }

        // Expand/collapse button
        const expandBtn = hasRincian
          ? `<button onclick="event.stopPropagation(); toggleRakExpand('${item.ss_code}')" style="
              background: ${isExpanded ? '#dbeafe' : '#f1f5f9'}; 
              border: 1px solid ${isExpanded ? '#93c5fd' : '#e2e8f0'}; 
              color: ${isExpanded ? '#1d4ed8' : '#64748b'};
              cursor: pointer; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; 
              font-weight: 600; display: inline-flex; align-items: center; gap: 3px;
              transition: all 0.2s; margin-right: 6px; vertical-align: middle;
            " onmouseover="this.style.background='${isExpanded ? '#bfdbfe' : '#e2e8f0'}'" onmouseout="this.style.background='${isExpanded ? '#dbeafe' : '#f1f5f9'}'">
              <span style="font-size:0.65rem; transition: transform 0.2s; display:inline-block; transform: rotate(${isExpanded ? '90' : '0'}deg);">▶</span>
              ${item.rincian.length}
            </button>`
          : '<span style="display:inline-block; width:36px; margin-right:6px;"></span>';

        const displayName = item.judul_kegiatan
          ? `<div style="font-weight:600; color:var(--text-dark); font-size:0.85rem;">${expandBtn}${item.ss_name}</div><div style="font-size:0.75rem; color:#64748b; margin-top:2px; padding-left:42px;">📌 ${item.judul_kegiatan}</div>`
          : `<div style="font-weight:500; color:var(--text-dark); font-size:0.85rem;">${expandBtn}${item.ss_name}</div>`;

        const totalDisplay = item.grand_total > 0
          ? 'Rp. ' + Math.round(item.grand_total).toLocaleString('id-ID')
          : '-';

        html += `
          <tr class="rak-activity-row" data-ss-code="${item.ss_code}" style="transition: background 0.15s; ${isExpanded ? 'background:#f0f9ff;' : ''}" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${isExpanded ? '#f0f9ff' : 'transparent'}'">
            <td style="text-align:center; padding:10px 8px; color:var(--text-muted); font-size:0.8rem; border-right: 1px solid #f1f5f9;">${globalNo}</td>
            <td style="text-align:center; padding:10px 6px; font-family:'JetBrains Mono','Courier New',monospace; color:var(--primary); font-weight:700; font-size:0.75rem; border-right: 1px solid #f1f5f9; white-space:nowrap;">${item.ss_code}</td>
            <td style="padding:10px 12px; border-right: 1px solid #f1f5f9;">${displayName}</td>
            <td style="text-align:right; padding:10px 12px; font-weight:600; color:#0369a1; font-size:0.8rem; border-right: 1px solid #f1f5f9; white-space:nowrap;">${totalDisplay}</td>
            ${monthCells}
          </tr>`;

        // Expanded rincian detail rows
        if (isExpanded && hasRincian) {
          html += `
            <tr class="rak-rincian-header-row">
              <td colspan="16" style="padding:0; border-bottom: none;">
                <div style="
                  margin: 0 16px 0 56px; 
                  background: linear-gradient(135deg, #fafafa, #f5f5f5);
                  border-left: 3px solid #3b82f6;
                  border-radius: 0 8px 8px 0;
                  overflow: hidden;
                  box-shadow: inset 0 1px 3px rgba(0,0,0,0.06);
                ">
                  <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                    <thead>
                      <tr style="background: linear-gradient(135deg, #e0f2fe, #dbeafe);">
                        <th style="padding:8px 10px; text-align:center; width:35px; color:#1e40af; font-weight:700; font-size:0.7rem; border-bottom:1px solid #bfdbfe;">#</th>
                        <th style="padding:8px 12px; text-align:left; color:#1e40af; font-weight:700; font-size:0.7rem; border-bottom:1px solid #bfdbfe;">Uraian Belanja</th>
                        <th style="padding:8px 10px; text-align:center; width:65px; color:#1e40af; font-weight:700; font-size:0.7rem; border-bottom:1px solid #bfdbfe;">Vol 1</th>
                        <th style="padding:8px 10px; text-align:center; width:65px; color:#1e40af; font-weight:700; font-size:0.7rem; border-bottom:1px solid #bfdbfe;">Sat 1</th>
                        <th style="padding:8px 10px; text-align:center; width:65px; color:#1e40af; font-weight:700; font-size:0.7rem; border-bottom:1px solid #bfdbfe;">Vol 2</th>
                        <th style="padding:8px 10px; text-align:center; width:65px; color:#1e40af; font-weight:700; font-size:0.7rem; border-bottom:1px solid #bfdbfe;">Sat 2</th>
                        <th style="padding:8px 12px; text-align:right; width:120px; color:#1e40af; font-weight:700; font-size:0.7rem; border-bottom:1px solid #bfdbfe;">Harga Sat</th>
                        <th style="padding:8px 12px; text-align:right; width:120px; color:#1e40af; font-weight:700; font-size:0.7rem; border-bottom:1px solid #bfdbfe;">Total</th>
                      </tr>
                    </thead>
                    <tbody>`;

          item.rincian.forEach((rin, idx) => {
            const hargaDisplay = rin.harga ? 'Rp ' + Math.round(Number(rin.harga)).toLocaleString('id-ID') : '-';
            const totalRinDisplay = rin.total ? 'Rp ' + Math.round(Number(rin.total)).toLocaleString('id-ID') : '-';
            const isEven = idx % 2 === 0;

            html += `
                      <tr style="background:${isEven ? 'white' : '#fafafa'}; transition: background 0.15s;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${isEven ? 'white' : '#fafafa'}'">
                        <td style="padding:7px 10px; text-align:center; color:#94a3b8; font-size:0.75rem; border-bottom:1px solid #f1f5f9;">${idx + 1}</td>
                        <td style="padding:7px 12px; color:#334155; font-weight:500; border-bottom:1px solid #f1f5f9;">
                          <span style="display:inline-flex; align-items:center; gap:6px;">
                            <span style="color:#3b82f6; font-size:0.7rem;">●</span>
                            ${rin.uraian}
                          </span>
                        </td>
                        <td style="padding:7px 10px; text-align:center; color:#64748b; font-size:0.78rem; border-bottom:1px solid #f1f5f9;">${rin.vol1 || '-'}</td>
                        <td style="padding:7px 10px; text-align:center; color:#64748b; font-size:0.78rem; border-bottom:1px solid #f1f5f9;">${rin.satuan1 || '-'}</td>
                        <td style="padding:7px 10px; text-align:center; color:#64748b; font-size:0.78rem; border-bottom:1px solid #f1f5f9;">${rin.vol2 || '-'}</td>
                        <td style="padding:7px 10px; text-align:center; color:#64748b; font-size:0.78rem; border-bottom:1px solid #f1f5f9;">${rin.satuan2 || '-'}</td>
                        <td style="padding:7px 12px; text-align:right; color:#475569; font-size:0.78rem; font-weight:500; border-bottom:1px solid #f1f5f9; white-space:nowrap;">${hargaDisplay}</td>
                        <td style="padding:7px 12px; text-align:right; color:#0369a1; font-size:0.78rem; font-weight:600; border-bottom:1px solid #f1f5f9; white-space:nowrap;">${totalRinDisplay}</td>
                      </tr>`;
          });

          // Sub-total row
          const subTotal = item.rincian.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
          html += `
                      <tr style="background: linear-gradient(135deg, #ecfdf5, #d1fae5);">
                        <td colspan="7" style="padding:8px 12px; text-align:right; font-weight:700; font-size:0.78rem; color:#065f46; border-top:1px solid #a7f3d0;">Sub Total</td>
                        <td style="padding:8px 12px; text-align:right; font-weight:800; font-size:0.8rem; color:#065f46; border-top:1px solid #a7f3d0; white-space:nowrap;">Rp ${Math.round(subTotal).toLocaleString('id-ID')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>`;
        }
      });
    });
  });

  tbody.innerHTML = html;
  updateRakFooterTotals();
}

function onRakCheckChange(cb) {
  rakDirty = true;

  const ssCode = cb.dataset.ssCode;
  const bulan = cb.dataset.bulan;

  // Update rakData in memory
  const item = rakData.find(d => d.ss_code === ssCode);
  if (item) {
    if (cb.checked) {
      if (!item.bulan.includes(bulan)) item.bulan.push(bulan);
    } else {
      item.bulan = item.bulan.filter(b => b !== bulan);
    }
  }

  updateRakFooterTotals();
  renderRakSummaryCards(rakData);

  // Visual feedback on the save button
  const btn = document.getElementById('btnSaveRak');
  if (btn && !btn.classList.contains('rak-unsaved')) {
    btn.classList.add('rak-unsaved');
    btn.style.animation = 'pulse 1.5s ease-in-out infinite';
  }
}

function updateRakFooterTotals() {
  const monthTotals = new Array(12).fill(0);

  rakData.forEach(item => {
    const bulanArr = item.bulan || [];
    bulanArr.forEach(m => {
      const idx = parseInt(m) - 1;
      if (idx >= 0 && idx < 12) {
        monthTotals[idx] += item.grand_total || 0;
      }
    });
  });

  BULAN_FOOT_IDS.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) {
      const val = Math.round(monthTotals[i]);
      if (val > 0) {
        // Show in millions for compact display
        if (val >= 1000000) {
          el.textContent = (val / 1000000).toFixed(1) + 'jt';
        } else if (val >= 1000) {
          el.textContent = (val / 1000).toFixed(0) + 'rb';
        } else {
          el.textContent = val.toLocaleString('id-ID');
        }
        el.style.color = '#065f46';
        el.style.fontWeight = '800';
      } else {
        el.textContent = '-';
        el.style.color = '#94a3b8';
        el.style.fontWeight = '400';
      }
    }
  });
}

function renderRakSummaryCards(data) {
  const container = document.getElementById('rakSummaryCards');
  if (!container) return;

  const monthTotals = new Array(12).fill(0);
  const monthCounts = new Array(12).fill(0);

  data.forEach(item => {
    const bulanArr = item.bulan || [];
    bulanArr.forEach(m => {
      const idx = parseInt(m) - 1;
      if (idx >= 0 && idx < 12) {
        monthTotals[idx] += item.grand_total || 0;
        monthCounts[idx]++;
      }
    });
  });

  let html = '';
  for (let i = 0; i < 12; i++) {
    const total = Math.round(monthTotals[i]);
    const count = monthCounts[i];
    const color = BULAN_COLORS[i];
    const hasData = count > 0;

    const displayTotal = total > 0
      ? (total >= 1000000
          ? 'Rp ' + (total / 1000000).toFixed(1) + ' Jt'
          : 'Rp ' + total.toLocaleString('id-ID'))
      : 'Rp 0';

    html += `
      <div style="
        background: ${hasData ? 'white' : '#f8fafc'};
        border-radius: 10px;
        padding: 12px 14px;
        border: 1px solid ${hasData ? color + '40' : '#e2e8f0'};
        box-shadow: ${hasData ? '0 2px 8px ' + color + '15' : 'none'};
        transition: all 0.2s;
        cursor: default;
      " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px ${color}25'" onmouseout="this.style.transform=''; this.style.boxShadow='${hasData ? '0 2px 8px ' + color + '15' : 'none'}'">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <span style="font-weight:700; font-size:0.8rem; color:${hasData ? color : '#94a3b8'};">${BULAN_FULL[i]}</span>
          ${count > 0 ? `<span style="background:${color}20; color:${color}; padding:1px 6px; border-radius:10px; font-size:0.65rem; font-weight:700;">${count}</span>` : ''}
        </div>
        <div style="font-weight:700; font-size:0.75rem; color:${hasData ? '#1e293b' : '#cbd5e1'};">${displayTotal}</div>
      </div>`;
  }

  container.innerHTML = html;
}

async function saveRakBulk() {
  const sel = document.getElementById('rakTahunSelector');
  const tahun = sel ? sel.value : new Date().getFullYear().toString();
  const btn = document.getElementById('btnSaveRak');

  if (!rakData || rakData.length === 0) {
    if (typeof showToast === 'function') showToast('Tidak ada data RAK untuk disimpan.', 'error');
    return;
  }

  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<span style="display:inline-flex; align-items:center; gap:6px;">⏳ Menyimpan...</span>';
    btn.disabled = true;
  }

  try {
    const items = rakData.map(d => ({
      ss_code: d.ss_code,
      bulan: d.bulan || []
    }));

    const res = await fetch('/api/rak/save-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tahun, items })
    });

    const result = await res.json();
    if (result.success) {
      rakDirty = false;
      if (typeof showToast === 'function') showToast(`RAK Kegiatan berhasil disimpan untuk Tahun ${tahun}`, 'success');
      if (btn) {
        btn.classList.remove('rak-unsaved');
        btn.style.animation = '';
      }
    } else {
      if (typeof showToast === 'function') showToast('Gagal menyimpan: ' + result.message, 'error');
    }
  } catch (err) {
    console.error('Error saving RAK:', err);
    if (typeof showToast === 'function') showToast('Terjadi kesalahan saat menyimpan RAK.', 'error');
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
}
