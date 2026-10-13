document.addEventListener('DOMContentLoaded', async () => {
  const authData = await initAuthGuard();
  if (!authData) return;

  const notifList = document.getElementById('notifications-list');
  const badge = document.getElementById('unread-status-badge');
  const btnMarkAll = document.getElementById('btn-mark-all-read');

  async function loadNotifications() {
    try {
      const res = await api.getNotifications();
      const list = res.data || [];
      const unreadCount = res.unreadCount || 0;

      if (unreadCount > 0) {
        badge.className = 'badge badge-warning';
        badge.textContent = `${unreadCount} unread`;
      } else {
        badge.className = 'badge badge-success';
        badge.textContent = 'All caught up';
      }

      updateNotificationBadge();

      if (list.length === 0) {
        notifList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔔</div>
            <div class="empty-title">No notifications</div>
            <div class="empty-desc">You will receive alerts here when money is transferred or received.</div>
          </div>
        `;
        return;
      }

      notifList.innerHTML = list
        .map((n) => {
          let icon = 'ℹ️';
          let borderHighlight = 'rgba(255, 255, 255, 0.08)';
          if (n.type === 'TRANSFER_RECEIVED') {
            icon = '💰';
            borderHighlight = 'rgba(16, 185, 129, 0.3)';
          } else if (n.type === 'TRANSFER_SENT') {
            icon = '📤';
            borderHighlight = 'rgba(56, 189, 248, 0.3)';
          } else if (n.type === 'TRANSFER_FAILED') {
            icon = '⚠️';
            borderHighlight = 'rgba(239, 68, 68, 0.3)';
          } else if (n.type === 'ACCOUNT_STATUS_CHANGE') {
            icon = '🛡️';
            borderHighlight = 'rgba(245, 158, 11, 0.3)';
          }

          const formattedTime = new Date(n.createdAt).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          });

          return `
            <div style="
              background: ${n.isRead ? 'rgba(15, 23, 42, 0.5)' : 'rgba(30, 41, 59, 0.7)'};
              border: 1px solid ${borderHighlight};
              border-radius: var(--radius-md);
              padding: 16px 20px;
              display: flex;
              align-items: flex-start;
              gap: 16px;
              transition: all var(--transition-fast);
            ">
              <div style="font-size: 24px; line-height: 1;">${icon}</div>
              <div style="flex: 1;">
                <div style="font-size: 0.92rem; color: #fff; font-weight: ${n.isRead ? '500' : '600'};">
                  ${n.message}
                </div>
                <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 6px;">
                  ${formattedTime} &bull; <span style="text-transform: capitalize;">${n.type.toLowerCase().replace(/_/g, ' ')}</span>
                </div>
              </div>
              <div>
                ${
                  !n.isRead
                    ? `<button type="button" class="btn btn-secondary btn-sm btn-mark-read" data-id="${n.id}" title="Mark as Read">✓ Read</button>`
                    : `<span style="font-size: 0.75rem; color: var(--text-dim);">Read</span>`
                }
              </div>
            </div>
          `;
        })
        .join('');

      // Mark single as read handlers
      document.querySelectorAll('.btn-mark-read').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          try {
            await api.markNotificationRead(id);
            loadNotifications();
          } catch (e) {
            api.showToast(e.message, 'danger');
          }
        });
      });
    } catch (err) {
      notifList.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 20px;">Failed to load notifications: ${err.message}</div>`;
    }
  }

  btnMarkAll.addEventListener('click', async () => {
    try {
      await api.markAllNotificationsRead();
      api.showToast('All notifications marked as read.', 'success');
      loadNotifications();
    } catch (e) {
      api.showToast(e.message, 'danger');
    }
  });

  await loadNotifications();
});
