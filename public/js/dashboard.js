// ============================================================
// DASHBOARD PAGE LOGIC
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  checkSession();

  // Logout button
  document.getElementById('btnLogout').addEventListener('click', handleLogout);
});

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
  // Nav
  document.getElementById('navUsername').textContent = user.username;
  document.getElementById('navRole').textContent = user.role;
  document.getElementById('userAvatar').textContent = user.username.charAt(0).toUpperCase();

  // Welcome
  document.getElementById('welcomeName').textContent = user.username;

  if (user.role === 'SuperUser') {
    document.getElementById('welcomeDesc').textContent =
      'Anda login sebagai SuperUser. Anda memiliki akses penuh ke seluruh fitur sistem pelayanan desa.';
  } else {
    document.getElementById('welcomeDesc').textContent =
      'Anda login sebagai User. Anda dapat mengakses layanan pelayanan desa yang tersedia.';
  }
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

      // Update stat
      document.getElementById('statUsers').textContent = data.users.length;

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
