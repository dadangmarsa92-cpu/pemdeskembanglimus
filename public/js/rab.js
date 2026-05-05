/**
 * RAB (Rencana Anggaran Biaya) - 3-Column Drill-down Logic
 */

let rabBidangData = [];
let rabHierarchy = {};
let selectedBidangIdx = 0;
let selectedSubBidangIdx = 0;
let currentBidangId = null;
let currentSubBidangId = null;
let currentSubBidangCode = null;
let rabTotalsMap = {}; // Map: ss_code -> grand_total

async function initRab() {
    const sel = document.getElementById('rabTahunSelector');
    const selLaporan = document.getElementById('laporanRabTahun');
    
    if ((sel && sel.options.length === 0) || (selLaporan && selLaporan.options.length === 0)) {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            const currentYear = data.settings?.tahun ? parseInt(data.settings.tahun) : new Date().getFullYear();
            
            const populate = (s) => {
                if (!s) return;
                s.innerHTML = '';
                for (let i = currentYear - 5; i <= currentYear + 20; i++) {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.text = i;
                    if (i === currentYear) opt.selected = true;
                    s.appendChild(opt);
                }
            };
            
            populate(sel);
            populate(selLaporan);
        } catch (e) {
            console.error('Failed to load settings for RAB year:', e);
            const currentYear = new Date().getFullYear();
            if (sel) sel.innerHTML = `<option value="${currentYear}" selected>${currentYear}</option>`;
            if (selLaporan) selLaporan.innerHTML = `<option value="${currentYear}" selected>${currentYear}</option>`;
        }
    }
    
    if (sel && !sel.onchange) {
        sel.onchange = loadRabExcelData;
    }

    loadRabExcelData();
}

async function loadRabExcelData() {
    const listContainer = document.getElementById('rabBidangList');
    const tahunSel = document.getElementById('rabTahunSelector');
    const tahun = tahunSel ? tahunSel.value : new Date().getFullYear().toString();

    try {
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Memuat...</div>';
        
        // Reset sub and sub-sub panels
        document.getElementById('rabSubBidangList').innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Pilih Bidang terlebih dahulu.</div>';
        document.getElementById('rabSubSubContent').innerHTML = `
            <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 60px 40px; text-align: center; color: var(--text-muted);">
                <div style="font-size: 3rem; margin-bottom: 16px;">📂</div>
                <p>Pilih Sub Bidang untuk melihat rincian kegiatan.</p>
            </div>
        `;
        document.getElementById('rabSubBidangHeader').innerHTML = '';
        document.getElementById('rabSubSubHeader').innerHTML = '';
        document.getElementById('rabSubSubHeader').style.display = 'none';
        
        currentBidangId = null;
        currentSubBidangId = null;
        
        // 1. Fetch Hierarchy (Excel/DB) with cache busting
        const res = await fetch(`/api/rab?t=${new Date().getTime()}`);
        const result = await res.json();

        // 2. Fetch All Totals (DB)
        const resTotals = await fetch(`/api/rab/saved-all?tahun=${tahun}`);
        const resultTotals = await resTotals.json();
        
        rabTotalsMap = {};
        if (resultTotals.success && resultTotals.data) {
            resultTotals.data.forEach(rec => {
                rabTotalsMap[rec.ss_code] = rec.grand_total;
            });
        }

        if (result.success) {
            rabBidangData = result.bidang;
            rabHierarchy = result.hierarchy;
            renderBidangList(rabBidangData);
        } else {
            listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444;">${result.message}</div>`;
        }
    } catch (err) {
        console.error('Failed to load RAB data:', err);
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Error server.</div>';
    }
}

function renderBidangList(data) {
    const listContainer = document.getElementById('rabBidangList');
    listContainer.innerHTML = '';

    data.forEach((item, index) => {
        const bidangName = item.nama_bidang;
        if (!bidangName) return;

        const div = document.createElement('div');
        div.className = 'rab-item rab-bidang-item';
        applyStyles(div, false);
        div.innerHTML = `
            <span class="idx-badge">${String(item.no || (index + 1)).padStart(2, '0')}</span>
            <span style="flex: 1;">${bidangName}</span>
            <div class="hierarchy-actions">
                <button class="edit-btn" onclick="editBidang(event, ${item.id}, '${item.no}', \`${bidangName}\`)" title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="delete-btn" onclick="hapusBidang(event, ${item.id})" title="Hapus">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        `;

        div.onclick = () => {
            selectedBidangIdx = String(item.no || (index + 1)).padStart(2, '0');
            currentBidangId = item.id;
            currentSubBidangId = null;
            setActiveItem('.rab-bidang-item', div);
            showSubBidangList(item.id, bidangName);
        };

        listContainer.appendChild(div);
    });

    // Tombol Tambah Bidang
}

function showSubBidangList(bidangId, bidangName) {
    const subContainer = document.getElementById('rabSubBidangList');
    const ssContainer = document.getElementById('rabSubSubContent');
    
    ssContainer.innerHTML = `
        <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 60px 40px; text-align: center; color: var(--text-muted);">
            <div style="font-size: 3rem; margin-bottom: 16px;">📂</div>
            <p>Pilih Sub Bidang untuk melihat rincian kegiatan.</p>
        </div>
    `;

    subContainer.innerHTML = '';
    const subs = rabHierarchy[bidangId] || {};
    const subIds = Object.keys(subs);

    if (subIds.length === 0) {
        subContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Tidak ada sub bidang.</div>';
    } else {
        subIds.forEach((sId, index) => {
            const subObj = subs[sId];
            const name = subObj.name;
            const div = document.createElement('div');
            div.className = 'rab-item rab-sub-item';
            applyStyles(div, false);
            
            const subCode = subObj.no || `${selectedBidangIdx}.${String(index + 1).padStart(2, '0')}`;
            div.innerHTML = `
                <span class="idx-badge" style="background:#f1f5f9; color:var(--text-dark);">${subCode}</span>
                <span style="flex: 1;">${name}</span>
                <div class="hierarchy-actions">
                    <button class="edit-btn" onclick="editSubBidang(event, ${sId}, '${subCode}', \`${name}\`)" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="delete-btn" onclick="hapusSubBidang(event, ${sId})" title="Hapus">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            `;
            div.onclick = () => {
                currentSubBidangId = sId;
                currentSubBidangCode = subCode;
                setActiveItem('.rab-sub-item', div);
                showSubSubBidang(bidangId, sId, subCode);
            };
            subContainer.appendChild(div);
        });
    }

    const header = document.getElementById('rabSubBidangHeader');
    if (bidangId) {
        header.innerHTML = `<button class="add-hierarchy-btn" style="margin:0;" onclick="tambahSubBidang(${bidangId}, '${bidangName}')"><span>+</span> Tambah Sub Bidang</button>`;
    } else {
        header.innerHTML = '';
    }
}

function showSubSubBidang(bidangId, subId, subCode) {
    const container = document.getElementById('rabSubSubContent');
    const header = document.getElementById('rabSubSubHeader');
    
    const subObj = (rabHierarchy[bidangId] && rabHierarchy[bidangId][subId]) ? rabHierarchy[bidangId][subId] : null;
    const ssList = subObj ? subObj.items : [];
    const subName = subObj ? subObj.name : 'Sub Bidang';

    if (subId) {
        header.style.display = 'block';
        header.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
                <div>
                    <span style="color: var(--primary); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Sub Bidang ${subCode}</span>
                    <h3 style="margin: 4px 0 0 0; font-size: 1.05rem; color: var(--text-dark);">${subName}</h3>
                </div>
                <button class="add-hierarchy-btn" style="margin:0; width:auto; padding: 10px 20px;" onclick="tambahSsBidang(${subId}, '${subName}')"><span>+</span> Tambah Kegiatan Baru</button>
            </div>
        `;
    } else {
        header.style.display = 'none';
        header.innerHTML = '';
    }

    let html = `
        <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f1f5f9; text-align: left;">
                        <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap;">Kode</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Kegiatan / Sub-Sub Bidang</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; white-space: nowrap;">Total (Rp)</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #e2e8f0; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; white-space: nowrap; width: 110px;">Aksi</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (ssList.length > 0) {
        ssList.forEach((ssItem, i) => {
            if (!ssItem || typeof ssItem !== 'object') return;
            const ssCode = ssItem.no || `${subCode}.${String(i + 1).padStart(2, '0')}`;
            const ssName = ssItem.name || 'Tanpa Nama';
            const ssId = ssItem.id;
            const total = rabTotalsMap[ssCode] || 0;
            const displayTotal = total > 0 ? 'Rp. ' + total.toLocaleString('id-ID') : '-';
            const colorTotal = total > 0 ? 'var(--primary)' : 'var(--text-muted)';

            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'" onclick="openRabRincianModal('${ssCode}', \`${ssName}\`)">
                    <td style="padding: 12px 10px; font-family: 'JetBrains Mono', 'Courier New', monospace; color: var(--primary); font-weight: 700; font-size: 0.85rem; vertical-align: top; white-space: nowrap;">${ssCode}</td>
                    <td style="padding: 12px 10px; color: var(--text-dark); font-weight: 500; line-height: 1.5; font-size: 0.85rem;">
                      ${ssName}
                      <div style="font-size: 0.7rem; color: var(--primary); margin-top: 4px; display: inline-flex; align-items: center; gap: 4px;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Isi Rincian
                      </div>
                    </td>
                    <td style="padding: 12px 10px; text-align: right; font-weight: 700; color: ${colorTotal}; font-size: 0.9rem; vertical-align: top; white-space: nowrap;">
                        ${displayTotal}
                    </td>
                    <td style="padding: 12px 10px; text-align: center; vertical-align: top;">
                        <div class="hierarchy-actions" style="justify-content:center;">
                            <button class="edit-btn" onclick="editSsBidang(event, ${ssId}, '${ssCode}', \`${ssName}\`)" title="Edit">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button class="delete-btn" onclick="hapusSsBidang(event, ${ssId})" title="Hapus">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } else {
        html += `<tr><td colspan="4" style="padding: 60px; text-align: center; color: var(--text-muted); font-size: 1rem;">Belum ada rincian kegiatan untuk sub bidang ini.</td></tr>`;
    }

    html += `</tbody></table>
    </div>`;
    container.innerHTML = html;
}

// ── UI Helpers ──

function applyStyles(el, isActive) {
    el.style.padding = '16px 18px';
    el.style.margin = '8px 4px';
    el.style.borderRadius = '12px';
    el.style.cursor = 'pointer';
    el.style.fontSize = '0.95rem';
    el.style.fontWeight = isActive ? '700' : '500';
    el.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    el.style.border = '1px solid ' + (isActive ? 'var(--primary)' : 'transparent');
    el.style.background = isActive ? 'var(--primary-light)' : 'transparent';
    el.style.color = isActive ? 'white' : 'var(--text-dark)';
    el.style.display = 'flex';
    el.style.alignItems = 'flex-start';
    el.style.gap = '14px';
    el.style.boxShadow = isActive ? '0 4px 12px rgba(0,0,0,0.1)' : 'none';

    // Hover effect
    if (isActive) {
        el.onmouseenter = null;
        el.onmouseleave = null;
    } else {
        el.onmouseenter = () => {
            el.style.background = '#f1f5f9';
            el.style.transform = 'translateX(6px)';
        };
        el.onmouseleave = () => {
            if (!el.classList.contains('active')) {
                el.style.background = 'transparent';
                el.style.transform = 'translateX(0)';
            }
        };
    }
}

function setActiveItem(selector, activeEl) {
    document.querySelectorAll(selector).forEach(el => {
        el.classList.remove('active');
        applyStyles(el, false);
    });
    activeEl.classList.add('active');
    applyStyles(activeEl, true);
}

// ── RAB Rincian Modal Logic ──
let currentRabRincianData = [];

window.formatRupiahInput = function(el) {
    let val = el.value.replace(/[^0-9]/g, '');
    if (val) {
        el.value = parseInt(val, 10).toLocaleString('id-ID');
    } else {
        el.value = '';
    }
}

async function openRabRincianModal(ssCode, ssName) {
    document.getElementById('rabRincianModalSubtitle').innerText = `${ssCode} - ${ssName}`;
    document.getElementById('rabRincianTableBody').innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px;">Memuat rincian data...</td></tr>';
    document.getElementById('rabRincianTotalKeseluruhan').innerText = 'Rp. 0';
    document.getElementById('rabRincianModal').style.display = 'flex';

    try {
        const tahun = document.getElementById('rabTahunSelector').value;
        const response = await fetch(`/api/rab/rincian?subSubBidangName=${encodeURIComponent(ssName)}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            currentRabRincianData = result.data;
            
            // Cek apakah sudah ada data tersimpan untuk tahun dan ss_code ini
            const savedRes = await fetch(`/api/rab/saved?tahun=${tahun}&ss_code=${encodeURIComponent(ssCode)}`);
            const savedData = await savedRes.json();
            
            let savedMap = {};
            let savedRecords = [];
            window.deletedExcelIndices = []; // Reset on modal open
            if (savedData.success && savedData.data) {
                savedRecords = savedData.data;
                savedData.data.forEach(item => {
                    if (item._isDeleted) {
                        window.deletedExcelIndices.push(item.index);
                    } else {
                        savedMap[item.index] = item;
                    }
                });
                if (savedData.judul_kegiatan) {
                    document.getElementById('rabRincianJudulKegiatan').value = savedData.judul_kegiatan;
                } else {
                    document.getElementById('rabRincianJudulKegiatan').value = '';
                }
            } else {
                document.getElementById('rabRincianJudulKegiatan').value = '';
            }
            
            renderRabRincianTable(savedMap, savedRecords);
        } else {
            document.getElementById('rabRincianTableBody').innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:red;">${result.message || 'Gagal memuat rincian kegiatan'}</td></tr>`;
        }
    } catch (err) {
        console.error(err);
        document.getElementById('rabRincianTableBody').innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color:red;">Terjadi kesalahan sistem.</td></tr>';
    }
}

window.closeRabRincianModal = function() {
    document.getElementById('rabRincianModal').style.display = 'none';
}

function renderRabRincianTable(savedMap = {}, savedRecords = []) {
    const tbody = document.getElementById('rabRincianTableBody');
    tbody.innerHTML = '';
    
    const hasExcelData = currentRabRincianData && currentRabRincianData.length > 0;
    const hasCustomData = Object.keys(savedMap).some(k => k.startsWith('custom_'));
    
    if (!hasExcelData && !hasCustomData) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted);">Belum ada item rincian. Klik <b>Tambah Uraian Kegiatan</b> untuk menambah.</td></tr>';
        return;
    }

    let noCounter = 1;
    let html = '';
    
    let currentGroupId = null;
    
    // Collect custom items that belong to excel groups
    const excelCustomItems = {};
    Object.keys(savedMap).forEach(k => {
        if (k.startsWith('custom_')) {
            const item = savedMap[k];
            const gId = item._groupId || 'default';
            if (gId.startsWith('excel_')) {
                if (!excelCustomItems[gId]) excelCustomItems[gId] = [];
                excelCustomItems[gId].push({
                    itemId: item._itemId || k,
                    uraian: item.uraian || '',
                    v1: item.v1 || '', sat1: item.sat1 || '',
                    v2: item.v2 || '', sat2: item.sat2 || '',
                    price: item.price || '', catatan: item.catatan || ''
                });
            }
        }
    });

    if (hasExcelData) {
        currentRabRincianData.forEach((item, index) => {
            if (item.isBold) {
                // If there are custom items for the PREVIOUS excel group, append them now
                if (currentGroupId && excelCustomItems[currentGroupId]) {
                    excelCustomItems[currentGroupId].forEach((cItem) => {
                        const cIdxStr = `custom_${currentGroupId}_${cItem.itemId}`;
                        const savedPrice = cItem.price ? parseInt(cItem.price, 10).toLocaleString('id-ID') : '';
                        html += buildCustomSubItemHtml(cIdxStr, currentGroupId, noCounter++, cItem.uraian, cItem, savedPrice);
                    });
                }

                currentGroupId = 'excel_' + index;
                html += `
                    <tr data-excel-group="${currentGroupId}" style="background: #f8fafc; font-weight: bold;">
                        <td style="text-align:center; padding:12px; border-right:1px solid var(--border-color);">
                            <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                                <span class="drag-handle" style="cursor:grab; color:#94a3b8; font-size:1.1rem;" title="Tarik untuk mengurutkan grup">☰</span>
                                <span>${item.uraian.match(/^[a-z]\./i) ? item.uraian.split('.')[0] + '.' : ''}</span>
                            </div>
                        </td>
                        <td colspan="5" style="padding:12px; border-right:1px solid var(--border-color);">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>${item.uraian}</span>
                                <span class="rab-sub-total" style="color:var(--primary); font-size:1.05rem;">Rp. 0</span>
                            </div>
                        </td>
                        <td style="padding:8px; text-align:center; border-right:1px solid var(--border-color);">
                            <button type="button" onclick="event.stopPropagation(); addSubItemToGroup('${currentGroupId}')" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'" style="background:#16a34a; color:white; border:none; border-radius:6px; padding:6px 14px; cursor:pointer; font-size:0.8rem; font-weight:600; white-space:nowrap; width:100%;">+ Sub</button>
                        </td>
                        <td></td>
                    </tr>
                `;
                noCounter = 1; 
            } else {
                let textUraian = item.uraian;
                let displayNo = noCounter++;
                
                const match = textUraian.match(/^(\d+)\s+(.+)$/);
                if (match) {
                    displayNo = match[1];
                    textUraian = match[2];
                }
                
                const saved = savedMap[index] || { v1: '', sat1: '', v2: '', sat2: '', price: '' };
                const savedPrice = saved.price ? parseInt(saved.price, 10).toLocaleString('id-ID') : '';
                
                html += `
                    <tr class="rab-input-row" data-index="${index}" data-group="${currentGroupId || ''}">
                        <td style="text-align:center; border-right:1px solid var(--border-color); padding: 8px; vertical-align: top;">${displayNo}</td>
                        <td style="border-right:1px solid var(--border-color); padding: 8px; font-size:0.9rem; vertical-align: top;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <input type="text" class="form-input" data-field="uraian" value="${textUraian.replace(/"/g, '&quot;')}" placeholder="Ketik nama uraian..." style="flex:1; padding:6px 10px; font-size:0.9rem; border:1px solid #e2e8f0; border-radius:6px; background:white;">
                                <div style="display:flex; gap:4px;">
                                    <button type="button" class="btn-icon" onclick="toggleCatatan(this, '${index}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:2px; filter: grayscale(1);" title="Tambahkan Catatan">📝</button>
                                    <button type="button" class="btn-icon" onclick="hapusCustomUraian(this)" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:2px;" title="Hapus">🗑️</button>
                                </div>
                            </div>
                            <div id="catatan-container-${index}" style="display:${saved.catatan ? 'block' : 'none'}; margin-top:8px;">
                                <input type="text" class="form-input" data-field="catatan" placeholder="Catatan opsional..." value="${saved.catatan || ''}" style="width:100%; padding:4px 8px; font-size:0.8rem; background:#f1f5f9; border:1px dashed #cbd5e1; border-radius:4px;">
                            </div>
                        </td>
                        <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="number" min="0" class="form-input rab-calc" data-field="v1" value="${saved.v1 || ''}" style="width:100%; padding: 6px; text-align:center; height:36px; border-radius:4px;"></td>
                        <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="text" class="form-input" data-field="sat1" placeholder="ls" value="${saved.sat1 || ''}" style="width:100%; padding: 6px; text-align:center; height:36px; border-radius:4px;"></td>
                        <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="number" min="0" class="form-input rab-calc" data-field="v2" value="${saved.v2 || ''}" style="width:100%; padding: 6px; text-align:center; height:36px; border-radius:4px;"></td>
                        <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="text" class="form-input" data-field="sat2" placeholder="org" value="${saved.sat2 || ''}" style="width:100%; padding: 6px; text-align:center; height:36px; border-radius:4px;"></td>
                        <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="text" class="form-input rab-calc price-input" data-field="price" value="${savedPrice}" oninput="formatRupiahInput(this)" style="width:100%; padding: 6px; text-align:right; height:36px; border-radius:4px;"></td>
                        <td style="text-align:right; padding: 8px; font-weight:600; color:var(--text-dark);" class="rab-row-total">Rp. 0</td>
                    </tr>
                `;
            }
        });
        
        // Append custom items for the LAST excel group
        if (currentGroupId && excelCustomItems[currentGroupId]) {
            excelCustomItems[currentGroupId].forEach((cItem) => {
                const cIdxStr = `custom_${currentGroupId}_${cItem.itemId}`;
                const savedPrice = cItem.price ? parseInt(cItem.price, 10).toLocaleString('id-ID') : '';
                html += buildCustomSubItemHtml(cIdxStr, currentGroupId, noCounter++, cItem.uraian, cItem, savedPrice);
            });
        }
    }
    
    // Render custom (user-added) groups
    const customGroups = buildCustomGroupsFromSaved(savedMap);
    if (customGroups.length > 0) {
        customGroups.forEach(group => {
            // Header row with editable name + add sub-item & delete group buttons
            html += `
                <tr data-custom-group="${group.groupId}" style="background: #f0fdf4; font-weight: bold;">
                    <td style="text-align:center; padding:12px; border-right:1px solid var(--border-color);">
                        <span class="drag-handle" style="cursor:grab; color:#94a3b8; font-size:1.1rem;" title="Tarik untuk mengurutkan grup">☰</span>
                    </td>
                    <td colspan="5" style="padding:10px 12px; border-right:1px solid var(--border-color);">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <input type="text" data-field="group-name" value="${(group.name || '').replace(/"/g, '&quot;')}" placeholder="Nama kegiatan..." style="flex:1; padding:6px 10px; font-weight:700; font-size:0.95rem; border:1px solid #86efac; border-radius:6px; background:#f0fdf4; color:#15803d;">
                            <span class="rab-sub-total" style="font-size:1rem; color:#15803d; white-space:nowrap; font-weight:800;">Rp. 0</span>
                        </div>
                    </td>
                    <td style="padding:8px; text-align:center; border-right:1px solid var(--border-color);">
                        <button type="button" onclick="event.stopPropagation(); addSubItemToGroup('${group.groupId}')" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'" style="background:#16a34a; color:white; border:none; border-radius:6px; padding:6px 14px; cursor:pointer; font-size:0.8rem; font-weight:600; white-space:nowrap; width:100%;">+ Sub</button>
                    </td>
                    <td style="padding:8px; text-align:center;">
                        <button type="button" onclick="event.stopPropagation(); hapusCustomGroup('${group.groupId}')" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'" style="background:#fee2e2; border:1px solid #fca5a5; border-radius:6px; cursor:pointer; font-size:1rem; color:#ef4444; padding:4px 8px; width:100%;" title="Hapus seluruh grup ini">🗑️</button>
                    </td>
                </tr>
            `;
            // Sub-item rows
            group.items.forEach((item, i) => {
                const cIdx = `custom_${group.groupId}_${item.itemId}`;
                const savedPrice = item.price ? parseInt(item.price, 10).toLocaleString('id-ID') : '';
                html += buildCustomSubItemHtml(cIdx, group.groupId, i + 1, item.uraian || '', item, savedPrice);
            });
        });
    }
    
    tbody.innerHTML = html;
    
    // --- REORDER DOM BASED ON savedRecords ---
    if (savedRecords && savedRecords.length > 0) {
        const processedHeaders = new Set();
        let currentInsertNode = null;

        savedRecords.forEach(savedItem => {
            const row = tbody.querySelector(`tr[data-index="${savedItem.index}"]`);
            if (row) {
                // If it was marked as deleted, remove it from the DOM
                if (savedItem._isDeleted) {
                    row.remove();
                    return; // Skip reordering logic for this item
                }
                
                const groupId = row.getAttribute('data-group');
                if (groupId) {
                    const header = tbody.querySelector(`tr[data-custom-group="${groupId}"], tr[data-excel-group="${groupId}"]`);
                    if (header && !processedHeaders.has(groupId)) {
                        // Move header to the current position
                        if (currentInsertNode) {
                            currentInsertNode.insertAdjacentElement('afterend', header);
                        } else {
                            tbody.insertBefore(header, tbody.firstChild);
                        }
                        currentInsertNode = header;
                        processedHeaders.add(groupId);
                    }
                }
                
                // Move the item row to the current position
                if (currentInsertNode) {
                    currentInsertNode.insertAdjacentElement('afterend', row);
                } else {
                    tbody.insertBefore(row, tbody.firstChild);
                }
                currentInsertNode = row;
            }
        });
    }
    
    // Attach event listeners to all calculation inputs
    document.querySelectorAll('.rab-calc').forEach(input => {
        input.addEventListener('input', calculateRabTotals);
    });
    
    // Initial calculation if there are saved values
    calculateRabTotals();

    // Enable Drag and Drop
    makeRabRowsDraggable();
}

function calculateRabTotals() {
    let grandTotal = 0;
    const groupTotals = {};
    
    document.querySelectorAll('.rab-input-row').forEach(row => {
        const v1El = row.querySelector('[data-field="v1"]');
        const v2El = row.querySelector('[data-field="v2"]');
        const priceEl = row.querySelector('[data-field="price"]');
        const totalEl = row.querySelector('.rab-row-total');
        const groupId = row.getAttribute('data-group');

        if (!v1El || !priceEl) return;

        const v1 = parseFloat(v1El.value) || 0;
        const v2Raw = v2El ? v2El.value : '';
        const v2 = v2Raw === '' ? 1 : (parseFloat(v2Raw) || 0); 
        const priceRaw = priceEl.value.replace(/[^0-9]/g, '');
        const price = parseFloat(priceRaw) || 0;
        
        let rowTotal = 0;
        if (v1 > 0 && price > 0) {
            rowTotal = v1 * v2 * price;
        }
        
        if (totalEl) {
            totalEl.innerText = 'Rp. ' + rowTotal.toLocaleString('id-ID');
        }
        grandTotal += rowTotal;

        if (groupId) {
            groupTotals[groupId] = (groupTotals[groupId] || 0) + rowTotal;
        }
    });

    // Update Sub-totals in headers
    document.querySelectorAll('.rab-sub-total').forEach(el => {
        el.innerText = 'Rp. 0';
    });

    Object.keys(groupTotals).forEach(gid => {
        const headerRow = document.querySelector(`tr[data-custom-group="${gid}"], tr[data-excel-group="${gid}"]`);
        if (headerRow) {
            const subTotalEl = headerRow.querySelector('.rab-sub-total');
            if (subTotalEl) {
                subTotalEl.innerText = 'Rp. ' + groupTotals[gid].toLocaleString('id-ID');
            }
        }
    });
    
    document.getElementById('rabRincianTotalKeseluruhan').innerText = 'Rp. ' + grandTotal.toLocaleString('id-ID');
}

window.saveRabRincian = async function() {
    const btn = document.querySelector('[onclick="saveRabRincian()"]');
    let originalHtml = "Simpan RAB";
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.innerHTML = 'Menyimpan...';
        btn.disabled = true;
    }

    try {
        const tahun = document.getElementById('rabTahunSelector').value;
        const subtitleParts = document.getElementById('rabRincianModalSubtitle').innerText.split(' - ');
        const ssCode = subtitleParts[0];
        const ssName = subtitleParts.slice(1).join(' - ');
        const judulKegiatan = document.getElementById('rabRincianJudulKegiatan').value;
        
        const dataToSave = [];
        document.querySelectorAll('.rab-input-row').forEach(row => {
            const catatanInput = row.querySelector('[data-field="catatan"]');
            const uraianInput = row.querySelector('[data-field="uraian"]');
            const rowIndex = row.getAttribute('data-index');
            const entry = {
                index: rowIndex,
                catatan: catatanInput ? catatanInput.value : '',
                uraian: uraianInput ? uraianInput.value : '',
                v1: row.querySelector('[data-field="v1"]').value,
                sat1: row.querySelector('[data-field="sat1"]').value,
                v2: row.querySelector('[data-field="v2"]').value,
                sat2: row.querySelector('[data-field="sat2"]').value,
                price: row.querySelector('[data-field="price"]').value.replace(/[^0-9]/g, '')
            };
            // If custom row, save group info
            if (rowIndex.startsWith('custom_')) {
                const groupId = row.getAttribute('data-group') || '';
                entry._groupId = groupId;
                // Extract itemId from cIdx: custom_<groupId>_<itemId>
                const parts = rowIndex.replace('custom_', '').replace(groupId + '_', '');
                entry._itemId = parts;
                // Get group name from header row
                const headerRow = document.querySelector(`tr[data-custom-group="${groupId}"]`);
                if (headerRow) {
                    const nameInput = headerRow.querySelector('[data-field="group-name"]');
                    entry._groupName = nameInput ? nameInput.value : '';
                }
            }
            dataToSave.push(entry);
        });
        
        // Save deleted Excel indices so they don't reappear
        if (window.deletedExcelIndices && window.deletedExcelIndices.length > 0) {
            window.deletedExcelIndices.forEach(idx => {
                dataToSave.push({ index: idx, _isDeleted: true });
            });
        }

        const grandTotalText = document.getElementById('rabRincianTotalKeseluruhan').innerText.replace(/[^0-9]/g, '');
        const grandTotal = parseFloat(grandTotalText) || 0;

        const res = await fetch('/api/rab/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tahun, ss_code: ssCode, ss_name: ssName, judul_kegiatan: judulKegiatan, data_json: dataToSave, grand_total: grandTotal
            })
        });
        
        const result = await res.json();
        if (result.success) {
            showToast(`RAB berhasil disimpan untuk Tahun Anggaran ${tahun}`, 'success');
            
            // Update local totals map and refresh UI
            rabTotalsMap[ssCode] = parseFloat(grandTotal);
            
            // Refresh current sub-sub list if visible
            if (currentBidangId && currentSubBidangId && currentSubBidangCode) {
                showSubSubBidang(currentBidangId, currentSubBidangId, currentSubBidangCode);
            }

            closeRabRincianModal();
        } else {
            alert('❌ Gagal menyimpan: ' + result.message);
        }
    } catch (e) {
        console.error(e);
        alert('Terjadi kesalahan jaringan/sistem.');
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
}

// ── Custom Uraian Group System ──
let customRowCounter = 0;

// Reconstruct groups from saved data
function buildCustomGroupsFromSaved(savedMap) {
    const groups = {};
    const groupOrder = [];
    Object.keys(savedMap).forEach(k => {
        if (k.startsWith('custom_')) {
            const item = savedMap[k];
            const gId = item._groupId || 'default';
            // Skip custom items that belong to Excel groups; they are handled in renderRabRincianTable
            if (gId.startsWith('excel_')) return;
            
            if (!groups[gId]) {
                groups[gId] = { groupId: gId, name: item._groupName || '', items: [] };
                groupOrder.push(gId);
            }
            groups[gId].name = item._groupName || groups[gId].name;
            groups[gId].items.push({
                itemId: item._itemId || k,
                uraian: item.uraian || '',
                v1: item.v1 || '', sat1: item.sat1 || '',
                v2: item.v2 || '', sat2: item.sat2 || '',
                price: item.price || '', catatan: item.catatan || ''
            });
        }
    });
    return groupOrder.map(id => groups[id]);
}

// Build sub-item row HTML
function buildCustomSubItemHtml(cIdx, groupId, displayNo, uraianText, saved, savedPrice) {
    saved = saved || { v1: '', sat1: '', v2: '', sat2: '', price: '' };
    return `
        <tr class="rab-input-row" data-index="${cIdx}" data-group="${groupId}" style="background: #fafff7;">
            <td style="text-align:center; border-right:1px solid var(--border-color); padding: 8px; vertical-align: top;">${displayNo}</td>
            <td style="border-right:1px solid var(--border-color); padding: 8px; font-size:0.9rem; vertical-align: top;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="text" class="form-input" data-field="uraian" value="${(uraianText || '').replace(/"/g, '&quot;')}" placeholder="Ketik nama uraian..." style="flex:1; padding:6px 10px; font-size:0.9rem; border:1px solid #bbf7d0; border-radius:6px; background:white;">
                    <div style="display:flex; gap:4px;">
                        <button type="button" class="btn-icon" onclick="toggleCatatan(this, '${cIdx}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:2px; filter: grayscale(1);" title="Tambahkan Catatan">📝</button>
                        <button type="button" class="btn-icon" onclick="hapusCustomUraian(this)" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:2px;" title="Hapus">🗑️</button>
                    </div>
                </div>
                <div id="catatan-container-${cIdx}" style="display:${saved.catatan ? 'block' : 'none'}; margin-top:8px;">
                    <input type="text" class="form-input" data-field="catatan" placeholder="Catatan opsional..." value="${saved.catatan || ''}" style="width:100%; padding:4px 8px; font-size:0.8rem; background:#f0fdf4; border:1px dashed #86efac; border-radius:4px;">
                </div>
            </td>
            <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="number" min="0" class="form-input rab-calc" data-field="v1" value="${saved.v1 || ''}" style="width:100%; padding: 6px; text-align:center; height:36px; border-radius:4px;"></td>
            <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="text" class="form-input" data-field="sat1" placeholder="ls" value="${saved.sat1 || ''}" style="width:100%; padding: 6px; text-align:center; height:36px; border-radius:4px;"></td>
            <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="number" min="0" class="form-input rab-calc" data-field="v2" value="${saved.v2 || ''}" style="width:100%; padding: 6px; text-align:center; height:36px; border-radius:4px;"></td>
            <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="text" class="form-input" data-field="sat2" placeholder="org" value="${saved.sat2 || ''}" style="width:100%; padding: 6px; text-align:center; height:36px; border-radius:4px;"></td>
            <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="text" class="form-input rab-calc price-input" data-field="price" value="${savedPrice}" oninput="formatRupiahInput(this)" style="width:100%; padding: 6px; text-align:right; height:36px; border-radius:4px;"></td>
            <td style="text-align:right; padding: 8px; font-weight:600; color:var(--text-dark);" class="rab-row-total">Rp. 0</td>
        </tr>
    `;
}

// Add new group (header + 1 empty sub-item)
window.addCustomUraianRow = function() {
    const namaKegiatan = prompt('Masukkan nama kegiatan:\n\nContoh: Belanja Barang Kantor');
    if (!namaKegiatan || !namaKegiatan.trim()) return;

    const tbody = document.getElementById('rabRincianTableBody');
    if (!tbody) return;

    // Remove placeholder if present
    const placeholder = tbody.querySelector('td[colspan="8"]');
    if (placeholder) placeholder.closest('tr').remove();

    const groupId = `g${Date.now()}`;

    // Insert header row
    const headerRow = document.createElement('tr');
    headerRow.setAttribute('data-custom-group', groupId);
    headerRow.style.background = '#f0fdf4';
    headerRow.style.fontWeight = 'bold';
    headerRow.innerHTML = `
        <td style="text-align:center; padding:12px; border-right:1px solid var(--border-color);"></td>
        <td colspan="5" style="padding:10px 12px; border-right:1px solid var(--border-color);">
            <input type="text" data-field="group-name" value="${namaKegiatan.trim().replace(/"/g, '&quot;')}" placeholder="Nama kegiatan..." style="width:100%; padding:6px 10px; font-weight:700; font-size:0.95rem; border:1px solid #86efac; border-radius:6px; background:#f0fdf4; color:#15803d;">
        </td>
        <td style="padding:8px; text-align:center; border-right:1px solid var(--border-color);">
            <button type="button" onclick="event.stopPropagation(); addSubItemToGroup('${groupId}')" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'" style="background:#16a34a; color:white; border:none; border-radius:6px; padding:6px 14px; cursor:pointer; font-size:0.8rem; font-weight:600; white-space:nowrap; width:100%;">+ Sub</button>
        </td>
        <td style="padding:8px; text-align:center;">
            <button type="button" onclick="event.stopPropagation(); hapusCustomGroup('${groupId}')" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'" style="background:#fee2e2; border:1px solid #fca5a5; border-radius:6px; cursor:pointer; font-size:1rem; color:#ef4444; padding:4px 8px; width:100%;" title="Hapus seluruh grup ini">🗑️</button>
        </td>
    `;
    tbody.appendChild(headerRow);

    // Insert first sub-item row
    insertSubItemRow(tbody, groupId, 1);
}

window.addSubItemToGroup = function(groupId) {
    try {
        const tbody = document.getElementById('rabRincianTableBody');
        if (!tbody) return;

        // Find header row (could be custom or excel)
        const headerRow = tbody.querySelector(`tr[data-custom-group="${groupId}"], tr[data-excel-group="${groupId}"]`);
        const groupRows = tbody.querySelectorAll(`tr[data-group="${groupId}"]`);
        const nextNo = groupRows.length + 1;
        
        const lastRow = groupRows.length > 0 ? groupRows[groupRows.length - 1] : headerRow;

        const newRow = insertSubItemRow(tbody, groupId, nextNo, lastRow);
        const uraianInput = newRow.querySelector('[data-field="uraian"]');
        if (uraianInput) uraianInput.focus();
    } catch (err) {
        console.error('Error in addSubItemToGroup:', err);
        alert('Gagal menambah sub-uraian: ' + err.message);
    }
}

function insertSubItemRow(tbody, groupId, displayNo, afterRow) {
    customRowCounter++;
    const itemId = `i${Date.now()}_${customRowCounter}`;
    const cIdx = `custom_${groupId}_${itemId}`;

    const html = buildCustomSubItemHtml(cIdx, groupId, displayNo, '', {}, '');
    
    let newRow;
    if (afterRow) {
        afterRow.insertAdjacentHTML('afterend', html);
        newRow = afterRow.nextElementSibling;
    } else {
        tbody.insertAdjacentHTML('beforeend', html);
        newRow = tbody.lastElementChild;
    }

    // Attach calc listener
    newRow.querySelectorAll('.rab-calc').forEach(input => {
        input.addEventListener('input', calculateRabTotals);
    });

    calculateRabTotals();
    return newRow;
}

window.toggleCatatan = function(btn, index) {
    const container = document.getElementById(`catatan-container-${index}`);
    if (container) {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
        if (container.style.display === 'block') {
            const input = container.querySelector('input');
            if (input) input.focus();
        }
    }
}

// Delete a single sub-item
window.hapusCustomUraian = function(btn) {
    const row = btn.closest('tr.rab-input-row');
    if (!row) return;
    
    if(!confirm("Yakin ingin menghapus uraian ini?")) return;
    
    const index = row.getAttribute('data-index');
    if (index && !index.startsWith('custom_')) {
        // Track deleted Excel items
        if (!window.deletedExcelIndices) window.deletedExcelIndices = [];
        window.deletedExcelIndices.push(index);
    }
    
    const groupId = row.getAttribute('data-group');
    row.remove();

    // Re-number remaining sub-items in this group
    const tbody = document.getElementById('rabRincianTableBody');
    const remaining = tbody.querySelectorAll(`tr[data-group="${groupId}"]`);
    remaining.forEach((r, i) => { r.querySelector('td').textContent = i + 1; });

    // If no sub-items left, remove the group header too
    if (remaining.length === 0) {
        const header = tbody.querySelector(`tr[data-custom-group="${groupId}"]`);
        if (header) header.remove();
    }

    calculateRabTotals();
}

// Delete an entire group (header + all sub-items)
window.hapusCustomGroup = function(groupId) {
    if (!confirm('Hapus seluruh kegiatan ini beserta semua sub uraiannya?')) return;
    const tbody = document.getElementById('rabRincianTableBody');
    // Remove header
    const header = tbody.querySelector(`tr[data-custom-group="${groupId}"]`);
    if (header) header.remove();
    // Remove all sub-items
    tbody.querySelectorAll(`tr[data-group="${groupId}"]`).forEach(r => r.remove());
    calculateRabTotals();
}

const rabTahunEl = document.getElementById('rabTahunSelector');
if (rabTahunEl) {
    rabTahunEl.addEventListener('change', () => {
        // Tutup modal jika user mengganti tahun agar tidak salah edit
        closeRabRincianModal();
    });
}

window.cetakRabSemua = function() {
    try {
        const tahun = document.getElementById('rabTahunSelector').value;
        if (!tahun) {
            alert("Pilih tahun terlebih dahulu");
            return;
        }
        
        console.log("Mencoba membuka print-rab.html untuk tahun:", tahun);
        const url = `print-rab.html?tahun=${tahun}`;
        const printWindow = window.open(url, '_blank');
        
        // Fallback jika popup blocker aktif
        if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
            console.warn("Pop-up diblokir. Mengalihkan langsung ke halaman cetak...");
            window.location.href = url;
        }
    } catch (err) {
        console.error("Error pada cetakRabSemua:", err);
        alert("Terjadi kesalahan: " + err.message);
    }
}

window.cetakRabKegiatanIni = function() {
    const tahun = document.getElementById('rabTahunSelector').value;
    const subtitleParts = document.getElementById('rabRincianModalSubtitle').innerText.split(' - ');
    const ssCode = subtitleParts[0];
    if (!tahun || !ssCode || ssCode === "-") return alert("Data tidak lengkap untuk dicetak");
    window.open(`print-rab.html?tahun=${tahun}&ss_code=${ssCode}`, '_blank');
}

// ── RAB Summary Report Logic ──
window.loadLaporanRab = async function() {
    const tahun = document.getElementById('laporanRabTahun').value;
    const tbody = document.getElementById('laporanRabTableBody');
    const grandTotalEl = document.getElementById('rekapRabGrandTotal');
    const bidangCountEl = document.getElementById('rekapRabBidangCount');
    
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--text-muted);">Memuat data laporan...</td></tr>';
    
    try {
        // 1. Get Hierarchy (for names)
        const resHierarchy = await fetch('/api/rab');
        const dataHierarchy = await resHierarchy.json();
        const hierarchy = dataHierarchy.hierarchy || {};
        const bidangList = dataHierarchy.bidang || [];
        
        // 2. Get All Saved Records for the Year
        const resSaved = await fetch(`/api/rab/saved-all?tahun=${tahun}`);
        const dataSaved = await resSaved.json();
        const savedRecords = dataSaved.data || [];
        
        if (savedRecords.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:60px;color:var(--text-muted);"><div style="font-size:2rem;margin-bottom:10px;">📭</div>Belum ada data RAB yang disimpan untuk tahun ' + tahun + '</td></tr>';
            grandTotalEl.innerText = 'Rp. 0';
            bidangCountEl.innerText = '0';
            return;
        }
        
        // 3. Aggregate Totals directly from DB records
        const bidangTotals = {}; // "1" -> total
        const subTotals = {};    // "1.01" -> total
        let totalKeseluruhan = 0;

        savedRecords.forEach(r => {
            const code = r.ss_code;
            const total = r.grand_total;
            totalKeseluruhan += total;
            
            const parts = code.split('.');
            if (parts.length >= 2) {
                const bCode = parts[0];
                const sCode = `${parts[0]}.${parts[1]}`;
                bidangTotals[bCode] = (bidangTotals[bCode] || 0) + total;
                subTotals[sCode] = (subTotals[sCode] || 0) + total;
            }
        });

        // 4. Build Display using the collected totals
        let html = '';
        let totalBidangCount = 0;
        const displayedBidang = new Set();

        // Step 1: Display Bidang that are in the Excel list
        bidangList.forEach((bidang, bIdx) => {
            const bCode = bidang.no ? String(bidang.no).padStart(2, '0') : String(bIdx + 1).padStart(2, '0');
            const bTotal = bidangTotals[bCode] || 0;

            if (bTotal > 0) {
                displayedBidang.add(bCode);
                totalBidangCount++;
                html += `
                    <tr style="background:#f1f5f9; font-weight:bold; border-top: 2px solid #cbd5e1;">
                        <td style="color:var(--primary); font-weight: 700;">${bCode}</td>
                        <td style="color:var(--primary); font-weight: 700;">${bidang.nama_bidang}</td>
                        <td style="text-align:right; color:var(--primary); font-weight: 700;">Rp. ${formatRupiah(bTotal)}</td>
                    </tr>
                `;

                // Sub-bidang names
                const subNames = Object.keys(hierarchy[bidang.nama_bidang] || {});
                subNames.forEach((subName, sbIdx) => {
                    const sCode = `${bCode}.${(sbIdx + 1).toString().padStart(2, '0')}`;
                    const sTotal = subTotals[sCode] || 0;

                    if (sTotal > 0) {
                        html += `
                            <tr style="background:#f8fafc;">
                                <td style="padding-left:25px; color:#475569; font-weight:600; font-size:0.9rem;">${sCode}</td>
                                <td style="padding-left:25px; color:#475569; font-weight:600; font-size:0.9rem;">${subName}</td>
                                <td style="text-align:right; color:#475569; font-weight:600; font-size:0.9rem;">Rp. ${formatRupiah(sTotal)}</td>
                            </tr>
                        `;

                        // NEW: Sub-Sub Bidang (Activities)
                        const ssList = hierarchy[bidang.nama_bidang][subName] || [];
                        ssList.forEach((ssName, ssIdx) => {
                            const ssCode = `${sCode}.${(ssIdx + 1).toString().padStart(2, '0')}`;
                            // Find in savedRecords to get the exact grand_total for this activity
                            const record = savedRecords.find(r => r.ss_code === ssCode);
                            if (record && record.grand_total > 0) {
                                html += `
                                    <tr>
                                        <td style="padding-left:50px; color:#94a3b8; font-size:0.8rem;">${ssCode}</td>
                                        <td style="padding-left:50px; color:#64748b; font-size:0.8rem;">${ssName}</td>
                                        <td style="text-align:right; color:#64748b; font-size:0.8rem;">Rp. ${formatRupiah(record.grand_total)}</td>
                                    </tr>
                                `;
                            }
                        });
                    }
                });
            }
        });

        // Step 2: Display any data that didn't match the Excel list (safety fallback)
        Object.keys(bidangTotals).forEach(bCode => {
            const paddedBCode = String(bCode).padStart(2, '0');
            if (!displayedBidang.has(paddedBCode)) {
                totalBidangCount++;
                html += `
                    <tr style="background:#fff7ed; font-weight:bold; border-top: 2px solid #fdba74;">
                        <td style="color:#c2410c; font-weight: 700;">${paddedBCode}</td>
                        <td style="color:#c2410c; font-weight: 700;">Bidang Luar Template (Kode: ${paddedBCode})</td>
                        <td style="text-align:right; color:#c2410c; font-weight: 700;">Rp. ${formatRupiah(bidangTotals[bCode])}</td>
                    </tr>
                `;
            }
        });
        
        tbody.innerHTML = html || '<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--text-muted);">Tidak ada rincian data yang bisa ditampilkan.</td></tr>';
        grandTotalEl.innerText = 'Rp. ' + formatRupiah(totalKeseluruhan);
        bidangCountEl.innerText = totalBidangCount;
        
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:40px;color:red;">Gagal memuat laporan. Pastikan koneksi server tersedia.</td></tr>';
    }
};

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID').format(number);
}

window.printLaporanRabPdf = function() {
    const tahun = document.getElementById('laporanRabTahun').value;
    const tbody = document.getElementById('laporanRabTableBody');
    const grandTotal = document.getElementById('rekapRabGrandTotal').innerText;
    
    if (tbody.rows.length <= 1 && tbody.innerText.includes('Klik tombol')) {
        return alert("Silakan lihat laporan terlebih dahulu sebelum mencetak.");
    }

    if (tbody.innerText.includes('Belum ada data')) {
        return alert("Tidak ada data untuk dicetak.");
    }

    // Save to localStorage for the print page
    const printData = {
        tahun: tahun,
        grandTotal: grandTotal,
        html: tbody.innerHTML
    };
    localStorage.setItem('printRabData', JSON.stringify(printData));

    // Open print window
    window.open('laporan-rab-cetak.html', '_blank');
};

// Global initialization
window.initRab = initRab;
window.loadLaporanRab = loadLaporanRab;
window.printLaporanRabPdf = printLaporanRabPdf;

// CRUD Exports for HTML onclick
window.tambahBidang = tambahBidang;
window.editBidang = editBidang;
window.hapusBidang = hapusBidang;
window.tambahSubBidang = tambahSubBidang;
window.editSubBidang = editSubBidang;
window.hapusSubBidang = hapusSubBidang;
window.tambahSsBidang = tambahSsBidang;
window.editSsBidang = editSsBidang;
window.hapusSsBidang = hapusSsBidang;

// Add base styles if not exist
if (!document.getElementById('rab-custom-styles')) {
    const style = document.createElement('style');
    style.id = 'rab-custom-styles';
    style.innerHTML = `
        .idx-badge {
            width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; 
            border-radius: 8px; font-size: 0.8rem; font-weight: 700; background: #e2e8f0; flex-shrink: 0;
        }
        .rab-item.active .idx-badge {
            background: rgba(255,255,255,0.2) !important;
            color: white !important;
        }
    `;
    document.head.appendChild(style);
}

// ── RAB Search ──
window.searchRab = async function() {
    const tahun = document.getElementById('rabTahunSelector').value;
    const q = (document.getElementById('rabSearchInput').value || '').trim();
    const modal = document.getElementById('rabSearchModal');
    const resultsDiv = document.getElementById('rabSearchResults');
    const titleEl = document.getElementById('rabSearchModalTitle');

    titleEl.innerText = `🔍 Hasil Pencarian RAB – Tahun ${tahun}${q ? ' · "' + q + '"' : ''}`;
    resultsDiv.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Mencari...</div>';
    modal.style.display = 'flex';

    try {
        const url = `/api/rab/search?tahun=${tahun}${q ? '&q=' + encodeURIComponent(q) : ''}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.success) {
            resultsDiv.innerHTML = `<div style="text-align:center; padding:30px; color:red;">${data.message}</div>`;
            return;
        }

        if (!data.data || data.data.length === 0) {
            resultsDiv.innerHTML = `
                <div style="text-align:center; padding:40px; color:var(--text-muted);">
                    <div style="font-size:2.5rem; margin-bottom:12px;">🔍</div>
                    <p>Tidak ditemukan data yang cocok untuk tahun <strong>${tahun}</strong>${q ? ' dengan kata kunci <strong>"' + q + '"</strong>' : ''}.</p>
                </div>`;
            return;
        }

        let html = `
            <p style="margin: 0 0 16px; font-size:0.85rem; color:var(--text-muted);">
                Ditemukan <strong>${data.data.length}</strong> kegiatan yang sesuai.
            </p>
            <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:10px 12px; text-align:left; border-bottom:2px solid #e2e8f0; width:90px;">Kode</th>
                        <th style="padding:10px 12px; text-align:left; border-bottom:2px solid #e2e8f0;">Nama Kegiatan</th>
                        <th style="padding:10px 12px; text-align:left; border-bottom:2px solid #e2e8f0;">Judul Kegiatan</th>
                        <th style="padding:10px 12px; text-align:right; border-bottom:2px solid #e2e8f0; width:140px;">Total (Rp)</th>
                        <th style="padding:10px 12px; text-align:center; border-bottom:2px solid #e2e8f0; width:80px;">Aksi</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.data.forEach((item, i) => {
            const total = item.grand_total ? parseInt(item.grand_total).toLocaleString('id-ID') : '0';
            const judulHtml = item.judul_kegiatan
                ? `<div style="font-size:0.8rem; color:#0ea5e9; font-weight:600; margin-top:4px;">📌 ${item.judul_kegiatan}</div>`
                : '';
            const rowBg = i % 2 === 0 ? '#fff' : '#f8fafc';

            // Highlight keyword in ss_name, bidang, sub_bidang
            let ssNameHtml = item.ss_name;
            let bidangHtml = item.bidang;
            let subBidangHtml = item.sub_bidang;
            if (q) {
                const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const highlight = '<mark style="background:#fef08a; border-radius:2px; padding:0 2px;">$1</mark>';
                ssNameHtml = ssNameHtml.replace(regex, highlight);
                bidangHtml = bidangHtml.replace(regex, highlight);
                subBidangHtml = subBidangHtml.replace(regex, highlight);
            }

            html += `
                <tr style="background:${rowBg}; border-bottom:1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${rowBg}'">
                    <td style="padding:12px; font-weight:700; color:var(--primary); font-size:0.8rem; vertical-align:top;">${item.ss_code}</td>
                    <td style="padding:12px; vertical-align:top;">
                        <div style="font-size:0.7rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px; font-weight:600;">
                            ${bidangHtml} <span style="margin:0 4px; opacity:0.5;">/</span> ${subBidangHtml}
                        </div>
                        <div style="font-weight:600; color:var(--text-dark); line-height:1.4;">${ssNameHtml}</div>
                        ${judulHtml}
                    </td>
                    <td style="padding:12px; text-align:right; font-weight:700; color:${item.grand_total > 0 ? 'var(--success)' : 'var(--text-muted)'}; vertical-align:top;">
                        ${item.grand_total > 0 ? 'Rp ' + total : '–'}
                    </td>
                    <td style="padding:12px; text-align:center; vertical-align:top;">
                        <button onclick="bukaRabDariSearch('${item.ss_code}', '${item.ss_name.replace(/'/g, "\\'")}');"
                            style="background:var(--primary); color:white; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:0.85rem; font-weight:600; box-shadow: 0 4px 12px rgba(37,99,235,0.2); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            Buka
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        resultsDiv.innerHTML = html;

    } catch (err) {
        console.error(err);
        resultsDiv.innerHTML = `<div style="text-align:center; padding:30px; color:red;">Terjadi kesalahan saat mencari data.</div>`;
    }
};

// ── RAB Anggaran Terisi ──
window.searchRabTerisi = async function() {
    const tahun = document.getElementById('rabTahunSelector').value;
    const modal = document.getElementById('rabSearchModal');
    const resultsDiv = document.getElementById('rabSearchResults');
    const titleEl = document.getElementById('rabSearchModalTitle');

    titleEl.innerText = `💰 Daftar Anggaran Terisi RAB – Tahun ${tahun}`;
    resultsDiv.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Mencari kegiatan yang sudah dianggarkan...</div>';
    modal.style.display = 'flex';

    try {
        const url = `/api/rab/search?tahun=${tahun}`; // Tanpa parameter q, akan mengembalikan semua data
        const res = await fetch(url);
        const data = await res.json();

        if (!data.success) {
            resultsDiv.innerHTML = `<div style="text-align:center; padding:30px; color:red;">${data.message}</div>`;
            return;
        }

        // Hanya ambil yang sudah terisi nominal
        const terisi = data.data.filter(item => item.grand_total > 0);

        if (terisi.length === 0) {
            resultsDiv.innerHTML = `
                <div style="text-align:center; padding:40px; color:var(--text-muted);">
                    <div style="font-size:2.5rem; margin-bottom:12px;">💰</div>
                    <p>Belum ada rincian kegiatan yang diisi anggarannya untuk tahun ${tahun}.</p>
                </div>`;
            return;
        }

        let html = `
            <p style="margin: 0 0 16px; font-size:0.85rem; color:var(--text-muted);">
                Ditemukan <strong>${terisi.length}</strong> kegiatan yang sudah memiliki anggaran.
            </p>
            <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                <thead>
                    <tr style="background:#f0fdf4;">
                        <th style="padding:12px; text-align:left; border-bottom:2px solid #bbf7d0; width:90px;">Kode</th>
                        <th style="padding:12px; text-align:left; border-bottom:2px solid #bbf7d0;">Kegiatan Terisi</th>
                        <th style="padding:12px; text-align:right; border-bottom:2px solid #bbf7d0;">Total Anggaran</th>
                        <th style="padding:12px; text-align:center; border-bottom:2px solid #bbf7d0; width:80px;">Aksi</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let totalKeseluruhan = 0;

        terisi.forEach((item, i) => {
            const rowBg = i % 2 === 0 ? '#fff' : '#f8fafc';
            totalKeseluruhan += item.grand_total;
            const total = parseInt(item.grand_total).toLocaleString('id-ID');
            
            const judulHtml = item.judul_kegiatan
                ? `<div style="font-size:0.8rem; color:#16a34a; font-weight:600; margin-top:4px;">📌 ${item.judul_kegiatan}</div>`
                : '';

            html += `
                <tr style="background:${rowBg}; border-bottom:1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${rowBg}'">
                    <td style="padding:12px; font-weight:700; color:#16a34a; font-size:0.8rem; vertical-align:top;">${item.ss_code}</td>
                    <td style="padding:12px; vertical-align:top;">
                        <div style="font-size:0.7rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px; font-weight:600;">
                            ${item.bidang} <span style="margin:0 4px; opacity:0.5;">/</span> ${item.sub_bidang}
                        </div>
                        <div style="font-weight:600; color:var(--text-dark); line-height:1.4;">${item.ss_name}</div>
                        ${judulHtml}
                    </td>
                    <td style="padding:12px; text-align:right; font-weight:700; color:#16a34a; vertical-align:top;">
                        Rp ${total}
                    </td>
                    <td style="padding:12px; text-align:center; vertical-align:top;">
                        <button onclick="bukaRabDariSearch('${item.ss_code}', '${item.ss_name.replace(/'/g, "\\'")}');"
                            style="background:#16a34a; color:white; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:0.85rem; font-weight:600; box-shadow: 0 4px 12px rgba(22,163,74,0.2); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            Buka
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                <tr style="background:#e6f4ea; border-top:2px solid #16a34a;">
                    <td colspan="2" style="padding:12px; font-weight:700; color:#065f46; text-align:right;">TOTAL KESELURUHAN</td>
                    <td style="padding:12px; text-align:right; font-weight:800; color:#065f46; font-size:1rem;">
                        Rp ${totalKeseluruhan.toLocaleString('id-ID')}
                    </td>
                    <td></td>
                </tr>
        `;

        html += `</tbody></table>`;
        resultsDiv.innerHTML = html;

    } catch (err) {
        console.error(err);
        resultsDiv.innerHTML = `<div style="text-align:center; padding:30px; color:red;">Gagal memproses data anggaran terisi.</div>`;
    }
};

// Buka rincian dari hasil pencarian, dengan navigasi ke Bidang/Sub Bidang yang tepat
window.bukaRabDariSearch = function(ssCode, ssName) {
    // Sembunyikan modal pencarian
    const modal = document.getElementById('rabSearchModal');
    if (modal) modal.style.display = 'none';

    // Coba navigasi ke posisi hierarchy dulu
    const parts = ssCode.split('.');
    if (parts.length >= 3) {
        const bCode = parts[0];
        const sbOrder = parseInt(parts[1]); // Order sub-bidang dalam bidang tersebut

        // 1. Temukan dan klik Bidang yang tepat
        const bidangItems = document.querySelectorAll('#rabBidangList .rab-item');
        let targetBidang = null;
        bidangItems.forEach(item => {
            const badge = item.querySelector('.idx-badge');
            if (badge && badge.innerText === bCode) targetBidang = item;
        });

        if (targetBidang) {
            targetBidang.click();
            
            // 2. Tunggu sub-bidang dimuat, lalu klik sub-bidang yang sesuai
            setTimeout(() => {
                const subItems = document.querySelectorAll('#rabSubBidangList .rab-item');
                // Kita cari berdasarkan urutan di kode (parts[1])
                if (subItems[sbOrder - 1]) {
                    subItems[sbOrder - 1].click();
                    
                    // 3. Akhirnya buka modal rincian setelah rincian dimuat
                    setTimeout(() => {
                        openRabRincianModal(ssCode, ssName);
                    }, 400);
                }
            }, 400);
        } else {
            // Fallback jika navigasi gagal
            openRabRincianModal(ssCode, ssName);
        }
    } else {
        openRabRincianModal(ssCode, ssName);
    }
};

// ── Hierarchy Management CRUD Functions ──

async function tambahBidang() {
    const no = prompt("Masukkan nomor bidang (misal: 01):");
    if (!no) return;
    const name = prompt("Masukkan nama bidang:");
    if (!name) return;

    const res = await fetch('/api/rab/hierarchy/bidang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no, name })
    });
    const result = await res.json();
    if (result.success) {
        showToast(result.message, 'success');
        await loadRabExcelData(); // Refresh list
    } else {
        alert("Gagal: " + result.message);
    }
}

async function editBidang(e, id, oldNo, oldName) {
    if (e) e.stopPropagation();
    const no = prompt("Nomor bidang:", oldNo);
    if (no === null) return;
    const name = prompt("Nama bidang:", oldName);
    if (name === null) return;

    const res = await fetch(`/api/rab/hierarchy/bidang/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no, name })
    });
    const result = await res.json();
    if (result.success) {
        showToast(result.message, 'success');
        await loadRabExcelData();
    } else {
        alert("Gagal: " + result.message);
    }
}

async function hapusBidang(e, id) {
    if (e) e.stopPropagation();
    if (!confirm("Hapus bidang ini? Semua sub-bidang dan kegiatan di bawahnya juga akan dihapus!")) return;

    const res = await fetch(`/api/rab/hierarchy/bidang/${id}`, {
        method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
        showToast(result.message, 'success');
        currentBidangId = null;
        currentSubBidangId = null;
        await loadRabExcelData();
    } else {
        alert("Gagal: " + result.message);
    }
}

async function tambahSubBidang(bidangId, bidangName) {
    const no = prompt(`Masukkan nomor sub bidang untuk ${bidangName}:`);
    if (!no) return;
    const name = prompt("Masukkan nama sub bidang:");
    if (!name) return;

    const res = await fetch('/api/rab/hierarchy/sub-bidang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidang_id: bidangId, no, name })
    });
    const result = await res.json();
    if (result.success) {
        showToast(result.message, 'success');
        await loadRabExcelData();
        if (currentBidangId) {
            const bidangName = document.querySelector('.rab-bidang-item.active span:not(.idx-badge)')?.innerText || 'Bidang';
            showSubBidangList(currentBidangId, bidangName);
        }
    } else {
        alert("Gagal: " + result.message);
    }
}

async function editSubBidang(e, id, oldNo, oldName) {
    if (e) e.stopPropagation();
    const no = prompt("Nomor sub bidang:", oldNo);
    if (no === null) return;
    const name = prompt("Nama sub bidang:", oldName);
    if (name === null) return;

    const res = await fetch(`/api/rab/hierarchy/sub-bidang/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no, name })
    });
    const result = await res.json();
    if (result.success) {
        showToast(result.message, 'success');
        await loadRabExcelData();
        if (currentBidangId) {
            const bidangName = document.querySelector('.rab-bidang-item.active span:not(.idx-badge)')?.innerText || 'Bidang';
            showSubBidangList(currentBidangId, bidangName);
        }
    } else {
        alert("Gagal: " + result.message);
    }
}

async function hapusSubBidang(e, id) {
    if (e) e.stopPropagation();
    if (!confirm("Hapus sub bidang ini beserta kegiatannya?")) return;

    const res = await fetch(`/api/rab/hierarchy/sub-bidang/${id}`, {
        method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
        showToast(result.message, 'success');
        currentSubBidangId = null;
        await loadRabExcelData();
        if (currentBidangId) {
            const bidangName = document.querySelector('.rab-bidang-item.active span:not(.idx-badge)')?.innerText || 'Bidang';
            showSubBidangList(currentBidangId, bidangName);
        }
    } else {
        alert("Gagal: " + result.message);
    }
}

async function tambahSsBidang(subBidangId, subName) {
    const no = prompt(`Masukkan nomor kegiatan untuk ${subName}:`);
    if (!no) return;
    const name = prompt("Masukkan nama kegiatan:");
    if (!name) return;

    const res = await fetch('/api/rab/hierarchy/ss-bidang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub_bidang_id: subBidangId, no, name })
    });
    const result = await res.json();
    if (result.success) {
        showToast(result.message, 'success');
        await loadRabExcelData();
        if (currentBidangId && currentSubBidangId && currentSubBidangCode) {
            showSubSubBidang(currentBidangId, currentSubBidangId, currentSubBidangCode);
        }
    } else {
        alert("Gagal: " + result.message);
    }
}

async function editSsBidang(e, id, oldNo, oldName) {
    if (e) e.stopPropagation();
    const no = prompt("Nomor kegiatan:", oldNo);
    if (no === null) return;
    const name = prompt("Nama kegiatan:", oldName);
    if (name === null) return;

    const res = await fetch(`/api/rab/hierarchy/ss-bidang/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no, name })
    });
    const result = await res.json();
    if (result.success) {
        showToast(result.message, 'success');
        await loadRabExcelData();
        if (currentBidangId && currentSubBidangId && currentSubBidangCode) {
            showSubSubBidang(currentBidangId, currentSubBidangId, currentSubBidangCode);
        }
    } else {
        alert("Gagal: " + result.message);
    }
}

async function hapusSsBidang(e, id) {
    if (e) e.stopPropagation();
    if (!confirm("Hapus kegiatan ini?")) return;

    const res = await fetch(`/api/rab/hierarchy/ss-bidang/${id}`, {
        method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
        showToast(result.message, 'success');
        await loadRabExcelData();
        if (currentBidangId && currentSubBidangId && currentSubBidangCode) {
            showSubSubBidang(currentBidangId, currentSubBidangId, currentSubBidangCode);
        }
    } else {
        alert("Gagal: " + result.message);
    }
}


window.makeRabRowsDraggable = function() {
    const tbody = document.getElementById('rabRincianTableBody');
    if (!tbody) return;

    let draggedRow = null;

    tbody.querySelectorAll('tr[data-custom-group], tr[data-excel-group]').forEach(row => {
        const handle = row.querySelector('.drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', () => row.setAttribute('draggable', 'true'));
            handle.addEventListener('mouseup', () => row.removeAttribute('draggable'));
            handle.addEventListener('mouseleave', () => row.removeAttribute('draggable'));
        }
        
        row.addEventListener('dragstart', function(e) {
            draggedRow = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
            this.style.opacity = '0.4';
            
            // Also fade children while dragging
            const groupId = this.getAttribute('data-custom-group') || this.getAttribute('data-excel-group');
            tbody.querySelectorAll(`tr.rab-input-row[data-group="${groupId}"]`).forEach(child => {
                child.style.opacity = '0.4';
            });
        });

        row.addEventListener('dragend', function(e) {
            this.style.opacity = '1';
            this.removeAttribute('draggable');
            
            // Restore children opacity
            const groupId = this.getAttribute('data-custom-group') || this.getAttribute('data-excel-group');
            tbody.querySelectorAll(`tr.rab-input-row[data-group="${groupId}"]`).forEach(child => {
                child.style.opacity = '1';
            });
            
            tbody.querySelectorAll('tr[data-custom-group], tr[data-excel-group]').forEach(r => {
                r.style.borderTop = '';
                r.style.borderBottom = '';
            });
        });

        row.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const rect = this.getBoundingClientRect();
            const relY = e.clientY - rect.top;
            if (relY < rect.height / 2) {
                this.style.borderTop = '2px solid var(--primary)';
                this.style.borderBottom = '';
            } else {
                this.style.borderBottom = '2px solid var(--primary)';
                this.style.borderTop = '';
            }
            return false;
        });

        row.addEventListener('dragleave', function(e) {
            this.style.borderTop = '';
            this.style.borderBottom = '';
        });

        row.addEventListener('drop', function(e) {
            e.stopPropagation();
            this.style.borderTop = '';
            this.style.borderBottom = '';
            
            if (draggedRow !== this) {
                const rect = this.getBoundingClientRect();
                const relY = e.clientY - rect.top;
                
                // Determine drop location
                let targetDropNode = this;
                let insertMode = 'before';
                
                if (relY >= rect.height / 2) {
                    // Drop AFTER this group
                    // This means we must drop it AFTER the LAST child item of this group
                    const targetGroupId = this.getAttribute('data-custom-group') || this.getAttribute('data-excel-group');
                    const targetChildren = Array.from(tbody.querySelectorAll(`tr.rab-input-row[data-group="${targetGroupId}"]`));
                    if (targetChildren.length > 0) {
                        targetDropNode = targetChildren[targetChildren.length - 1];
                    }
                    insertMode = 'after';
                }
                
                // 1. Move the dragged Header
                if (insertMode === 'before') {
                    targetDropNode.parentNode.insertBefore(draggedRow, targetDropNode);
                } else {
                    targetDropNode.insertAdjacentElement('afterend', draggedRow);
                }
                
                // 2. Move all children of the dragged Header to immediately follow the Header
                const draggedGroupId = draggedRow.getAttribute('data-custom-group') || draggedRow.getAttribute('data-excel-group');
                const draggedChildren = Array.from(tbody.querySelectorAll(`tr.rab-input-row[data-group="${draggedGroupId}"]`));
                let insertAfterNode = draggedRow;
                
                draggedChildren.forEach(child => {
                    insertAfterNode.insertAdjacentElement('afterend', child);
                    insertAfterNode = child;
                });
            }
            return false;
        });
    });
}
