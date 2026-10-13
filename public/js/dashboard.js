document.addEventListener('DOMContentLoaded', async () => {
  const authData = await initAuthGuard();
  if (!authData) return;

  const balanceEl = document.getElementById('dashboard-balance');
  const accountNumEl = document.getElementById('dashboard-account-number');
  const creditsEl = document.getElementById('dashboard-total-credits');
  const debitsEl = document.getElementById('dashboard-total-debits');
  const tbodyEl = document.getElementById('dashboard-recent-tx-tbody');

  try {
    const res = await api.getDashboard();
    const { account, stats, recentTransfers } = res.data;

    balanceEl.textContent = account.balanceFormatted;
    accountNumEl.textContent = account.accountNumber;
    creditsEl.textContent = stats.totalCreditsFormatted;
    debitsEl.textContent = stats.totalDebitsFormatted;

    if (!recentTransfers || recentTransfers.length === 0) {
      tbodyEl.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">
            No transactions found yet. Initiate your first transfer to see activity!
          </td>
        </tr>
      `;
      return;
    }

    tbodyEl.innerHTML = recentTransfers
      .map((tx) => {
        const isDebit = tx.type === 'debit';
        const formattedDate = new Date(tx.date).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        const badgeClass = tx.status === 'completed' ? 'badge-success' : tx.status === 'pending' ? 'badge-warning' : 'badge-danger';
        const amountClass = isDebit ? 'amount-debit' : 'amount-credit';
        const sign = isDebit ? '-' : '+';

        return `
          <tr>
            <td style="color: var(--text-muted); font-size: 0.85rem;">${formattedDate}</td>
            <td style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--accent-primary);">${tx.reference}</td>
            <td>${tx.description || 'Virtual Transfer'}</td>
            <td>
              <span class="badge ${isDebit ? 'badge-danger' : 'badge-success'}">
                ${isDebit ? '⬆️ Debit' : '⬇️ Credit'}
              </span>
            </td>
            <td class="${amountClass}">${sign}${tx.amountFormatted}</td>
            <td><span class="badge ${badgeClass}">${tx.status}</span></td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    api.showToast('Failed to load dashboard data: ' + err.message, 'danger');
  }
});
