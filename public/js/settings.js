// ============================================================
// SETTINGS MODULE - Kelola pengaturan kode surat dan data desa
// ============================================================

let currentSettings = {};

// ── Init: dipanggil saat halaman Pengaturan aktif ──
async function initSettings() {
  await loadSettings();
  renderSettingsUI();
  bindSettingsEvents();
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

  const previewNomor = `${s.kode_surat || '096'}/001/${s.kode_desa || '18'}/${s.tahun || new Date().getFullYear()}`;
  const previewNomor2 = `${s.kode_surat || '096'}/002/${s.kode_desa || '18'}/${s.tahun || new Date().getFullYear()}`;

  container.innerHTML = `
    <!-- Preview Nomor Surat -->
    <div class="settings-preview-card">
      <div class="settings-preview-label">📄 Contoh Format Nomor Surat SPPD</div>
      <div class="settings-preview-number">${previewNomor}</div>
      <div class="settings-preview-number secondary">${previewNomor2}</div>
      <div class="settings-preview-desc">
        <span class="badge-code">${s.kode_surat || '096'}</span> = Kode Surat &nbsp;·&nbsp;
        <span class="badge-code">001</span> = Urutan Otomatis &nbsp;·&nbsp;
        <span class="badge-code">${s.kode_desa || '18'}</span> = Kode Desa &nbsp;·&nbsp;
        <span class="badge-code">${s.tahun || new Date().getFullYear()}</span> = Tahun
      </div>
    </div>

    <!-- Form Kode Surat -->
    <div class="settings-group">
      <div class="settings-group-header">
        <span class="settings-group-icon">🔢</span>
        <div>
          <h3>Kode Penomoran Surat</h3>
          <p>Konfigurasi kode yang digunakan untuk format nomor surat otomatis</p>
        </div>
      </div>
      <div class="settings-fields">
        <div class="settings-field">
          <label for="set_kode_surat">
            Kode Surat
            <span class="field-hint">Angka prefiks surat (contoh: 096)</span>
          </label>
          <input type="text" id="set_kode_surat" class="form-input settings-input"
            value="${s.kode_surat || '096'}" placeholder="096" maxlength="10"
            ${!isSuperUser ? 'disabled' : ''}>
        </div>
        <div class="settings-field">
          <label for="set_kode_desa">
            Kode Desa
            <span class="field-hint">Kode identitas desa (contoh: 18)</span>
          </label>
          <input type="text" id="set_kode_desa" class="form-input settings-input"
            value="${s.kode_desa || '18'}" placeholder="18" maxlength="10"
            ${!isSuperUser ? 'disabled' : ''}>
        </div>
        <div class="settings-field">
          <label for="set_tahun">
            Tahun Aktif
            <span class="field-hint">Tahun penomoran surat berjalan</span>
          </label>
          <input type="number" id="set_tahun" class="form-input settings-input"
            value="${s.tahun || new Date().getFullYear()}" placeholder="${new Date().getFullYear()}" min="2020" max="2099"
            ${!isSuperUser ? 'disabled' : ''}>
        </div>
      </div>
    </div>

    <!-- Form Data Desa -->
    <div class="settings-group">
      <div class="settings-group-header">
        <span class="settings-group-icon">🏛️</span>
        <div>
          <h3>Data Identitas Desa</h3>
          <p>Informasi yang tampil pada kop surat dan dokumen cetak</p>
        </div>
      </div>
      <div class="settings-fields">
        <div class="settings-field">
          <label for="set_nama_desa">
            Nama Desa
            <span class="field-hint">Nama desa (contoh: Kembanglimus)</span>
          </label>
          <input type="text" id="set_nama_desa" class="form-input settings-input"
            value="${s.nama_desa || 'Kembanglimus'}" placeholder="Kembanglimus"
            ${!isSuperUser ? 'disabled' : ''}>
        </div>
        <div class="settings-field">
          <label for="set_nama_kecamatan">
            Nama Kecamatan
            <span class="field-hint">Nama kecamatan</span>
          </label>
          <input type="text" id="set_nama_kecamatan" class="form-input settings-input"
            value="${s.nama_kecamatan || 'Borobudur'}" placeholder="Borobudur"
            ${!isSuperUser ? 'disabled' : ''}>
        </div>
        <div class="settings-field">
          <label for="set_nama_kabupaten">
            Nama Kabupaten
            <span class="field-hint">Nama kabupaten</span>
          </label>
          <input type="text" id="set_nama_kabupaten" class="form-input settings-input"
            value="${s.nama_kabupaten || 'Magelang'}" placeholder="Magelang"
            ${!isSuperUser ? 'disabled' : ''}>
        </div>
        <div class="settings-field">
          <label for="set_kepala_desa">
            Nama Kepala Desa
            <span class="field-hint">Nama yang muncul pada tanda tangan surat</span>
          </label>
          <input type="text" id="set_kepala_desa" class="form-input settings-input"
            value="${s.kepala_desa || 'SOETJI ARIMBI'}" placeholder="Nama Kepala Desa"
            ${!isSuperUser ? 'disabled' : ''}>
        </div>
      </div>
    </div>

    ${isSuperUser ? `
    <!-- Save Button -->
    <div class="settings-actions">
      <button class="btn-save" id="btnSaveSettings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:middle;">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Simpan Pengaturan
      </button>
      <button class="btn-cancel" id="btnResetSettings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:middle;">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 .49-3.51"></path>
        </svg>
        Reset ke Default
      </button>
    </div>
    ` : `
    <div class="settings-readonly-notice">
      🔒 Pengaturan hanya dapat diubah oleh <strong>SuperUser</strong>.
    </div>
    `}
  `;

  // Live preview update
  ['set_kode_surat', 'set_kode_desa', 'set_tahun'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateSettingsPreview);
  });

  if (isSuperUser) {
    bindSettingsEvents();
  }
}

// ── Live Preview Update ──
function updateSettingsPreview() {
  const kode = document.getElementById('set_kode_surat')?.value || '096';
  const desa = document.getElementById('set_kode_desa')?.value || '18';
  const tahun = document.getElementById('set_tahun')?.value || new Date().getFullYear();

  const previews = document.querySelectorAll('.settings-preview-number');
  if (previews[0]) previews[0].textContent = `${kode}/001/${desa}/${tahun}`;
  if (previews[1]) previews[1].textContent = `${kode}/002/${desa}/${tahun}`;

  const badges = document.querySelectorAll('.badge-code');
  if (badges[0]) badges[0].textContent = kode;
  if (badges[2]) badges[2].textContent = desa;
  if (badges[3]) badges[3].textContent = tahun;

  const desc = document.querySelector('.settings-preview-desc');
  if (desc) {
    desc.innerHTML = `
      <span class="badge-code">${kode}</span> = Kode Surat &nbsp;·&nbsp;
      <span class="badge-code">001</span> = Urutan Otomatis &nbsp;·&nbsp;
      <span class="badge-code">${desa}</span> = Kode Desa &nbsp;·&nbsp;
      <span class="badge-code">${tahun}</span> = Tahun
    `;
  }
}

// ── Bind Events ──
function bindSettingsEvents() {
  setTimeout(() => {
    const btnSave = document.getElementById('btnSaveSettings');
    const btnReset = document.getElementById('btnResetSettings');
    if (btnSave) btnSave.addEventListener('click', saveSettings);
    if (btnReset) btnReset.addEventListener('click', resetSettings);
  }, 100);
}

// ── Save Settings ──
async function saveSettings() {
  const payload = {
    kode_surat: document.getElementById('set_kode_surat')?.value.trim(),
    kode_desa: document.getElementById('set_kode_desa')?.value.trim(),
    tahun: document.getElementById('set_tahun')?.value.trim(),
    nama_desa: document.getElementById('set_nama_desa')?.value.trim(),
    nama_kecamatan: document.getElementById('set_nama_kecamatan')?.value.trim(),
    nama_kabupaten: document.getElementById('set_nama_kabupaten')?.value.trim(),
    kepala_desa: document.getElementById('set_kepala_desa')?.value.trim(),
  };

  // Validasi kode_surat
  if (!payload.kode_surat || !payload.kode_desa || !payload.tahun) {
    showToast('Kode surat, kode desa, dan tahun wajib diisi.', 'error');
    return;
  }

  try {
    const btn = document.getElementById('btnSaveSettings');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      currentSettings = { ...currentSettings, ...payload };
      showToast('✅ Pengaturan berhasil disimpan!', 'success');
      // Refresh nomor surat di form SPPD jika sedang aktif
      if (typeof loadNextNomorSurat === 'function') {
        loadNextNomorSurat();
      }
    } else {
      showToast(result.message || 'Gagal menyimpan pengaturan.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan koneksi.', 'error');
  } finally {
    const btn = document.getElementById('btnSaveSettings');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:middle;">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Simpan Pengaturan`;
    }
  }
}

// ── Reset to Default ──
async function resetSettings() {
  if (!confirm('Reset semua pengaturan ke nilai default?')) return;

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
    const result = await res.json();
    if (result.success) {
      currentSettings = defaults;
      renderSettingsUI();
      showToast('Pengaturan direset ke default.', 'success');
    }
  } catch (err) {
    showToast('Gagal mereset pengaturan.', 'error');
  }
}
