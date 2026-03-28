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
