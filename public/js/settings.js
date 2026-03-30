// ============================================================
// SETTINGS MODULE - Kelola pengaturan kode surat dan data desa
// ============================================================

let currentSettings = {};
let currentSettingsTab = 'umum';

// ── Init: dipanggil saat halaman Pengaturan aktif ──
async function initSettings() {
  await loadSettings();
  renderSettingsUI();
}

// ── Load settings dari server ──
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const result = await res.json();
    if (result.success) {
      currentSettings = result.settings;
    }
  } catch (err) {
    console.error('Gagal memuat pengaturan:', err);
  }
}

// ── Render UI Pengaturan ──
function renderSettingsUI() {
  const container = document.getElementById('settingsContent');
  if (!container) return;

  const s = currentSettings;
  const isSuperUser = (document.getElementById('sidebarRole')?.textContent || '').includes('SuperUser');

  // Update Active Tab Class
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === currentSettingsTab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    // Bind click event once
    if (!btn.onclick) {
      btn.onclick = () => {
        currentSettingsTab = btn.getAttribute('data-tab');
        renderSettingsUI();
      };
    }
  });

  let contentHtml = '';

  if (currentSettingsTab === 'umum') {
    contentHtml = `
      <div class="settings-group">
        <div class="settings-group-title">🏛️ Identitas Desa</div>
        <div class="settings-grid">
          <div class="form-group">
            <label for="set_nama_desa">Nama Desa</label>
            <input type="text" id="set_nama_desa" class="form-input" value="${s.nama_desa || ''}" ${!isSuperUser ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label for="set_nama_kecamatan">Nama Kecamatan</label>
            <input type="text" id="set_nama_kecamatan" class="form-input" value="${s.nama_kecamatan || ''}" ${!isSuperUser ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label for="set_nama_kabupaten">Nama Kabupaten</label>
            <input type="text" id="set_nama_kabupaten" class="form-input" value="${s.nama_kabupaten || ''}" ${!isSuperUser ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label for="set_kepala_desa">Nama Kepala Desa</label>
            <input type="text" id="set_kepala_desa" class="form-input" value="${s.kepala_desa || ''}" ${!isSuperUser ? 'disabled' : ''}>
          </div>
        </div>
      </div>
    `;
  } else if (currentSettingsTab === 'sppd') {
    const previewNomor = `${s.kode_surat || '096'}/001/${s.kode_desa || '18'}/${s.tahun || new Date().getFullYear()}`;
    contentHtml = `
      <div class="settings-group">
        <div class="settings-group-title">🔢 Penomoran SPPD</div>
        <div class="settings-grid">
          <div class="form-group">
            <label for="set_kode_surat">Kode Surat</label>
            <input type="text" id="set_kode_surat" class="form-input" value="${s.kode_surat || ''}" ${!isSuperUser ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label for="set_kode_desa">Kode Desa</label>
            <input type="text" id="set_kode_desa" class="form-input" value="${s.kode_desa || ''}" ${!isSuperUser ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label for="set_tahun">Tahun Berjalan</label>
            <input type="number" id="set_tahun" class="form-input" value="${s.tahun || ''}" ${!isSuperUser ? 'disabled' : ''}>
          </div>
        </div>
        <div style="margin-top:20px; padding:15px; background:rgba(255,255,255,0.05); border-radius:8px;">
          <small style="color:var(--text-muted); display:block; margin-bottom:5px;">Preview Format Nomor Surat :</small>
          <strong style="color:var(--accent); font-size:1.1rem; letter-spacing:1px;">${previewNomor}</strong>
        </div>
      </div>
    `;
  } else {
    contentHtml = `
      <div class="empty-state" style="padding: 60px 20px;">
        <div class="empty-icon">📁</div>
        <h3>Pengaturan ${currentSettingsTab.toUpperCase()}</h3>
        <p>Halaman pengaturan untuk modul ini akan segera tersedia.</p>
      </div>
    `;
  }

  const actionButtons = isSuperUser ? `
    <div class="form-actions" style="margin-top: 30px;">
      <button type="button" class="btn-save" id="btnSaveSettings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:middle;">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Simpan Perubahan
      </button>
      <button type="button" class="btn-cancel" id="btnResetSettings">
        Reset
      </button>
    </div>
  ` : '';

  container.innerHTML = contentHtml + actionButtons;

  if (isSuperUser) {
    document.getElementById('btnSaveSettings')?.addEventListener('click', saveSettings);
    document.getElementById('btnResetSettings')?.addEventListener('click', resetSettings);
  }
}

// ── Save Settings ──
async function saveSettings() {
  const payload = { ...currentSettings };
  
  // Collect values only from visible inputs (to avoid overwriting absent fields in current tab)
  const inputs = {
    kode_surat: 'set_kode_surat',
    kode_desa: 'set_kode_desa',
    tahun: 'set_tahun',
    nama_desa: 'set_nama_desa',
    nama_kecamatan: 'set_nama_kecamatan',
    nama_kabupaten: 'set_nama_kabupaten',
    kepala_desa: 'set_kepala_desa'
  };

  for (const [key, id] of Object.entries(inputs)) {
    const el = document.getElementById(id);
    if (el) payload[key] = el.value.trim();
  }

  try {
    const btn = document.getElementById('btnSaveSettings');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      currentSettings = payload;
      showToast('✅ Pengaturan berhasil disimpan!', 'success');
      renderSettingsUI();
      if (typeof loadNextNomorSurat === 'function') loadNextNomorSurat();
    } else {
      showToast(result.message, 'error');
    }
  } catch (err) {
    showToast('Gagal menghubungkan ke server.', 'error');
  } finally {
    const btn = document.getElementById('btnSaveSettings');
    if (btn) btn.disabled = false;
  }
}

// ── Reset to Default ──
async function resetSettings() {
  if (!confirm('Yakin ingin mereset pengaturan ke default?')) return;
  
  const defaults = {
    kode_surat: '096',
    kode_desa: '18',
    tahun: String(new Date().getFullYear()),
    nama_desa: 'Kembanglimus',
    nama_kecamatan: 'Borobudur',
    nama_kabupaten: 'Magelang',
    kepala_desa: 'SOETJI ARIMBI',
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(defaults)
    });
    if ((await res.json()).success) {
      currentSettings = defaults;
      showToast('Pengaturan direset.', 'success');
      renderSettingsUI();
    }
  } catch {
    showToast('Gagal mereset.', 'error');
  }
}
