/**
 * RAK Kegiatan (Rencana Anggaran Kas) - Monthly Budget Allocation
 * 
 * Displays all RAB activity items and lets users allocate them
 * to specific months (January - December) via number inputs.
 */

let rakDataCache = null;
const BULAN_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

async function initRakKegiatan() {
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
      const currentYear = new Date().getFullYear();
      sel.innerHTML = `<option value="${currentYear}" selected>${currentYear}</option>`;
    }
  }

  if (sel && !sel.onchange) {
    sel.onchange = loadRakData;
  }

  loadRakData();
}

async function loadRakData() {
  const container = document.getElementById('rakTableContainer');
  const tahun = document.getElementById('rakTahunSelector')?.value || new Date().getFullYear().toString();

  container.innerHTML = `
    <div style="padding: 60px; text-align: center; color: var(--text-muted);">
      <div style="font-size: 2rem; margin-bottom: 12px;">⏳</div>
      <p>Memuat data RAK Kegiatan tahun ${tahun}...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/rak?tahun=${tahun}`);
    const result = await res.json();

    if (!result.success) {
      container.innerHTML = `<div style="padding: 60px; text-align: center; color: #ef4444;">${result.message}</div>`;
      return;
    }

    rakDataCache = result;

    if (!result.rabRecords || result.rabRecords.length === 0) {
      container.innerHTML = `
        <div style="padding: 60px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 16px;">📭</div>
          <h3 style="margin: 0 0 8px; color: var(--text-dark);">Belum Ada Data RAB</h3>
          <p>Silakan isi Rincian Kegiatan di menu <strong>RAB</strong> terlebih dahulu,<br>kemudian kembali ke sini untuk mengalokasikan ke bulan.</p>
        </div>
      `;
      document.getElementById('rakMonthlySummary').style.display = 'none';
      return;
    }

    renderRakTable(result);
  } catch (err) {
    console.error('Failed to load RAK data:', err);
    container.innerHTML = `<div style="padding: 60px; text-align: center; color: #ef4444;">Gagal memuat data RAK. Periksa koneksi server.</div>`;
  }
}

function renderRakTable(data) {
  const container = document.getElementById('rakTableContainer');
  const { rabRecords, rakAllocations, ssLookup } = data;

  // Build flat list of all uraian items from all RAB records
  const flatItems = [];
  rabRecords.forEach(rec => {
    const items = rec.data_json || [];
    let currentGroupName = '';

    items.forEach((item, idx) => {
      // Calculate row total
      const v1 = parseFloat(item.v1) || 0;
      const v2Raw = item.v2;
      const v2 = (v2Raw === '' || v2Raw === undefined || v2Raw === null) ? 1 : (parseFloat(v2Raw) || 0);
      const price = parseFloat(String(item.price).replace(/[^0-9]/g, '')) || 0;
      const rowTotal = (v1 > 0 && price > 0) ? v1 * v2 * price : 0;

      // Track group names for custom groups
      if (item._groupName) {
        currentGroupName = item._groupName;
      }

      const uraianText = item.uraian || `Item ${idx + 1}`;
      const uraianIndex = item.index !== undefined ? String(item.index) : String(idx);
      const allocKey = `${rec.ss_code}::${uraianIndex}`;
      const allocatedMonths = rakAllocations[allocKey] || {};

      flatItems.push({
        ss_code: rec.ss_code,
        ss_name: rec.ss_name,
        judul_kegiatan: rec.judul_kegiatan,
        uraian: uraianText,
        uraian_index: uraianIndex,
        total: rowTotal,
        allocatedMonths: allocatedMonths,
        groupName: currentGroupName,
        hierarchy: ssLookup[rec.ss_name] || null
      });
    });
  });

  if (flatItems.length === 0) {
    container.innerHTML = `
      <div style="padding: 60px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 3rem; margin-bottom: 16px;">📭</div>
        <h3 style="margin: 0 0 8px; color: var(--text-dark);">Data Rincian Kegiatan Kosong</h3>
        <p>Belum ada uraian kegiatan yang diisi di menu RAB.</p>
      </div>
    `;
    document.getElementById('rakMonthlySummary').style.display = 'none';
    return;
  }

  // Group items by ss_code for visual grouping
  const groupedBySsCode = {};
  const ssCodeOrder = [];
  flatItems.forEach(item => {
    if (!groupedBySsCode[item.ss_code]) {
      groupedBySsCode[item.ss_code] = [];
      ssCodeOrder.push(item.ss_code);
    }
    groupedBySsCode[item.ss_code].push(item);
  });

  let html = `
    <div style="overflow-x: auto;">
      <table class="data-table" id="rakTable" style="min-width: 1400px; margin: 0; border: none; border-collapse: collapse;">
        <thead>
          <tr style="background: linear-gradient(135deg, #1e293b, #334155);">
            <th style="padding: 14px 12px; color: white; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; border-right: 1px solid rgba(255,255,255,0.1); text-align: center; width: 40px; position: sticky; left: 0; z-index: 2; background: #1e293b;">No</th>
            <th style="padding: 14px 12px; color: white; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; border-right: 1px solid rgba(255,255,255,0.1); min-width: 250px; position: sticky; left: 40px; z-index: 2; background: #1e293b;">Uraian Kegiatan</th>
            <th style="padding: 14px 12px; color: white; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; border-right: 1px solid rgba(255,255,255,0.1); text-align: right; width: 120px;">Total (Rp)</th>
  `;

  BULAN_NAMES.forEach((b, i) => {
    const colors = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e'];
    html += `<th style="padding: 14px 6px; color: white; font-weight: 700; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; text-align: center; width: 90px; border-right: 1px solid rgba(255,255,255,0.1); background: linear-gradient(135deg, ${colors[i]}22, ${colors[i]}11), #1e293b;">${b}</th>`;
  });

  html += `<th style="padding: 14px 12px; color: white; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 120px; background: #1e293b;">Sisa Dana</th></tr></thead><tbody>`;

  let globalNo = 0;
  ssCodeOrder.forEach(ssCode => {
    const items = groupedBySsCode[ssCode];
    const firstItem = items[0];
    const ssName = firstItem.ss_name;
    const hierarchy = firstItem.hierarchy;
    const judulKegiatan = firstItem.judul_kegiatan;
    
    // Group header row
    let headerLabel = `<strong>${ssCode}</strong> — ${ssName}`;
    if (hierarchy) {
      headerLabel = `<span style="color: var(--text-muted); font-size: 0.7rem;">${hierarchy.bidang_name} › ${hierarchy.sub_bidang_name} ›</span><br><strong style="color: var(--primary);">${ssCode}</strong> — ${ssName}`;
    }
    if (judulKegiatan) {
      headerLabel += ` <span style="color: #6366f1; font-size: 0.78rem;">(${judulKegiatan})</span>`;
    }

    // Calculate group total
    const groupTotal = items.reduce((sum, it) => sum + it.total, 0);

    html += `
      <tr style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-bottom: 2px solid #bae6fd;">
        <td colspan="3" style="padding: 12px 16px; font-weight: 600; font-size: 0.85rem; border-right: 1px solid #bae6fd; line-height: 1.6;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${headerLabel}</span>
            <span style="background: linear-gradient(135deg, #dbeafe, #bfdbfe); padding: 4px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; color: #1d4ed8; white-space: nowrap;">Rp ${groupTotal.toLocaleString('id-ID')}</span>
          </div>
        </td>
    `;

    // Group header month totals
    let groupAllocated = 0;
    BULAN_NAMES.forEach((_, mIdx) => {
      const bulan = mIdx + 1;
      const monthTotal = items.reduce((s, it) => s + (it.allocatedMonths[bulan] || 0), 0);
      groupAllocated += monthTotal;
      html += `<td class="group-month-total" data-bulan="${bulan}" style="text-align: right; padding: 8px 4px; background: ${monthTotal > 0 ? '#dbeafe' : '#f0f9ff'}; border-right: 1px solid #bae6fd; font-size: 0.75rem; font-weight: ${monthTotal > 0 ? '700' : '400'}; color: ${monthTotal > 0 ? '#1d4ed8' : '#94a3b8'};">
        ${monthTotal > 0 ? monthTotal.toLocaleString('id-ID') : '-'}
      </td>`;
    });

    const groupSisa = groupTotal - groupAllocated;
    html += `<td class="group-sisa-total" style="text-align: right; padding: 8px 12px; background: #f0f9ff; font-weight: 700; font-size: 0.8rem; color: ${groupSisa < 0 ? '#ef4444' : (groupSisa === 0 ? '#10b981' : '#64748b')}">Rp ${groupSisa.toLocaleString('id-ID')}</td></tr>`;

    // Uraian rows
    items.forEach(item => {
      if (item.total <= 0) return; // Skip items without value
      globalNo++;
      const isEven = globalNo % 2 === 0;

      html += `<tr class="rak-item-row" data-total="${item.total}" style="border-bottom: 1px solid #f1f5f9; background: ${isEven ? '#fafbfc' : 'white'}; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${isEven ? '#fafbfc' : 'white'}'">`;
      html += `<td style="text-align: center; padding: 10px 8px; border-right: 1px solid #f1f5f9; font-size: 0.8rem; color: var(--text-muted); position: sticky; left: 0; z-index: 1; background: inherit;">${globalNo}</td>`;
      html += `<td style="padding: 10px 12px; border-right: 1px solid #f1f5f9; font-size: 0.85rem; color: var(--text-dark); position: sticky; left: 40px; z-index: 1; background: inherit;">
        <span style="font-weight: 500;">${escapeHtml(item.uraian)}</span>
      </td>`;
      html += `<td style="text-align: right; padding: 10px 12px; border-right: 1px solid #f1f5f9; font-weight: 600; color: #15803d; font-size: 0.82rem; white-space: nowrap;">
        <div style="margin-bottom: 4px;">Rp ${item.total.toLocaleString('id-ID')}</div>
        <button type="button" onclick="bagiRataRak(this)" style="padding: 2px 6px; font-size: 0.65rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; color: #475569; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f8fafc'" title="Bagi Rata ke 12 Bulan">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg> Bagi 12
        </button>
      </td>`;

      // Month inputs
      let itemAllocated = 0;
      for (let m = 1; m <= 12; m++) {
        const nominal = item.allocatedMonths[m] || 0;
        itemAllocated += nominal;
        const inputId = `rak_${item.ss_code}_${item.uraian_index}_${m}`;
        html += `
          <td style="text-align: center; padding: 6px 4px; border-right: 1px solid #f1f5f9;">
            <input type="text" id="${inputId}" class="rak-nominal-input"
              data-ss-code="${item.ss_code}" 
              data-uraian-index="${item.uraian_index}" 
              data-bulan="${m}" 
              data-item-total="${item.total}"
              value="${nominal > 0 ? nominal.toLocaleString('id-ID') : ''}" 
              oninput="formatRupiahInput(this); onRakInputChange()"
              placeholder="-"
              style="width: 100%; height: 28px; text-align: right; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.75rem; color: #1e293b; background: white;">
          </td>
        `;
      }

      const itemSisa = item.total - itemAllocated;
      const sisaColor = itemSisa < 0 ? '#ef4444' : (itemSisa === 0 ? '#10b981' : '#64748b');
      html += `<td class="item-sisa-cell" style="text-align: right; padding: 10px 12px; font-weight: 600; color: ${sisaColor}; font-size: 0.82rem; white-space: nowrap;">Rp ${itemSisa.toLocaleString('id-ID')}</td>`;
      html += `</tr>`;
    });
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;

  // Render summary
  updateRakMonthlySummary();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatRupiahInput(input) {
  let value = input.value.replace(/[^0-9-]/g, '');
  if (value === '') {
    input.value = '';
    return;
  }
  
  // Handle negative sign
  let isNegative = false;
  if (value.startsWith('-')) {
    isNegative = true;
    value = value.substring(1);
  }

  const numberValue = parseInt(value, 10);
  if (isNaN(numberValue)) {
    input.value = '';
    return;
  }
  
  input.value = (isNegative ? '-' : '') + numberValue.toLocaleString('id-ID');
  
  // Auto reset button if manually edited
  const row = input.closest('tr');
  if (row) {
    const btn = row.querySelector('button[title="Reset Nominal (Kosongkan)"]');
    if (btn) {
      btn.dataset.isDivided = 'false';
      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg> Bagi 12`;
      btn.style.color = '#475569';
      btn.style.borderColor = '#cbd5e1';
      btn.style.background = '#f8fafc';
      btn.title = "Bagi Rata ke 12 Bulan";
    }
  }
}

function onRakInputChange() {
  updateRakMonthlySummary();
}

function updateRakMonthlySummary() {
  const summaryDiv = document.getElementById('rakMonthlySummary');
  const contentDiv = document.getElementById('rakMonthlySummaryContent');
  const inputs = document.querySelectorAll('#rakTable .rak-nominal-input');

  if (inputs.length === 0) {
    summaryDiv.style.display = 'none';
    return;
  }

  const monthTotals = new Array(12).fill(0);
  let grandTotal = 0;

  inputs.forEach(input => {
    const val = input.value.replace(/[^0-9-]/g, '');
    const total = val ? parseFloat(val) : 0;
    const bulan = parseInt(input.dataset.bulan) - 1;
    if (bulan >= 0 && bulan < 12) {
      monthTotals[bulan] += total;
      grandTotal += total;
    }
  });

  const colors = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e'];

  let html = '';
  BULAN_FULL.forEach((name, i) => {
    const val = monthTotals[i];
    const hasValue = val > 0 || val < 0;
    html += `
      <div style="background: ${hasValue ? `linear-gradient(135deg, ${colors[i]}08, ${colors[i]}15)` : '#f8fafc'}; border: 1px solid ${hasValue ? colors[i] + '40' : '#e2e8f0'}; border-radius: 10px; padding: 14px 16px; text-align: center; transition: all 0.2s;">
        <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${hasValue ? colors[i] : '#94a3b8'}; margin-bottom: 6px;">${name}</div>
        <div style="font-size: ${hasValue ? '0.9rem' : '0.82rem'}; font-weight: ${hasValue ? '800' : '500'}; color: ${hasValue ? '#1e293b' : '#cbd5e1'};">
          ${hasValue ? 'Rp ' + val.toLocaleString('id-ID') : '-'}
        </div>
      </div>
    `;
  });

  // Grand total card
  html += `
    <div style="background: linear-gradient(135deg, #1e293b, #334155); border: 1px solid #475569; border-radius: 10px; padding: 14px 16px; text-align: center; grid-column: span 2;">
      <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 6px;">TOTAL KESELURUHAN</div>
      <div style="font-size: 1.1rem; font-weight: 800; color: #f0fdf4;">
        Rp ${grandTotal.toLocaleString('id-ID')}
      </div>
    </div>
  `;

  contentDiv.innerHTML = html;
  summaryDiv.style.display = 'block';

  // Update item and group totals in table
  updateRakRowTotals();
}

function updateRakRowTotals() {
  const table = document.getElementById('rakTable');
  if (!table) return;

  const rows = table.querySelectorAll('tbody tr');
  let currentGroupRow = null;
  let groupItems = [];

  rows.forEach(row => {
    if (row.querySelector('td[colspan]')) {
      // Process previous group
      if (currentGroupRow && groupItems.length > 0) {
        updateGroupHeaderCells(currentGroupRow, groupItems);
      }
      currentGroupRow = row;
      groupItems = [];
    } else if (row.classList.contains('rak-item-row')) {
      // Process item row
      const inputs = row.querySelectorAll('.rak-nominal-input');
      const itemTotal = parseFloat(row.dataset.total) || 0;
      let itemAllocated = 0;
      const monthVals = new Array(13).fill(0); // 1-12

      inputs.forEach(input => {
        const valStr = input.value.replace(/[^0-9-]/g, '');
        const val = valStr ? parseFloat(valStr) : 0;
        const bulan = parseInt(input.dataset.bulan);
        monthVals[bulan] = val;
        itemAllocated += val;
      });

      // Update item sisa dana cell
      const sisaCell = row.querySelector('.item-sisa-cell');
      if (sisaCell) {
        const sisa = itemTotal - itemAllocated;
        sisaCell.innerHTML = `Rp ${sisa.toLocaleString('id-ID')}`;
        sisaCell.style.color = sisa < 0 ? '#ef4444' : (sisa === 0 ? '#10b981' : '#64748b');
      }

      groupItems.push({ total: itemTotal, monthVals });
    }
  });

  // Process last group
  if (currentGroupRow && groupItems.length > 0) {
    updateGroupHeaderCells(currentGroupRow, groupItems);
  }
}

function updateGroupHeaderCells(groupRow, items) {
  // calculate group totals
  const groupTotal = items.reduce((sum, it) => sum + it.total, 0);
  let groupAllocated = 0;
  
  // update month cells
  const monthCells = groupRow.querySelectorAll('.group-month-total');
  monthCells.forEach(cell => {
    const bulan = parseInt(cell.dataset.bulan);
    const monthTotal = items.reduce((s, it) => s + it.monthVals[bulan], 0);
    groupAllocated += monthTotal;
    
    cell.innerHTML = monthTotal > 0 ? monthTotal.toLocaleString('id-ID') : '-';
    cell.style.fontWeight = monthTotal > 0 ? '700' : '400';
    cell.style.color = monthTotal > 0 ? '#1d4ed8' : '#94a3b8';
    cell.style.background = monthTotal > 0 ? '#dbeafe' : '#f0f9ff';
  });

  // update group sisa dana
  const sisaCell = groupRow.querySelector('.group-sisa-total');
  if (sisaCell) {
    const sisa = groupTotal - groupAllocated;
    sisaCell.innerHTML = `Rp ${sisa.toLocaleString('id-ID')}`;
    sisaCell.style.color = sisa < 0 ? '#ef4444' : (sisa === 0 ? '#10b981' : '#64748b');
  }
}

window.saveRakKegiatan = async function() {
  const btn = document.getElementById('btnSaveRak');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '⏳ Menyimpan...';
  btn.disabled = true;

  try {
    const tahun = document.getElementById('rakTahunSelector')?.value || new Date().getFullYear().toString();
    const inputs = document.querySelectorAll('#rakTable .rak-nominal-input');
    
    const allocations = [];
    inputs.forEach(input => {
      const valStr = input.value.replace(/[^0-9-]/g, '');
      const nominal = valStr ? parseFloat(valStr) : 0;
      if (nominal > 0 || nominal < 0) { // save both positive and negative (just in case)
        allocations.push({
          ss_code: input.dataset.ssCode,
          uraian_index: input.dataset.uraianIndex,
          bulan: parseInt(input.dataset.bulan),
          nominal: nominal
        });
      }
    });

    const res = await fetch('/api/rak/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tahun, allocations })
    });

    const result = await res.json();
    if (result.success) {
      showToast('Data RAK Kegiatan berhasil disimpan! ✅', 'success');
    } else {
      showToast('Gagal menyimpan: ' + result.message, 'error');
    }
  } catch (err) {
    console.error('Error saving RAK:', err);
    showToast('Terjadi kesalahan saat menyimpan RAK.', 'error');
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
};

window.bagiRataRak = function(btn) {
  const row = btn.closest('tr.rak-item-row');
  if (!row) return;
  
  const total = parseFloat(row.dataset.total) || 0;
  if (total <= 0) return;
  
  const inputs = row.querySelectorAll('.rak-nominal-input');
  const isDivided = btn.dataset.isDivided === 'true';

  if (isDivided) {
    inputs.forEach(input => input.value = '');
    
    // Reset button UI
    btn.dataset.isDivided = 'false';
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg> Bagi 12`;
    btn.style.color = '#475569';
    btn.style.borderColor = '#cbd5e1';
    btn.style.background = '#f8fafc';
    btn.title = "Bagi Rata ke 12 Bulan";
  } else {
    const base = Math.floor(total / 12);
    const remainder = total - (base * 11);
    
    inputs.forEach(input => {
      const bulan = parseInt(input.dataset.bulan);
      if (bulan === 12) {
        input.value = remainder > 0 ? remainder.toLocaleString('id-ID') : (remainder < 0 ? '-' + Math.abs(remainder).toLocaleString('id-ID') : '');
      } else {
        input.value = base > 0 ? base.toLocaleString('id-ID') : '';
      }
    });

    // Set Reset button UI
    btn.dataset.isDivided = 'true';
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg> Reset`;
    btn.style.color = '#ef4444';
    btn.style.borderColor = '#fca5a5';
    btn.style.background = '#fef2f2';
    btn.title = "Reset Nominal (Kosongkan)";
  }
  
  // Update totals and summaries
  onRakInputChange();
};
