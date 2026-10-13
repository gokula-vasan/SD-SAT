document.addEventListener('DOMContentLoaded', async () => {
  const authData = await initAuthGuard();
  if (!authData) return;

  const senderAccEl = document.getElementById('sender-acc-num');
  const senderBalanceEl = document.getElementById('sender-balance');
  const beneficiarySelect = document.getElementById('beneficiary-select');
  const recipientInput = document.getElementById('recipient-account');
  const amountInput = document.getElementById('transfer-amount');
  const descInput = document.getElementById('transfer-desc');
  const idempInput = document.getElementById('idempotency-key');
  const alertEl = document.getElementById('transfer-alert');
  const successEl = document.getElementById('transfer-success');

  // Modal elements
  const modal = document.getElementById('confirm-modal');
  const modalRecipientAcc = document.getElementById('modal-recipient-acc');
  const modalAmount = document.getElementById('modal-amount');
  const modalDesc = document.getElementById('modal-desc');
  const modalIdemp = document.getElementById('modal-idemp');
  const btnReview = document.getElementById('btn-review-transfer');
  const btnClose = document.getElementById('modal-close-btn');
  const btnCancel = document.getElementById('modal-cancel-btn');
  const btnConfirm = document.getElementById('modal-confirm-btn');
  const btnRefreshIdemp = document.getElementById('btn-refresh-idemp');

  let currentBalanceInPaise = 0;

  // Initialize idempotency key
  generateNewIdempotencyKey();

  btnRefreshIdemp.addEventListener('click', () => {
    generateNewIdempotencyKey();
    api.showToast('Generated fresh idempotency key.', 'info');
  });

  function generateNewIdempotencyKey() {
    idempInput.value = api.generateIdempotencyKey();
  }

  // Load Sender Account Balance
  async function refreshAccountInfo() {
    try {
      const res = await api.getBalance();
      senderAccEl.textContent = res.data.accountNumber;
      senderBalanceEl.textContent = res.data.balanceFormatted;
      currentBalanceInPaise = res.data.balanceInPaise;
    } catch (err) {
      api.showToast('Could not load account balance: ' + err.message, 'danger');
    }
  }

  await refreshAccountInfo();

  // Load Beneficiaries for Dropdown
  async function loadBeneficiaries() {
    try {
      const res = await api.getBeneficiaries();
      if (res.data && res.data.length > 0) {
        res.data.forEach((b) => {
          const opt = document.createElement('option');
          opt.value = b.accountNumber;
          opt.textContent = `${b.displayName} (${b.accountNumber})`;
          beneficiarySelect.appendChild(opt);
        });
      }
    } catch (e) {
      // Ignore
    }
  }

  await loadBeneficiaries();

  // If query parameter has recipient (e.g. from beneficiaries page)
  const urlParams = new URLSearchParams(window.location.search);
  const prefillAccount = urlParams.get('to');
  if (prefillAccount) {
    recipientInput.value = prefillAccount.trim();
  }

  beneficiarySelect.addEventListener('change', () => {
    if (beneficiarySelect.value) {
      recipientInput.value = beneficiarySelect.value;
    }
  });

  // Review & Confirm Click
  btnReview.addEventListener('click', () => {
    alertEl.style.display = 'none';
    successEl.style.display = 'none';

    const recipient = recipientInput.value.trim().toUpperCase();
    const amountVal = parseFloat(amountInput.value);
    const desc = descInput.value.trim();

    if (!recipient) {
      showError('Please specify the recipient account number.');
      recipientInput.focus();
      return;
    }

    if (recipient === senderAccEl.textContent.trim().toUpperCase()) {
      showError('You cannot transfer money to your own account.');
      recipientInput.focus();
      return;
    }

    if (isNaN(amountVal) || amountVal <= 0) {
      showError('Please enter a valid positive transfer amount.');
      amountInput.focus();
      return;
    }

    const amountInPaise = Math.round(amountVal * 100);
    if (amountInPaise > currentBalanceInPaise) {
      showError(`Insufficient funds. Your available balance is ${senderBalanceEl.textContent}.`);
      return;
    }

    // Populate modal
    modalRecipientAcc.textContent = recipient;
    modalAmount.textContent = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amountVal);
    modalDesc.textContent = desc || 'None';
    modalIdemp.textContent = idempInput.value;

    modal.classList.add('active');
  });

  function closeModal() {
    modal.classList.remove('active');
  }

  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);

  // Execute Transfer on Modal Confirm
  btnConfirm.addEventListener('click', async () => {
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Processing Transfer...';

    const recipient = recipientInput.value.trim().toUpperCase();
    const amount = amountInput.value.trim();
    const description = descInput.value.trim();
    const idempotencyKey = idempInput.value.trim();

    try {
      const res = await api.createTransfer({
        recipientAccountNumber: recipient,
        amount,
        description,
        idempotencyKey,
      });

      closeModal();
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Confirm & Execute Transfer';

      // Clear input fields and refresh idempotency key
      recipientInput.value = '';
      amountInput.value = '';
      descInput.value = '';
      beneficiarySelect.value = '';
      generateNewIdempotencyKey();

      // Show success alert
      const ref = res.data.transfer ? res.data.transfer.reference : 'TXN-OK';
      successEl.innerHTML = `
        <strong>🎉 Transfer Successful!</strong><br>
        Reference Code: <code>${ref}</code><br>
        ${res.message || 'Funds successfully debited and credited atomically.'}
      `;
      successEl.style.display = 'block';

      api.showToast(`Transfer completed! Ref: ${ref}`, 'success');

      // Refresh balances live
      await refreshAccountInfo();
      updateNotificationBadge();
    } catch (err) {
      closeModal();
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Confirm & Execute Transfer';
      showError(err.message || 'Transfer failed. Transaction rolled back safely.');
    }
  });

  function showError(msg) {
    alertEl.textContent = msg;
    alertEl.style.display = 'flex';
  }
});
