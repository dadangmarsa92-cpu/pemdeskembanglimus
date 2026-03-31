// ============================================================
// DASHBOARD PAGE LOGIC - With Sidebar Navigation
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  initSidebar();
  initNavigation();

  // Logout button
  document.getElementById('btnLogout').addEventListener('click', handleLogout);
});

// ── Page Title Map ──
const pageTitles = {
  dashboard: 'Dashboard',
  sppd: 'SPPD',
  rab: 'RAB',
  permohonan: 'Permohonan Narasumber',
  sk: 'SK Narasumber',
  laporan: 'Laporan',
  pengaturan: 'Pengaturan'
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
      if (window.innerWidth <= 1024) {
        closeSidebar();
      }
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
      navigateTo(page);
    });
  });

  // Clickable stat cards on dashboard
  document.querySelectorAll('.stat-card.clickable').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.dataset.target;
      if (target) navigateTo(target);
    });
  });
}

// ── Navigate to Page ──
function navigateTo(page) {
  // Update sidebar active state
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
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

    // If SuperUser, load users table
    if (user.role === 'SuperUser') {
      loadUsersTable();
    }
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
  document.getElementById('navUsername').textContent = user.username;
  document.getElementById('navRole').textContent = user.role;
  document.getElementById('userAvatar').textContent = user.username.charAt(0).toUpperCase();

  // Sidebar
  document.getElementById('sidebarUsername').textContent = user.username;
  document.getElementById('sidebarRole').textContent = user.role;
  document.getElementById('sidebarAvatar').textContent = user.username.charAt(0).toUpperCase();

  // Welcome
  document.getElementById('welcomeName').textContent = user.username;

  if (user.role === 'SuperUser') {
    document.getElementById('welcomeDesc').textContent =
      'Anda login sebagai SuperUser. Anda memiliki akses penuh ke seluruh fitur sistem pelayanan desa.';
  } else {
    document.getElementById('welcomeDesc').textContent =
      'Anda login sebagai User. Anda dapat mengakses layanan pelayanan desa yang tersedia.';
  }

  // Set placeholder stats (will be dynamic later)
  document.getElementById('statSppd').textContent = '0';
  document.getElementById('statRab').textContent = '0';
  document.getElementById('statPermohonan').textContent = '0';
  document.getElementById('statSk').textContent = '0';
}

// ── Load Users Table (SuperUser) ──
async function loadUsersTable() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();

    if (data.success) {
      const section = document.getElementById('usersTableSection');
      section.style.display = 'block';

      const tbody = document.getElementById('usersTableBody');
      tbody.innerHTML = '';

      data.users.forEach(user => {
        const tr = document.createElement('tr');
        const roleClass = user.role === 'SuperUser' ? 'superuser' : 'user';
        const roleIcon = user.role === 'SuperUser' ? '🛡️' : '👤';
        const date = user.created_at
          ? new Date(user.created_at).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })
          : '-';

        tr.innerHTML = `
          <td>${user.id}</td>
          <td><strong>${user.username}</strong></td>
          <td><span class="role-badge ${roleClass}">${roleIcon} ${user.role}</span></td>
          <td>${date}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (error) {
    console.error('Failed to load users:', error);
  }
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

  const icon = type === 'success' ? '✅' : '❌';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
