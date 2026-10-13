document.addEventListener('DOMContentLoaded', async () => {
  await initAuthGuard({ isPublic: true });

  const form = document.getElementById('register-form');
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const alertEl = document.getElementById('register-alert');
  const submitBtn = document.getElementById('btn-register-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertEl.style.display = 'none';

    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!fullName || !email || !password) {
      showAlert('All fields are required.');
      return;
    }

    if (password.length < 8) {
      showAlert('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Passwords do not match. Please re-enter.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    try {
      const res = await api.register(fullName, email, password);
      api.setToken(res.data.token);
      api.setStoredUser(res.data.user);

      api.showToast('Registration successful! Welcome to NovaBank.', 'success');

      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 500);
    } catch (err) {
      showAlert(err.message || 'Registration failed. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create My Account';
    }
  });

  function showAlert(msg) {
    alertEl.textContent = msg;
    alertEl.style.display = 'flex';
  }
});
