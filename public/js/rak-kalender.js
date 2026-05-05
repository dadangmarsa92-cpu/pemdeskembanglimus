const KALENDER_BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

let rakKalenderDataCache = null;

async function initRakKalender() {
  const sel = document.getElementById('rakKalenderTahunSelector');
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
    sel.onchange = loadRakKalenderData;
  }

  loadRakKalenderData();
}

async function loadRakKalenderData() {
  const grid = document.getElementById('rakKalenderGrid');
  const section = document.getElementById('rakKalenderDetailSection');
  const tahun = document.getElementById('rakKalenderTahunSelector')?.value || new Date().getFullYear().toString();
  
  // Hide details initially
  section.style.display = 'none';

  grid.innerHTML = `
    <div style="grid-column: 1 / -1; padding: 60px; text-align: center; color: var(--text-muted);">
      <div style="font-size: 2rem; margin-bottom: 12px; animation: spin 2s linear infinite;">⏳</div>
      <p>Memuat data kalender tahun ${tahun}...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/rak?tahun=${tahun}`);
    const result = await res.json();

    if (!result.success) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 60px; text-align: center; color: #ef4444;">${result.message}</div>`;
      return;
    }

    rakKalenderDataCache = result;

    if (!result.rabRecords || result.rabRecords.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 60px; text-align: center; color: var(--text-muted); background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="font-size: 3rem; margin-bottom: 16px;">📭</div>
          <h3 style="margin: 0 0 8px; color: var(--text-dark);">Belum Ada Data RAB</h3>
          <p>Kalender kosong karena belum ada RAB yang dibuat.</p>
        </div>
      `;
      return;
    }

    renderRakKalenderCards();
  } catch (err) {
    console.error('Failed to load RAK Kalender data:', err);
    grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 60px; text-align: center; color: #ef4444; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">Gagal memuat data. Periksa koneksi server.</div>`;
  }
}

function renderRakKalenderCards() {
  const grid = document.getElementById('rakKalenderGrid');
  const { rabRecords, rakAllocations } = rakKalenderDataCache;

  // Pre-calculate per month
  const monthData = Array.from({ length: 12 }, () => ({ count: 0, total: 0 }));

  rabRecords.forEach(rec => {
    const items = rec.data_json || [];
    items.forEach((u, idx) => {
      const uraianIndex = u.index !== undefined ? String(u.index) : String(idx);
      const allocKey = `${rec.ss_code}::${uraianIndex}`;
      const allocs = rakAllocations[allocKey] || {};
      
      for (let m = 1; m <= 12; m++) {
        if (allocs[m] && allocs[m] > 0) {
          monthData[m - 1].count += 1;
          monthData[m - 1].total += allocs[m];
        }
      }
    });
  });

  let html = '';
  const currentMonth = new Date().getMonth(); // 0-11

  KALENDER_BULAN_NAMES.forEach((bulanName, i) => {
    const data = monthData[i];
    const isCurrent = i === currentMonth;
    const hasData = data.count > 0;
    
    html += `
      <div onclick="showKalenderDetail(${i + 1})" style="background: white; border-radius: 16px; padding: 20px; border: 2px solid ${isCurrent ? '#3b82f6' : (hasData ? '#e2e8f0' : '#f8fafc')}; box-shadow: ${isCurrent ? '0 4px 12px rgba(59,130,246,0.15)' : 'var(--shadow-sm)'}; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 25px -5px rgba(0,0,0,0.1)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='${isCurrent ? '0 4px 12px rgba(59,130,246,0.15)' : 'var(--shadow-sm)'}';">
        
        ${isCurrent ? '<div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: #3b82f6;"></div>' : ''}
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: ${hasData ? '#0f172a' : '#94a3b8'};">${bulanName}</h3>
          <div style="background: ${hasData ? '#dbeafe' : '#f1f5f9'}; color: ${hasData ? '#1d4ed8' : '#94a3b8'}; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">
            ${data.count} Kegiatan
          </div>
        </div>
        
        <div style="margin-top: auto;">
          <p style="margin: 0 0 4px 0; font-size: 0.8rem; color: #64748b; font-weight: 500;">Total Anggaran:</p>
          <div style="font-size: 1.35rem; font-weight: 800; color: ${hasData ? '#15803d' : '#cbd5e1'};">
            Rp ${data.total.toLocaleString('id-ID')}
          </div>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

function showKalenderDetail(monthNumber) {
  const section = document.getElementById('rakKalenderDetailSection');
  const title = document.getElementById('rakKalenderDetailTitle');
  const subtitle = document.getElementById('rakKalenderDetailSubtitle');
  const content = document.getElementById('rakKalenderDetailContent');

  const { rabRecords, rakAllocations, ssLookup } = rakKalenderDataCache;
  
  // Collect all items for this month
  const groupedItems = {};
  let totalBulan = 0;
  let countBulan = 0;

  rabRecords.forEach(rec => {
    let groupName = rec._groupName || (ssLookup && ssLookup[rec.ss_code]) || rec.ss_code;
    
    const items = rec.data_json || [];
    items.forEach((u, idx) => {
      const uraianIndex = u.index !== undefined ? String(u.index) : String(idx);
      const allocKey = `${rec.ss_code}::${uraianIndex}`;
      const allocs = rakAllocations[allocKey] || {};
      const nominal = allocs[monthNumber];

      if (nominal && nominal > 0) {
        if (!groupedItems[groupName]) {
          groupedItems[groupName] = [];
        }
        groupedItems[groupName].push({
          uraian: u.uraian || `Item ${idx + 1}`,
          nominal: nominal
        });
        totalBulan += nominal;
        countBulan += 1;
      }
    });
  });

  // Update headers
  title.textContent = `Detail Kegiatan: ${KALENDER_BULAN_NAMES[monthNumber - 1]}`;
  subtitle.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><line x1="12" y1="2" x2="12" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> Total ${countBulan} Kegiatan — Rp ${totalBulan.toLocaleString('id-ID')}`;

  if (countBulan === 0) {
    content.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #94a3b8;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px; opacity: 0.5;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        <p style="margin:0; font-size: 1.1rem; font-weight: 500;">Tidak ada jadwal kegiatan di bulan ini.</p>
      </div>
    `;
  } else {
    let html = `<table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
          <th style="padding: 12px 24px; text-align: left; font-size: 0.85rem; color: #475569; width: 60%;">Uraian Kegiatan</th>
          <th style="padding: 12px 24px; text-align: right; font-size: 0.85rem; color: #475569; width: 40%;">Nominal Dialokasikan</th>
        </tr>
      </thead>
      <tbody>
    `;

    Object.keys(groupedItems).forEach(groupName => {
      // Group Header
      html += `
        <tr style="background: #f1f5f9;">
          <td colspan="2" style="padding: 10px 24px; font-weight: 700; font-size: 0.85rem; color: #334155; border-bottom: 1px solid #e2e8f0;">
            ${groupName}
          </td>
        </tr>
      `;
      
      // Items
      groupedItems[groupName].forEach((item, index) => {
        const isLast = index === groupedItems[groupName].length - 1;
        html += `
          <tr style="border-bottom: ${isLast ? '1px solid #cbd5e1' : '1px solid #f1f5f9'}; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            <td style="padding: 12px 24px; font-size: 0.9rem; color: #1e293b; display: flex; align-items: center; gap: 8px;">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: #3b82f6;"></div>
              ${item.uraian}
            </td>
            <td style="padding: 12px 24px; text-align: right; font-size: 0.95rem; font-weight: 600; color: #15803d;">
              Rp ${item.nominal.toLocaleString('id-ID')}
            </td>
          </tr>
        `;
      });
    });

    html += `</tbody></table>`;
    content.innerHTML = html;
  }

  section.style.display = 'block';
  // Scroll to details smoothly
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
