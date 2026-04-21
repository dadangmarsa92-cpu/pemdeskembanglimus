/**
 * RAB (Rencana Anggaran Biaya) - 3-Column Drill-down Logic
 */

let rabBidangData = [];
let rabHierarchy = {};
let selectedBidangIdx = 0;
let selectedSubBidangIdx = 0;

function initRab() {
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

    const firstRow = data[0] || {};
    const keys = Object.keys(firstRow);
    const bidangKey = keys.find(k => k.toLowerCase().includes('bidang')) || keys[1] || keys[0];

    data.forEach((item, index) => {
        const bidangName = item[bidangKey];
        if (!bidangName) return;

        const div = document.createElement('div');
        div.className = 'rab-item rab-bidang-item';
        applyStyles(div, false);
        div.innerHTML = `
            <span class="idx-badge">${index + 1}</span>
            <span style="flex: 1;">${bidangName}</span>
        `;

        div.onclick = () => {
            selectedBidangIdx = index + 1;
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
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: var(--shadow-md);">
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
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 14px 20px; font-family: 'JetBrains Mono', 'Courier New', monospace; color: var(--primary); font-weight: 700; font-size: 0.9rem; vertical-align: top;">${ssCode}</td>
                    <td style="padding: 14px 20px 14px 20px; color: var(--text-dark); font-weight: 500; line-height: 1.5; font-size: 0.9rem; word-wrap: break-word; overflow-wrap: break-word;">${ssName}</td>
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

// Global initialization
window.initRab = initRab;

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
