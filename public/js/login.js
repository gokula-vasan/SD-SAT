document.addEventListener('DOMContentLoaded', async () => {
  // If already authenticated, redirect
  await initAuthGuard({ isPublic: true });

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const alertEl = document.getElementById('login-alert');
  const submitBtn = document.getElementById('btn-login-submit');

  // Demo 1-click autofill handlers
  document.getElementById('demo-user-1').addEventListener('click', () => {
    emailInput.value = 'alex@bank.com';
    passwordInput.value = 'Password123!';
  });

  document.getElementById('demo-user-2').addEventListener('click', () => {
    emailInput.value = 'priya@bank.com';
    passwordInput.value = 'Password123!';
  });

  document.getElementById('demo-admin').addEventListener('click', () => {
    emailInput.value = 'admin@bank.com';
    passwordInput.value = 'AdminPassword123!';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertEl.style.display = 'none';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showAlert('Please enter both email and password.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating...';

    try {
      const res = await api.login(email, password);
      api.setToken(res.data.token);
      api.setStoredUser(res.data.user);

      api.showToast(`Welcome back, ${res.data.user.fullName}!`, 'success');

      setTimeout(() => {
        if (res.data.user.role === 'admin') {
          window.location.href = '/admin.html';
        } else {
          window.location.href = '/dashboard.html';
        }
      }, 500);
    } catch (err) {
      showAlert(err.message || 'Login failed. Please check your credentials.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });

  function showAlert(msg) {
    alertEl.textContent = msg;
    alertEl.style.display = 'flex';
  }
});
