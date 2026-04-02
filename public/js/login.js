// ============================================================
// LOGIN PAGE LOGIC
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('passwordToggle');
  const eyeOpen = document.getElementById('eyeOpen');
  const eyeClosed = document.getElementById('eyeClosed');
  const btnLogin = document.getElementById('btnLogin');

  // Check if already logged in
  checkExistingSession();

  // ── Password Toggle (Eye Icon) ──
  passwordToggle.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    eyeOpen.style.display = isPassword ? 'none' : 'block';
    eyeClosed.style.display = isPassword ? 'block' : 'none';
  });

  // ── Form Submit ──
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = passwordInput.value.trim();

    // Validation
    if (!username) {
      showToast('Username tidak boleh kosong.', 'error');
      return;
    }
    if (!password) {
      showToast('Password tidak boleh kosong.', 'error');
      return;
    }

    // Show loading state
    btnLogin.classList.add('loading');
    btnLogin.disabled = true;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        showToast(data.message, 'success');
        // Redirect to dashboard after short delay
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 1000);
      } else {
        showToast(data.message, 'error');
        btnLogin.classList.remove('loading');
        btnLogin.disabled = false;
      }
    } catch (error) {
      showToast('Terjadi kesalahan koneksi ke server.', 'error');
      btnLogin.classList.remove('loading');
      btnLogin.disabled = false;
    }
  });
});

// ── Check Existing Session ──
async function checkExistingSession() {
  try {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (data.loggedIn) {
      window.location.href = '/dashboard.html';
    }
  } catch (e) {
    // Server might not be running, ignore
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

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
