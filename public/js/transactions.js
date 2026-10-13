document.addEventListener('DOMContentLoaded', async () => {
  const authData = await initAuthGuard();
  if (!authData) return;

  const tbody = document.getElementById('tx-tbody');
  const countIndicator = document.getElementById('tx-count-indicator');
  const paginationInfo = document.getElementById('pagination-info');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');
  const filterForm = document.getElementById('filter-form');
  const filterType = document.getElementById('filter-type');
  const filterStatus = document.getElementById('filter-status');
  const filterStartDate = document.getElementById('filter-start-date');
  const filterEndDate = document.getElementById('filter-end-date');
  const btnReset = document.getElementById('btn-reset-filters');

  let currentPage = 1;
  const pageLimit = 10;
  let totalPages = 1;

  async function loadTransactions() {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-dim); padding: 40px;">Loading records...</td></tr>`;

    try {
      const params = {
        page: currentPage,
        limit: pageLimit,
        type: filterType.value,
        status: filterStatus.value,
        startDate: filterStartDate.value,
        endDate: filterEndDate.value,
      };

      const res = await api.getTransactions(params);
      const { transactions, pagination } = res;

      totalPages = pagination.totalPages;
      currentPage = pagination.page;

      countIndicator.textContent = `Total: ${pagination.total} transaction${pagination.total === 1 ? '' : 's'}`;
      paginationInfo.textContent = `Page ${currentPage} of ${totalPages || 1} (${pagination.total} total items)`;

      btnPrev.disabled = currentPage <= 1;
      btnNext.disabled = currentPage >= totalPages;

      if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align:center; color: var(--text-muted); padding: 50px;">
              <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div class="empty-title">No transactions found</div>
                <div class="empty-desc">No records match the selected filter criteria.</div>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = transactions
        .map((tx) => {
          const isDebit = tx.type === 'debit';
          const formattedDate = new Date(tx.date).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
          const badgeClass =
            tx.status === 'completed' ? 'badge-success' : tx.status === 'pending' ? 'badge-warning' : 'badge-danger';
          const amountClass = isDebit ? 'amount-debit' : 'amount-credit';
          const sign = isDebit ? '-' : '+';

          return `
            <tr>
              <td style="color: var(--text-muted); font-size: 0.82rem; white-space: nowrap;">${formattedDate}</td>
              <td style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--accent-primary); font-weight: 600;">${tx.reference}</td>
              <td style="font-size: 0.85rem;">
                <div>${tx.senderName}</div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim);">${tx.senderAccountNumber}</div>
              </td>
              <td style="font-size: 0.85rem;">
                <div>${tx.recipientName}</div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim);">${tx.recipientAccountNumber}</div>
              </td>
              <td style="font-size: 0.85rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${tx.description || 'Virtual Transfer'}
              </td>
              <td>
                <span class="badge ${isDebit ? 'badge-danger' : 'badge-success'}">
                  ${isDebit ? '⬆️ Debit' : '⬇️ Credit'}
                </span>
              </td>
              <td class="${amountClass}">${sign}${tx.amountFormatted}</td>
              <td>
                <span class="badge ${badgeClass}">${tx.status}</span>
                ${tx.failureReason ? `<div style="font-size: 0.72rem; color: var(--danger); margin-top: 2px;">${tx.failureReason}</div>` : ''}
              </td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--danger); padding: 30px;">Failed to load transactions: ${err.message}</td></tr>`;
      api.showToast(err.message, 'danger');
    }
  }

  filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    currentPage = 1;
    loadTransactions();
  });

  btnReset.addEventListener('click', () => {
    filterType.value = 'all';
    filterStatus.value = 'all';
    filterStartDate.value = '';
    filterEndDate.value = '';
    currentPage = 1;
    loadTransactions();
  });

  btnPrev.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadTransactions();
    }
  });

  btnNext.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadTransactions();
    }
  });

  await loadTransactions();
});
