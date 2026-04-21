/**
 * RAB (Rencana Anggaran Biaya) - Excel View Logic
 */

let rabBidangData = [];
let rabHierarchy = {};

function initRab() {
    loadRabExcelData();
}

async function loadRabExcelData() {
    const listContainer = document.getElementById('rabBidangList');

    try {
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Memuat data Excel...</div>';
        
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
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Gagal menghubungi server.</div>';
    }
}

function renderBidangList(data) {
    const listContainer = document.getElementById('rabBidangList');
    listContainer.innerHTML = '';

    if (data.length === 0) {
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Data kosong.</div>';
        return;
    }

    const firstRow = data[0];
    const keys = Object.keys(firstRow);
    const bidangKey = keys.find(k => k.toLowerCase().includes('bidang')) || keys[1] || keys[0];

    data.forEach((item, index) => {
        const bidangName = item[bidangKey];
        if (!bidangName) return;

        const div = document.createElement('div');
        div.className = 'rab-bidang-item';
        div.style.padding = '12px 16px';
        div.style.margin = '4px 0';
        div.style.borderRadius = '8px';
        div.style.cursor = 'pointer';
        div.style.fontSize = '0.9rem';
        div.style.fontWeight = '500';
        div.style.transition = 'all 0.2s';
        div.style.border = '1px solid transparent';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '10px';
        div.innerHTML = `
            <span style="background: #e2e8f0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.75rem;">${index + 1}</span>
            <span style="flex: 1;">${bidangName}</span>
        `;

        div.onclick = () => {
            document.querySelectorAll('.rab-bidang-item').forEach(el => {
                el.style.background = 'transparent';
                el.style.borderColor = 'transparent';
                el.style.color = 'inherit';
                el.classList.remove('active');
            });

            div.style.background = 'var(--primary-light)';
            div.style.borderColor = 'var(--primary)';
            div.style.color = 'white';
            div.classList.add('active');

            showHierarchy(bidangName, index + 1);
        };

        listContainer.appendChild(div);
    });
}

function showHierarchy(bidangName, bidangIndex) {
    const titleContainer = document.getElementById('rabSelectedBidangTitle');
    const contentContainer = document.getElementById('rabSubBidangContent');

    titleContainer.textContent = bidangName;

    const subs = rabHierarchy[bidangName] || {};
    const subNames = Object.keys(subs);

    if (subNames.length === 0) {
        contentContainer.innerHTML = `
            <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 40px; text-align: center; color: var(--text-muted);">
                Data rincian tidak ditemukan untuk bidang ini.
            </div>
        `;
        return;
    }

    let html = '';

    subNames.forEach((subName, subIdx) => {
        const subCode = `${bidangIndex}.${String(subIdx + 1).padStart(2, '0')}`;
        const subSubList = subs[subName];

        html += `
            <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-bottom: 24px;">
                <div style="padding: 14px 18px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-family: monospace; background: var(--primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">${subCode}</span>
                        <span style="font-weight: 700; color: var(--text-dark); font-size: 0.95rem;">${subName}</span>
                    </div>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f1f5f9; text-align: left;">
                            <th style="padding: 10px 18px; border-bottom: 1px solid #e2e8f0; width: 100px; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Kode</th>
                            <th style="padding: 10px 18px; border-bottom: 1px solid #e2e8f0; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Nama Sub-Sub Bidang / Kegiatan</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (subSubList && subSubList.length > 0) {
            subSubList.forEach((subSubName, ssIdx) => {
                const ssCode = `${subCode}.${String(ssIdx + 1).padStart(2, '0')}`;
                html += `
                    <tr style="border-bottom: 1px solid #f8fafc;">
                        <td style="padding: 12px 18px; font-family: monospace; color: var(--primary); font-weight: 600;">${ssCode}</td>
                        <td style="padding: 12px 18px; color: var(--text-main); font-weight: 500;">${subSubName}</td>
                    </tr>
                `;
            });
        } else {
            html += `<tr><td colspan="2" style="padding: 20px; text-align: center; color: var(--text-muted);">Tidak ada rincian sub-sub bidang.</td></tr>`;
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;
    });

    contentContainer.innerHTML = html;
}

window.initRab = initRab;
