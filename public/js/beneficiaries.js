document.addEventListener('DOMContentLoaded', async () => {
  const authData = await initAuthGuard();
  if (!authData) return;

  const form = document.getElementById('add-beneficiary-form');
  const accInput = document.getElementById('bene-acc');
  const nameInput = document.getElementById('bene-name');
  const alertEl = document.getElementById('bene-alert');
  const successEl = document.getElementById('bene-success');
  const tbody = document.getElementById('bene-tbody');
  const countBadge = document.getElementById('bene-count-badge');
  const submitBtn = document.getElementById('btn-add-bene');

  async function loadBeneficiaries() {
    try {
      const res = await api.getBeneficiaries();
      const list = res.data || [];

      countBadge.textContent = `${list.length} saved`;

      if (list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px;">
              <div class="empty-state">
                <div class="empty-icon">👥</div>
                <div class="empty-title">No beneficiaries saved</div>
                <div class="empty-desc">Add frequent recipient accounts using the form on the left for faster transfers.</div>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = list
        .map((b) => {
          const isAccActive = b.accountStatus === 'active';
          return `
            <tr>
              <td>
                <strong style="color: var(--text-main); font-size: 0.95rem;">${b.displayName}</strong>
              </td>
              <td>
                <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--accent-primary);">${b.accountNumber}</span>
              </td>
              <td style="font-size: 0.85rem; color: var(--text-muted);">${b.ownerName || 'Verified User'}</td>
              <td>
                <span class="badge ${isAccActive ? 'badge-success' : 'badge-danger'}">
                  ${b.accountStatus}
                </span>
              </td>
              <td>
                <div style="display: flex; gap: 8px;">
                  <a href="/transfer.html?to=${encodeURIComponent(b.accountNumber)}" class="btn btn-primary btn-sm" title="Quick Transfer">
                    💸 Send
                  </a>
                  <button type="button" class="btn btn-danger btn-sm btn-delete-bene" data-id="${b._id}" title="Remove Beneficiary">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');

      // Attach delete handlers
      document.querySelectorAll('.btn-delete-bene').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (confirm('Are you sure you want to remove this beneficiary?')) {
            try {
              await api.deleteBeneficiary(id);
              api.showToast('Beneficiary removed.', 'info');
              loadBeneficiaries();
            } catch (err) {
              api.showToast('Failed to delete beneficiary: ' + err.message, 'danger');
            }
          }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 20px;">Error loading beneficiaries: ${err.message}</td></tr>`;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertEl.style.display = 'none';
    successEl.style.display = 'none';

    const accountNumber = accInput.value.trim().toUpperCase();
    const displayName = nameInput.value.trim();

    if (!accountNumber || !displayName) {
      showError('Please provide both account number and display name.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      await api.addBeneficiary(accountNumber, displayName);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Beneficiary';

      accInput.value = '';
      nameInput.value = '';

      successEl.textContent = `Beneficiary "${displayName}" added successfully!`;
      successEl.style.display = 'block';

      api.showToast(`Beneficiary "${displayName}" saved!`, 'success');
      loadBeneficiaries();
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Beneficiary';
      showError(err.message || 'Could not add beneficiary.');
    }
  });

  function showError(msg) {
    alertEl.textContent = msg;
    alertEl.style.display = 'flex';
  }

  await loadBeneficiaries();
});
