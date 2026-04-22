/**
 * RAB (Rencana Anggaran Biaya) - 3-Column Drill-down Logic
 */

let rabBidangData = [];
let rabHierarchy = {};
let selectedBidangIdx = 0;
let selectedSubBidangIdx = 0;

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
    loadRabExcelData();
}

async function loadRabExcelData() {
    const listContainer = document.getElementById('rabBidangList');
    try {
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Memuat...</div>';
        const res = await fetch('/api/rab');
        const result = await res.json();

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
        `;

        div.onclick = () => {
            selectedBidangIdx = String(item.no || (index + 1)).padStart(2, '0');
            setActiveItem('.rab-bidang-item', div);
            showSubBidangList(bidangName);
        };

        listContainer.appendChild(div);
    });
}

function showSubBidangList(bidangName) {
    const subContainer = document.getElementById('rabSubBidangList');
    const ssContainer = document.getElementById('rabSubSubContent');
    
    // Clear Sub-Sub Bidang view
    ssContainer.innerHTML = `
        <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 60px 40px; text-align: center; color: var(--text-muted);">
            <div style="font-size: 3rem; margin-bottom: 16px;">📂</div>
            <p>Pilih Sub Bidang untuk melihat rincian kegiatan.</p>
        </div>
    `;

    subContainer.innerHTML = '';
    const subs = rabHierarchy[bidangName] || {};
    const subNames = Object.keys(subs);

    if (subNames.length === 0) {
        subContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Tidak ada sub bidang.</div>';
        return;
    }

    subNames.forEach((name, index) => {
        const div = document.createElement('div');
        div.className = 'rab-item rab-sub-item';
        applyStyles(div, false);
        const subCode = `${selectedBidangIdx}.${String(index + 1).padStart(2, '0')}`;
        
        div.innerHTML = `
            <span class="idx-badge" style="background:#f1f5f9; color:var(--text-dark);">${subCode}</span>
            <span style="flex: 1;">${name}</span>
        `;

        div.onclick = () => {
            selectedSubBidangIdx = index + 1;
            setActiveItem('.rab-sub-item', div);
            showSubSubBidang(bidangName, name, subCode);
        };

        subContainer.appendChild(div);
    });
}

function showSubSubBidang(bidangName, subName, subCode) {
    const ssContainer = document.getElementById('rabSubSubContent');
    const ssList = (rabHierarchy[bidangName] && rabHierarchy[bidangName][subName]) ? rabHierarchy[bidangName][subName] : [];

    let html = `
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: var(--shadow-md);">
            <div style="padding: 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Sub Bidang ${subCode}</div>
                <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-dark); line-height: 1.3;">${subName}</div>
            </div>
            <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                <colgroup>
                    <col style="width: 100px;">
                    <col>
                </colgroup>
                <thead>
                    <tr style="background: #f1f5f9; text-align: left;">
                        <th style="padding: 14px 20px; border-bottom: 2px solid #e2e8f0; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Kode</th>
                        <th style="padding: 14px 20px 14px 20px; border-bottom: 2px solid #e2e8f0; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Kegiatan / Sub-Sub Bidang</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (ssList.length > 0) {
        ssList.forEach((ssName, i) => {
            const ssCode = `${subCode}.${String(i + 1).padStart(2, '0')}`;
            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'" onclick="openRabRincianModal('${ssCode}', \`${ssName}\`)">
                    <td style="padding: 14px 20px; font-family: 'JetBrains Mono', 'Courier New', monospace; color: var(--primary); font-weight: 700; font-size: 0.9rem; vertical-align: top;">${ssCode}</td>
                    <td style="padding: 14px 20px 14px 20px; color: var(--text-dark); font-weight: 500; line-height: 1.5; font-size: 0.9rem; word-wrap: break-word; overflow-wrap: break-word;">
                      ${ssName}
                      <div style="font-size: 0.75rem; color: var(--primary); margin-top: 4px; display: inline-flex; align-items: center; gap: 4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Isi Rincian RAB
                      </div>
                    </td>
                </tr>
            `;
        });
    } else {
        html += `<tr><td colspan="2" style="padding: 60px; text-align: center; color: var(--text-muted); font-size: 1rem;">Belum ada rincian kegiatan untuk sub bidang ini.</td></tr>`;
    }

    html += `</tbody></table></div>`;
    ssContainer.innerHTML = html;
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
    el.style.alignItems = 'center';
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
            if (savedData.success && savedData.data) {
                savedData.data.forEach(item => {
                    savedMap[item.index] = item;
                });
                if (savedData.judul_kegiatan) {
                    document.getElementById('rabRincianJudulKegiatan').value = savedData.judul_kegiatan;
                } else {
                    document.getElementById('rabRincianJudulKegiatan').value = '';
                }
            } else {
                document.getElementById('rabRincianJudulKegiatan').value = '';
            }
            
            renderRabRincianTable(savedMap);
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

function renderRabRincianTable(savedMap = {}) {
    const tbody = document.getElementById('rabRincianTableBody');
    tbody.innerHTML = '';
    
    if (!currentRabRincianData || currentRabRincianData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted);">Belum ada item rincian untuk kegiatan ini di dalam template Excel.</td></tr>';
        return;
    }

    let noCounter = 1;
    let html = '';
    
    currentRabRincianData.forEach((item, index) => {
        if (item.isBold) {
            // Header row
            html += `
                <tr style="background: #f8fafc; font-weight: bold;">
                    <td style="text-align:center; padding:12px; border-right:1px solid var(--border-color);">${item.uraian.match(/^[a-z]\./i) ? item.uraian.split('.')[0] + '.' : ''}</td>
                    <td colspan="7" style="padding:12px;">${item.uraian}</td>
                </tr>
            `;
            noCounter = 1; 
        } else {
            // Input row
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
                <tr class="rab-input-row" data-index="${index}">
                    <td style="text-align:center; border-right:1px solid var(--border-color); padding: 8px; vertical-align: top;">${displayNo}</td>
                    <td style="border-right:1px solid var(--border-color); padding: 8px; font-size:0.9rem; vertical-align: top;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span>${textUraian}</span>
                            <button class="btn-icon" onclick="document.getElementById('catatan-container-${index}').style.display = document.getElementById('catatan-container-${index}').style.display === 'none' ? 'block' : 'none'" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:0; color:#64748b; margin-left:8px;" title="Tambahkan Catatan">📝</button>
                        </div>
                        <div id="catatan-container-${index}" style="display:${saved.catatan ? 'block' : 'none'}; margin-top:8px;">
                            <input type="text" class="form-input" data-field="catatan" placeholder="Catatan opsional..." value="${saved.catatan || ''}" style="width:100%; padding:4px 8px; font-size:0.8rem; background:#f1f5f9; border:1px dashed #cbd5e1; border-radius:4px;">
                        </div>
                    </td>
                    <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="number" min="0" class="form-input rab-calc" data-field="v1" value="${saved.v1}" style="width:100%; padding: 6px; text-align:center; height:36px; border-radius:4px;"></td>
                    <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="text" class="form-input" data-field="sat1" placeholder="ls" value="${saved.sat1}" style="width:100%; padding: 6px; text-align:center; height:36px; border-radius:4px;"></td>
                    <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="number" min="0" class="form-input rab-calc" data-field="v2" value="${saved.v2}" style="width:100%; padding: 6px; text-align:center; height:36px; border-radius:4px;"></td>
                    <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="text" class="form-input" data-field="sat2" placeholder="org" value="${saved.sat2}" style="width:100%; padding: 6px; text-align:center; height:36px; border-radius:4px;"></td>
                    <td style="border-right:1px solid var(--border-color); padding: 4px;"><input type="text" class="form-input rab-calc price-input" data-field="price" value="${savedPrice}" oninput="formatRupiahInput(this)" style="width:100%; padding: 6px; text-align:right; height:36px; border-radius:4px;"></td>
                    <td style="text-align:right; padding: 8px; font-weight:600; color:var(--text-dark);" class="rab-row-total">Rp. 0</td>
                </tr>
            `;
        }
    });
    
    tbody.innerHTML = html;
    
    // Attach event listeners to all calculation inputs
    document.querySelectorAll('.rab-calc').forEach(input => {
        input.addEventListener('input', calculateRabTotals);
    });
    
    // Initial calculation if there are saved values
    calculateRabTotals();
}

function calculateRabTotals() {
    let grandTotal = 0;
    
    document.querySelectorAll('.rab-input-row').forEach(row => {
        const v1 = parseFloat(row.querySelector('[data-field="v1"]').value) || 0;
        const v2Raw = row.querySelector('[data-field="v2"]').value;
        // Jika v2 kosong/tidak diisi, anggap multipliernya 1 (tidak mempengaruhi v1)
        const v2 = v2Raw === '' ? 1 : (parseFloat(v2Raw) || 0); 
        const priceRaw = row.querySelector('[data-field="price"]').value.replace(/[^0-9]/g, '');
        const price = parseFloat(priceRaw) || 0;
        
        let rowTotal = 0;
        if (v1 > 0 && price > 0) {
            rowTotal = v1 * v2 * price;
        }
        
        row.querySelector('.rab-row-total').innerText = 'Rp. ' + rowTotal.toLocaleString('id-ID');
        grandTotal += rowTotal;
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
            dataToSave.push({
                index: row.getAttribute('data-index'),
                catatan: catatanInput ? catatanInput.value : '',
                v1: row.querySelector('[data-field="v1"]').value,
                sat1: row.querySelector('[data-field="sat1"]').value,
                v2: row.querySelector('[data-field="v2"]').value,
                sat2: row.querySelector('[data-field="sat2"]').value,
                price: row.querySelector('[data-field="price"]').value.replace(/[^0-9]/g, '')
            });
        });

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
            alert(`✅ Data RAB berhasil disimpan untuk Tahun Anggaran ${tahun}`);
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

const rabTahunEl = document.getElementById('rabTahunSelector');
if (rabTahunEl) {
    rabTahunEl.addEventListener('change', () => {
        // Tutup modal jika user mengganti tahun agar tidak salah edit
        closeRabRincianModal();
    });
}

window.cetakRabSemua = function() {
    const tahun = document.getElementById('rabTahunSelector').value;
    if (!tahun) return alert("Pilih tahun terlebih dahulu");
    window.open(`print-rab.html?tahun=${tahun}`, '_blank');
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
                ? `<span style="color:#0ea5e9;">${item.judul_kegiatan}</span>`
                : `<span style="color:#cbd5e1; font-style:italic;">–</span>`;
            const rowBg = i % 2 === 0 ? '#fff' : '#f8fafc';

            // Highlight keyword in ss_name
            let ssNameHtml = item.ss_name;
            if (q) {
                const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                ssNameHtml = ssNameHtml.replace(regex, '<mark style="background:#fef08a; border-radius:2px;">$1</mark>');
            }

            html += `
                <tr style="background:${rowBg}; border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px 12px; font-weight:600; color:#64748b; font-size:0.8rem;">${item.ss_code}</td>
                    <td style="padding:10px 12px;">${ssNameHtml}</td>
                    <td style="padding:10px 12px;">${judulHtml}</td>
                    <td style="padding:10px 12px; text-align:right; font-weight:600; color:${item.grand_total > 0 ? 'var(--success)' : 'var(--text-muted)'};">
                        ${item.grand_total > 0 ? 'Rp ' + total : '–'}
                    </td>
                    <td style="padding:10px 12px; text-align:center;">
                        <button onclick="bukaRabDariSearch('${item.ss_code}', '${item.ss_name.replace(/'/g, "\\'")}'); document.getElementById('rabSearchModal').style.display='none';"
                            style="background:#0f172a; color:white; border:none; border-radius:6px; padding:5px 10px; cursor:pointer; font-size:0.8rem;">
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

// Buka modal rincian dari hasil pencarian, dengan navigasi ke Bidang/Sub Bidang yang tepat
window.bukaRabDariSearch = function(ssCode, ssName) {
    // Coba navigasi ke posisi hierarchy dulu, lalu buka modal
    if (rabHierarchy && Object.keys(rabHierarchy).length > 0) {
        const parts = ssCode.split('.');
        const bidangIdx = parseInt(parts[0]) - 1;
        const subBidangIdx = parseInt(parts[1]) - 1;

        // Click bidang
        const bidangItems = document.querySelectorAll('#rabBidangList .rab-item');
        if (bidangItems[bidangIdx]) bidangItems[bidangIdx].click();

        setTimeout(() => {
            const subItems = document.querySelectorAll('#rabSubBidangList .rab-item');
            if (subItems[subBidangIdx]) subItems[subBidangIdx].click();
            // Buka modal rincian
            setTimeout(() => openRabRincianModal(ssCode, ssName), 300);
        }, 300);
    } else {
        openRabRincianModal(ssCode, ssName);
    }
};
