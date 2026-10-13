document.addEventListener('DOMContentLoaded', async () => {
  const authData = await initAuthGuard({ requireAdmin: true });
  if (!authData) return;

  const usersTbody = document.getElementById('admin-users-tbody');
  const transfersTbody = document.getElementById('admin-transfers-tbody');
  const auditTbody = document.getElementById('admin-audit-tbody');

  // Tab switching
  const tabButtons = document.querySelectorAll('.admin-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const target = btn.getAttribute('data-tab');
      document.getElementById(target).classList.add('active');

      if (target === 'tab-users') loadUsers();
      if (target === 'tab-transfers') loadTransfers();
      if (target === 'tab-audit') loadAuditLogs();
    });
  });

  // Tab 1: Users & Moderation
  async function loadUsers() {
    usersTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 30px;">Loading users...</td></tr>`;
    try {
      const res = await api.getAdminUsers();
      const users = res.data || [];

      if (users.length === 0) {
        usersTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No users found.</td></tr>`;
        return;
      }

      usersTbody.innerHTML = users
        .map((u) => {
          const isActive = u.status === 'active';
          const isAdmin = u.role === 'admin';

          return `
            <tr>
              <td><strong style="color: #fff;">${u.fullName}</strong></td>
              <td style="color: var(--text-muted); font-size: 0.85rem;">${u.email}</td>
              <td style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--accent-primary);">${u.accountNumber}</td>
              <td style="font-family: var(--font-mono); font-weight: 700; color: #fff;">${u.balanceFormatted}</td>
              <td><span class="badge ${isAdmin ? 'badge-warning' : 'badge-info'}">${u.role}</span></td>
              <td><span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">${u.status}</span></td>
              <td>
                ${
                  isAdmin
                    ? `<span style="font-size: 0.78rem; color: var(--text-dim);">Protected Admin</span>`
                    : `<button class="btn btn-sm ${isActive ? 'btn-danger' : 'btn-secondary'} btn-toggle-status" data-id="${u.id}" data-status="${isActive ? 'suspended' : 'active'}">
                        ${isActive ? '⛔ Suspend' : '✅ Reactivate'}
                       </button>`
                }
              </td>
            </tr>
          `;
        })
        .join('');

      document.querySelectorAll('.btn-toggle-status').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const userId = btn.getAttribute('data-id');
          const newStatus = btn.getAttribute('data-status');
          const confirmMsg = `Are you sure you want to change this user status to "${newStatus}"?`;

          if (confirm(confirmMsg)) {
            try {
              btn.disabled = true;
              btn.textContent = 'Updating...';
              await api.updateAdminUserStatus(userId, newStatus);
              api.showToast(`User status updated to ${newStatus}.`, 'success');
              loadUsers();
            } catch (err) {
              api.showToast('Failed to update status: ' + err.message, 'danger');
              loadUsers();
            }
          }
        });
      });
    } catch (err) {
      usersTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 20px;">Error: ${err.message}</td></tr>`;
    }
  }

  // Tab 2: System Transfers
  async function loadTransfers() {
    transfersTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 30px;">Loading system transfers...</td></tr>`;
    try {
      const res = await api.getAdminTransfers(1, 50);
      const transfers = res.data || [];

      if (transfers.length === 0) {
        transfersTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No transfers found in system.</td></tr>`;
        return;
      }

      transfersTbody.innerHTML = transfers
        .map((t) => {
          const dateStr = new Date(t.initiatedAt).toLocaleString('en-IN', {
            dateStyle: 'short',
            timeStyle: 'short',
          });
          const badgeClass =
            t.status === 'completed' ? 'badge-success' : t.status === 'pending' ? 'badge-warning' : 'badge-danger';

          return `
            <tr>
              <td style="color: var(--text-muted); font-size: 0.82rem; white-space: nowrap;">${dateStr}</td>
              <td style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--accent-primary); font-weight: 600;">${t.reference}</td>
              <td style="font-family: var(--font-mono); font-size: 0.82rem;">${t.senderAccountNumber}</td>
              <td style="font-family: var(--font-mono); font-size: 0.82rem;">${t.recipientAccountNumber}</td>
              <td style="font-weight: 700; font-family: var(--font-mono); color: #fff;">${t.amountFormatted}</td>
              <td><span class="badge ${badgeClass}">${t.status}</span></td>
              <td style="font-size: 0.85rem; color: var(--text-muted);">${t.description || 'Virtual Transfer'}</td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      transfersTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 20px;">Error: ${err.message}</td></tr>`;
    }
  }

  // Tab 3: Security Audit Logs
  async function loadAuditLogs() {
    auditTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 30px;">Loading audit trail...</td></tr>`;
    try {
      const res = await api.getAdminAuditLogs(1, 50);
      const logs = res.data || [];

      if (logs.length === 0) {
        auditTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">No audit records found.</td></tr>`;
        return;
      }

      auditTbody.innerHTML = logs
        .map((l) => {
          const dateStr = new Date(l.createdAt).toLocaleString('en-IN', {
            dateStyle: 'short',
            timeStyle: 'medium',
          });
          const metaStr = l.metadata ? JSON.stringify(l.metadata) : '{}';

          let actionBadge = 'badge-info';
          if (l.action.includes('SUCCESS') || l.action.includes('COMPLETED')) actionBadge = 'badge-success';
          if (l.action.includes('FAILED')) actionBadge = 'badge-danger';
          if (l.action.includes('UPDATED')) actionBadge = 'badge-warning';

          return `
            <tr>
              <td style="color: var(--text-muted); font-size: 0.82rem; white-space: nowrap;">${dateStr}</td>
              <td style="font-size: 0.85rem;">
                <div><strong>${l.actorName}</strong></div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">${l.actorEmail}</div>
              </td>
              <td><span class="badge ${actionBadge}">${l.action}</span></td>
              <td style="font-size: 0.82rem; text-transform: uppercase; color: var(--text-muted);">${l.entityType}</td>
              <td style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-dim); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${metaStr}
              </td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      auditTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 20px;">Error: ${err.message}</td></tr>`;
    }
  }

  // Refresh buttons
  document.getElementById('btn-refresh-users').addEventListener('click', loadUsers);
  document.getElementById('btn-refresh-transfers').addEventListener('click', loadTransfers);
  document.getElementById('btn-refresh-audit').addEventListener('click', loadAuditLogs);

  // Initial load
  await loadUsers();
});
