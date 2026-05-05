// ============================================================
// DASHBOARD PAGE LOGIC - With Sidebar Navigation
// ============================================================

let currentFilteredLaporan = []; // To store data for excel/pdf export

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  initSidebar();
  initNavigation();
  initSppdPrompt();
  checkRakNotificationBadge();

  // Logout button
  document.getElementById('btnLogout').addEventListener('click', handleLogout);
});

// ── Page Title Map ──
const pageTitles = {
  dashboard: 'Dashboard',
  sppd: 'SPPD',
  narasumber: 'Permohonan Narasumber',
  'surat-ahli-waris': 'Surat Ahli Waris',
  permohonan: 'Permohonan Narasumber',
  sk: 'SK Narasumber',
  rab: 'Rencana Anggaran Biaya (RAB)',
  rak: 'RAK Kegiatan',
  laporan: 'Laporan',
  pengaturan: 'Pengaturan',
  'ijin-keramaian': 'Ijin Keramaian',
  'ijin-tempat': 'Ijin Keramaian — Ijin Tempat',
  'daftar-hadir': 'Daftar Hadir & Penerimaan',
  'pengantar-nikah': 'Pengantar Nikah',
  'rak-kegiatan': 'RAK Kegiatan',
  'rak-kalender': 'Kalender Kegiatan'
};

// ── Initialize Sidebar Toggle ──
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburgerBtn');
  const closeBtn = document.getElementById('sidebarClose');

  hamburger.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
  });

  closeBtn.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  }

  // Close sidebar on link click (mobile)
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 1024 && !link.classList.contains('sidebar-dropdown-toggle')) {
        closeSidebar();
      }
    });
  });

  // Sidebar dropdown toggle
  const dropdownToggles = document.querySelectorAll('.sidebar-dropdown-toggle');
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const parent = toggle.closest('.sidebar-dropdown');
      parent.classList.toggle('open');
    });
  });
}

// ── Initialize Navigation ──
function initNavigation() {
  const links = document.querySelectorAll('.sidebar-link');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page === 'sppd') {
        openSppdPrompt();
      } else {
        navigateTo(page);
      }
    });
  });

  // Clickable stat cards on dashboard
  document.querySelectorAll('.stat-card.clickable').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.dataset.target;
      if (target === 'sppd') {
        openSppdPrompt();
      } else if (target) {
        navigateTo(target);
      }
    });
  });
}

function openSppdPrompt() {
  const modal = document.getElementById('sppdPromptModal');
  const input = document.getElementById('sppdPromptCount');
  if (modal && input) {
    input.value = '';
    modal.classList.add('active');
    setTimeout(() => input.focus(), 100);
  } else {
    navigateTo('sppd'); // fallback
  }
}

function closeSppdPrompt() {
  const modal = document.getElementById('sppdPromptModal');
  if (modal) modal.classList.remove('active');
}

function initSppdPrompt() {
  const btnLanjut = document.getElementById('btnSppdPromptLanjut');
  const btnBatal = document.getElementById('btnSppdPromptBatal');
  const inputPrompt = document.getElementById('sppdPromptCount');
  const modal = document.getElementById('sppdPromptModal');

  const handleBatal = () => {
    closeSppdPrompt();
    navigateTo('sppd');
    const fieldset = document.getElementById('sppdFormFieldset');
    if (fieldset) fieldset.disabled = true;
  };

  if (btnBatal) btnBatal.addEventListener('click', handleBatal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) handleBatal();
    });
  }

  if (btnLanjut) {
    btnLanjut.addEventListener('click', () => {
      if (!inputPrompt.value || parseInt(inputPrompt.value) < 1) {
        showToast('Jumlah SPPD harus diisi (minimal 1)', 'error');
        inputPrompt.focus();
        return;
      }
      closeSppdPrompt();
      window.jumlahSppdTarget = parseInt(inputPrompt.value);
      navigateTo('sppd');
      const fieldset = document.getElementById('sppdFormFieldset');
      if (fieldset) fieldset.disabled = false;
    });
  }
  
  if (inputPrompt) {
    // Allow pressing enter to submit
    inputPrompt.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnLanjut.click();
      }
    });
  }
}

// ── Navigate to Page ──
function navigateTo(page) {
  // Update sidebar active state for all links (main + sub)
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === page) {
      link.classList.add('active');
    }
  });

  // Auto-open dropdown if sub-page is within it
  const suratPages = ['narasumber', 'surat-ahli-waris'];
  const ijinPages  = ['ijin-keramaian', 'ijin-tempat'];
  const allDropdowns = document.querySelectorAll('.sidebar-dropdown');
  allDropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.sidebar-dropdown-toggle');
    if (!toggle) return;
    if (toggle.id === 'suratDropdownToggle' && suratPages.includes(page)) {
      dropdown.classList.add('open');
    } else if (toggle.id === 'ijinKeramaianDropdownToggle' && ijinPages.includes(page)) {
      dropdown.classList.add('open');
    }
  });

  // Show/hide page sections
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.remove('active');
  });

  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // Update top nav title
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle && pageTitles[page]) {
    pageTitle.textContent = pageTitles[page];
  }

  // Page-specific init
  if (page === 'sppd') {
    if (typeof focusSppdFirstField === 'function') focusSppdFirstField();
  }
  if (page === 'pengaturan') {
    if (typeof initSettings === 'function') initSettings();
  }
  if (page === 'sppd') {
    if (typeof loadNextNomorSurat === 'function') loadNextNomorSurat();
  }
  if (page === 'laporan') {
    initLaporanTabs();
    loadLaporanSppd();
    if (typeof initRab === 'function') initRab();
  }

  if (page === 'narasumber' && typeof loadNarasumberData === 'function') {
    loadNarasumberData();
    loadNextNaraNumber();
  }

  if (page === 'rab' && typeof initRab === 'function') {
    initRab();
  }

  if (page === 'rak' && typeof initRak === 'function') {
    initRak();
  }

  if (page === 'surat-ahli-waris' && typeof loadAhliWarisData === 'function') {
    loadAhliWarisData();
    loadNextAhliWarisNumber();
  }

  if (page === 'pengantar-nikah') {
    if (typeof loadNextPNNumber === 'function') loadNextPNNumber();
    if (typeof loadPengantarNikahData === 'function') loadPengantarNikahData();
  }

  if (page === 'rak-kegiatan' && typeof initRakKegiatan === 'function') {
    initRakKegiatan();
  }
  
  if (page === 'rak-kalender' && typeof initRakKalender === 'function') {
    initRakKalender();
  }

  // Ijin Keramaian — kedua sub-page menggunakan page-ijin-keramaian yang sama
  if (page === 'ijin-keramaian' || page === 'ijin-tempat') {
    // Always show the page-ijin-keramaian section (one page, two tabs)
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    const ikPage = document.getElementById('page-ijin-keramaian');
    if (ikPage) ikPage.classList.add('active');

    if (page === 'ijin-keramaian') {
      // Switch to keramaian tab
      const ikTabs = document.getElementById('ijinKeramaianTabs');
      if (ikTabs) {
        ikTabs.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === 'ik-keramaian');
        });
      }
      document.querySelectorAll('.ik-tab-content').forEach(c => c.style.display = 'none');
      const tab = document.getElementById('ik-keramaian');
      if (tab) tab.style.display = 'block';
      if (typeof loadNextIKNumber === 'function') loadNextIKNumber();
      if (typeof loadIjinKeramaianData === 'function') loadIjinKeramaianData();
    } else {
      // Switch to tempat tab
      const ikTabs = document.getElementById('ijinKeramaianTabs');
      if (ikTabs) {
        ikTabs.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === 'ik-tempat');
        });
      }
      document.querySelectorAll('.ik-tab-content').forEach(c => c.style.display = 'none');
      const tab = document.getElementById('ik-tempat');
      if (tab) tab.style.display = 'block';
      if (typeof loadIjinTempatData === 'function') loadIjinTempatData();
    }
  }
}

// ── Initialize Laporan Tabs ──
function initLaporanTabs() {
  const tabs = document.querySelectorAll('#laporanTabs .tab-btn');
  const contents = document.querySelectorAll('.laporan-tab-content');

  tabs.forEach(tab => {
    tab.onclick = () => {
      // Buttons
      tabs.forEach(b => b.classList.remove('active'));
      tab.classList.add('active');

      // Content
      const target = tab.dataset.tab;
      contents.forEach(c => {
        c.style.display = c.id === target ? 'block' : 'none';
      });

      // Special handling for RAB report
      if (target === 'laporan-rab' && typeof loadLaporanRab === 'function') {
        // Option: automatically load if not loaded yet
        // loadLaporanRab(); 
      }
    };
  });
}

// ── Load Laporan SPPD ──
async function loadLaporanSppd() {
  const tbody = document.getElementById('rekapSppdTableBody');
  const countEl = document.getElementById('rekapSppdCount');
  const budgetEl = document.getElementById('rekapSppdBudget');

  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">Memuat data...</td></tr>';

  // Filters
  const fYear = document.getElementById('filterSppdYear').value;
  const fMonth = document.getElementById('filterSppdMonth').value;
  const fDateInput = document.getElementById('filterSppdDate').value;

  try {
    const res = await fetch('/api/sppd');
    const result = await res.json();

    if (result.success && result.data.length > 0) {
      let filtered = result.data;

      // Filter by Year
      if (fYear) {
        filtered = filtered.filter(item => {
          return item.tanggal_berangkat && item.tanggal_berangkat.startsWith(fYear);
        });
      }

      // Filter by Month
      if (fMonth) {
        filtered = filtered.filter(item => {
          if (!item.tanggal_berangkat) return false;
          const m = item.tanggal_berangkat.split('-')[1];
          return m === fMonth;
        });
      }

      // Filter by Specific Date
      if (fDateInput) {
        filtered = filtered.filter(item => {
          return item.tanggal_berangkat === fDateInput;
        });
      }

      currentFilteredLaporan = filtered;
      countEl.textContent = filtered.length;
      
      let totalBudget = 0;
      tbody.innerHTML = '';

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">Tidak ada data yang sesuai filter.</td></tr>';
        budgetEl.textContent = 'Rp. 0';
        return;
      }

      filtered.forEach((item, index) => {
        const nominalStr = (item.nominal_rupiah || '0').replace(/\./g, '');
        const nominal = parseInt(nominalStr) || 0;
        totalBudget += nominal;

        // Custom format dd/mm/yyyy for table
        let dateDisplay = '-';
        if (item.tanggal_berangkat) {
          const [y, m, d] = item.tanggal_berangkat.split('-');
          dateDisplay = `${d}/${m}/${y}`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${index + 1}</td>
          <td><strong>${item.nama_pegawai}</strong></td>
          <td>${item.acara}</td>
          <td>${dateDisplay}</td>
          <td style="color:var(--success); font-weight:600;">Rp. ${item.nominal_rupiah || '0'}</td>
        `;
        tbody.appendChild(tr);
      });

      budgetEl.textContent = 'Rp. ' + totalBudget.toLocaleString('id-ID');
    } else {
      countEl.textContent = '0';
      budgetEl.textContent = 'Rp. 0';
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">Tidak ada data laporan SPPD.</td></tr>';
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger);">Gagal memuat laporan.</td></tr>';
  }
}

function resetLaporanSppd() {
  document.getElementById('filterSppdYear').value = '';
  document.getElementById('filterSppdMonth').value = '';
  document.getElementById('filterSppdDate').value = '';
  loadLaporanSppd();
}

// ── Export SPPD to Excel ──
async function exportLaporanSppdExcel() {
  if (!currentFilteredLaporan || currentFilteredLaporan.length === 0) {
    showToast('Tidak ada data untuk diekspor.', 'error');
    return;
  }

  try {
    // Get setting for Nama Desa
    const sRes = await fetch('/api/settings');
    const sData = await sRes.json();
    const settings = sData.success ? sData.settings : {};
    const namaDesa = settings.nama_desa || 'Kembanglimus';
    const tahun = settings.tahun || new Date().getFullYear();

    // Prepare Date Range for Header
    const fDate = document.getElementById('filterSppdDate').value;
    const fMonth = document.getElementById('filterSppdMonth').value;
    const fYear = document.getElementById('filterSppdYear').value || tahun;
    let rangeHeader = `TAHUN ${fYear}`;
    if (fMonth) {
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      rangeHeader = `${monthNames[parseInt(fMonth)-1].toUpperCase()} ${fYear}`;
    }
    if (fDate) {
      const [y, m, d] = fDate.split('-');
      rangeHeader = `${d}/${m}/${y}`;
    }

    const title = `LAPORAN SPPD DESA ${namaDesa.toUpperCase()}`;
    const subtitle = `PERIODE: ${rangeHeader}`;

    // Prepare Data for SheetJS
    const data = currentFilteredLaporan.map((item, index) => ({
      'No': index + 1,
      'Nomor Surat': item.nomor_surat,
      'Nama Pegawai': item.nama_pegawai,
      'Jabatan': item.jabatan,
      'Tujuan': item.tujuan,
      'Acara / Maksud': item.acara,
      'Lama': item.lama_perjalanan || '-',
      'Tgl Berangkat': item.tanggal_berangkat ? item.tanggal_berangkat.split('-').reverse().join('/') : '-',
      'Tgl Kembali': item.tanggal_kembali ? item.tanggal_kembali.split('-').reverse().join('/') : '-',
      'Nominal (Rp)': parseInt(item.nominal_rupiah) || 0
    }));

    const totalBudget = currentFilteredLaporan.reduce((sum, item) => sum + (parseInt(item.nominal_rupiah) || 0), 0);
    
    // Create Worksheet
    const ws = XLSX.utils.json_to_sheet([]);
    
    // Add Headers Manual
    XLSX.utils.sheet_add_aoa(ws, [
      [title],
      [subtitle],
      []
    ], { origin: 'A1' });

    // Add Data Table
    XLSX.utils.sheet_add_json(ws, data, { origin: 'A4', skipHeader: false });

    // Add Total at the bottom
    const lastRow = 4 + data.length + 1;
    XLSX.utils.sheet_add_aoa(ws, [
      ['', '', '', '', '', '', '', '', 'TOTAL PENGGUNAAN ANGGARAN:', totalBudget]
    ], { origin: `A${lastRow}` });

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan SPPD');

    // Download
    XLSX.writeFile(wb, `Laporan_SPPD_${namaDesa}_${fYear}.xlsx`);
    showToast('Laporan Excel berhasil diunduh.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal mengekspor ke Excel.', 'error');
  }
}

// ── Export SPPD to PDF (Print) ──
function printLaporanSppdPdf() {
  if (!currentFilteredLaporan || currentFilteredLaporan.length === 0) {
    showToast('Tidak ada data untuk dicetak.', 'error');
    return;
  }

  // Save current report data to localStorage so the print page can read it
  const reportData = {
    data: currentFilteredLaporan,
    filters: {
      year: document.getElementById('filterSppdYear').value,
      month: document.getElementById('filterSppdMonth').value,
      date: document.getElementById('filterSppdDate').value
    }
  };
  localStorage.setItem('printReportData', JSON.stringify(reportData));

  // Open print page
  const printWin = window.open('laporan-sppd-cetak.html', '_blank');
  if (!printWin) {
    showToast('Pop-up terblokir. Izinkan pop-up untuk mencetak.', 'error');
  }
}

// ── Check Session ──
async function checkSession() {
  try {
    const res = await fetch('/api/session');
    const data = await res.json();

    if (!data.loggedIn) {
      window.location.href = '/index.html';
      return;
    }

    const user = data.user;
    renderDashboard(user);

  } catch (error) {
    showToast('Gagal memuat sesi. Mengarahkan ke halaman login...', 'error');
    setTimeout(() => {
      window.location.href = '/index.html';
    }, 2000);
  }
}

// ── Render Dashboard ──
function renderDashboard(user) {
  // Nav bar
  const navUsernameEl = document.getElementById('navUsername');
  if(navUsernameEl) navUsernameEl.textContent = user.username;
  const userAvatarEl = document.getElementById('userAvatar');
  if(userAvatarEl) userAvatarEl.textContent = user.username.charAt(0).toUpperCase();

  // Sidebar
  const sidebarUsernameEl = document.getElementById('sidebarUsername');
  if(sidebarUsernameEl) sidebarUsernameEl.textContent = user.username;
  const sidebarAvatarEl = document.getElementById('sidebarAvatar');
  if(sidebarAvatarEl) sidebarAvatarEl.textContent = user.username.charAt(0).toUpperCase();

  // Welcome
  document.getElementById('welcomeName').textContent = user.username;

  const welcomeDescEl = document.getElementById('welcomeDesc');
  if (welcomeDescEl) {
    welcomeDescEl.textContent = 'Anda memiliki akses penuh ke seluruh fitur sistem pelayanan desa.';
  }

  updateDashboardStats();
}

async function updateDashboardStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (data.success) {
      if (document.getElementById('statSppd')) document.getElementById('statSppd').textContent = data.stats.sppd || '0';
      if (document.getElementById('statNarasumberTotal')) document.getElementById('statNarasumberTotal').textContent = data.stats.narasumber || '0';
      
      // Dashboard items
      if (document.getElementById('statPermohonan')) document.getElementById('statPermohonan').textContent = data.stats.permohonan || '0';
      if (document.getElementById('statSk')) document.getElementById('statSk').textContent = data.stats.sk || '0';
    }
  } catch (err) { console.error('Failed to load stats:', err); }
}

// ── Common Utilities ──
function formatDateID(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear(); 
  return `${day}/${month}/${year}`;
}

function reformatToISO(dmY) {
  if (!dmY) return '';
  const parts = dmY.split('/');
  if (parts.length !== 3) return dmY;
  let [d, m, y] = parts;
  let yearNum = parseInt(y);
  if (yearNum < 100) yearNum += 2000;
  return `${yearNum}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}





// ── Logout ──
async function handleLogout() {
  try {
    const res = await fetch('/api/logout', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showToast('Berhasil logout. Mengarahkan...', 'success');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1000);
    }
  } catch (error) {
    showToast('Gagal logout.', 'error');
  }
}

// ── Toast Notification ──
function showToast(message, type = 'error') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✅' : type === 'info' ? 'ℹ️' : '❌';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── RAK Notification Logic ──
window.toggleRakNotification = async function(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('rakNotifDropdown');
  if (dropdown.style.display === 'block') {
    dropdown.style.display = 'none';
    return;
  }
  
  // Close if clicking outside
  document.addEventListener('click', function closeNotif(e) {
    if (!dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
      document.removeEventListener('click', closeNotif);
    }
  });

  dropdown.style.display = 'block';
  const content = document.getElementById('rakNotifContent');
  const monthLabel = document.getElementById('rakNotifMonthLabel');
  
  const now = new Date();
  const tahun = now.getFullYear().toString();
  const bulan = now.getMonth() + 1; // 1-12
  
  const bulanNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  monthLabel.textContent = bulanNames[bulan - 1] + ' ' + tahun;
  
  content.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 40px 20px;">Memuat data...</div>';

  try {
    const res = await fetch(`/api/rak?tahun=${tahun}`);
    const result = await res.json();

    if (!result.success || !result.rabRecords) {
      content.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444; font-size: 0.9rem;">Gagal memuat data.</div>';
      return;
    }

    const { rabRecords, rakAllocations, ssLookup } = result;
    
    // Collect items for current month
    const currentMonthItems = [];
    let totalBulan = 0;

    rabRecords.forEach(rec => {
      let groupName = rec._groupName || (ssLookup && ssLookup[rec.ss_code]) || rec.ss_code;
      const items = rec.data_json || [];
      items.forEach((u, idx) => {
        const uraianIndex = u.index !== undefined ? String(u.index) : String(idx);
        const allocKey = `${rec.ss_code}::${uraianIndex}`;
        const allocs = rakAllocations[allocKey] || {};
        const nominal = allocs[bulan];

        if (nominal && nominal > 0) {
          currentMonthItems.push({
            groupName: groupName,
            uraian: u.uraian || `Item ${idx + 1}`,
            nominal: nominal
          });
          totalBulan += nominal;
        }
      });
    });

    if (currentMonthItems.length === 0) {
      content.innerHTML = `
        <div style="padding: 30px 20px; text-align: center; color: #94a3b8;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px; opacity: 0.5;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <p style="margin:0; font-size: 0.9rem; font-weight: 500;">Tidak ada jadwal kegiatan bulan ini.</p>
        </div>
      `;
      document.getElementById('rakNotifBadge').style.display = 'none';
    } else {
      let html = `<div style="background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">Total Anggaran</span>
        <span style="font-size: 1.1rem; color: #15803d; font-weight: 800;">Rp ${totalBulan.toLocaleString('id-ID')}</span>
      </div>`;
      
      html += '<ul style="list-style: none; padding: 0; margin: 0;">';
      currentMonthItems.forEach((item, idx) => {
        html += `
          <li style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
            <div style="font-size: 0.7rem; color: #64748b; font-weight: 700; margin-bottom: 4px; text-transform: uppercase;">${item.groupName}</div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
              <span style="font-size: 0.85rem; color: #1e293b; line-height: 1.4; flex: 1;">${item.uraian}</span>
              <span style="font-size: 0.85rem; font-weight: 700; color: #15803d; white-space: nowrap;">Rp ${item.nominal.toLocaleString('id-ID')}</span>
            </div>
          </li>
        `;
      });
      html += '</ul>';
      content.innerHTML = html;
      
      // Show badge
      const badge = document.getElementById('rakNotifBadge');
      badge.textContent = currentMonthItems.length;
      badge.style.display = 'flex';
    }
  } catch (err) {
    console.error('Failed to load RAK Notification data:', err);
    content.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444; font-size: 0.9rem;">Gagal memuat data.</div>';
  }
};

window.checkRakNotificationBadge = async function() {
  const badge = document.getElementById('rakNotifBadge');
  if (!badge) return;
  
  const now = new Date();
  const tahun = now.getFullYear().toString();
  const bulan = now.getMonth() + 1;

  try {
    const res = await fetch(`/api/rak?tahun=${tahun}`);
    const result = await res.json();
    if (!result.success || !result.rabRecords) return;

    const { rabRecords, rakAllocations } = result;
    let count = 0;

    rabRecords.forEach(rec => {
      const items = rec.data_json || [];
      items.forEach((u, idx) => {
        const uraianIndex = u.index !== undefined ? String(u.index) : String(idx);
        const allocKey = `${rec.ss_code}::${uraianIndex}`;
        const allocs = rakAllocations[allocKey] || {};
        if (allocs[bulan] && allocs[bulan] > 0) count++;
      });
    });

    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch (err) {
    // silently ignore badge failure
  }
};
