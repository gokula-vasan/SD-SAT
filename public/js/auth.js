/**
 * Auth Guard and Navigation Initializer
 */

async function initAuthGuard(options = { requireAdmin: false, isPublic: false }) {
  const token = api.getToken();

  if (options.isPublic) {
    if (token) {
      try {
        const res = await api.getMe();
        if (res.data && res.data.user) {
          api.setStoredUser(res.data.user);
          if (res.data.user.role === 'admin') {
            window.location.href = '/admin.html';
          } else {
            window.location.href = '/dashboard.html';
          }
          return;
        }
      } catch (e) {
        api.removeToken();
      }
    }
    return;
  }

  // Protected page
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  try {
    const res = await api.getMe();
    const user = res.data.user;
    const account = res.data.account;

    api.setStoredUser(user);

    if (options.requireAdmin && user.role !== 'admin') {
      api.showToast('Access denied: Administrator privileges required.', 'danger');
      window.location.href = '/dashboard.html';
      return;
    }

    // Populate user profile info in DOM
    const userNameEls = document.querySelectorAll('.user-display-name');
    userNameEls.forEach((el) => (el.textContent = user.fullName));

    const userEmailEls = document.querySelectorAll('.user-display-email');
    userEmailEls.forEach((el) => (el.textContent = user.email));

    const userRoleEls = document.querySelectorAll('.user-display-role');
    userRoleEls.forEach((el) => (el.textContent = user.role));

    const userAvatarEls = document.querySelectorAll('.user-avatar-initials');
    const initials = user.fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    userAvatarEls.forEach((el) => (el.textContent = initials));

    if (account) {
      const accNumEls = document.querySelectorAll('.user-display-account');
      accNumEls.forEach((el) => (el.textContent = account.accountNumber));
    }

    // Fetch notifications to show badge
    updateNotificationBadge();

    // Hook up logout buttons
    document.querySelectorAll('.btn-logout-action').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        api.logout();
      });
    });

    return { user, account };
  } catch (err) {
    api.removeToken();
    window.location.href = '/login.html';
  }
}

async function updateNotificationBadge() {
  try {
    const res = await api.getNotifications();
    const count = res.unreadCount || 0;
    const badges = document.querySelectorAll('.notif-badge-count');
    badges.forEach((b) => {
      if (count > 0) {
        b.textContent = count;
        b.style.display = 'inline-block';
      } else {
        b.style.display = 'none';
      }
    });
  } catch (e) {
    // Silent ignore
  }
}

// Global mobile sidebar toggle helper
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.querySelector('.mobile-nav-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
});
