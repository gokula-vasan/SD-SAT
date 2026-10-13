const { parseRupeesToPaise } = require('../utils/formatters');

function validateTransferInput(data, senderAccountNumber) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Invalid transfer request body'] };
  }

  const { recipientAccountNumber, amount, description, idempotencyKey } = data;

  // Recipient Account
  if (typeof recipientAccountNumber !== 'string' || !recipientAccountNumber.trim()) {
    errors.push('Recipient account number is required');
  } else {
    const cleanRecipient = recipientAccountNumber.trim().toUpperCase();
    if (senderAccountNumber && cleanRecipient === senderAccountNumber.trim().toUpperCase()) {
      errors.push('Cannot transfer money to your own account');
    }
  }

  // Amount
  let parsedAmountInPaise = null;
  try {
    parsedAmountInPaise = parseRupeesToPaise(amount);
  } catch (err) {
    errors.push(err.message);
  }

  // Idempotency Key
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    errors.push('Idempotency key is required to prevent duplicate transfers');
  } else if (idempotencyKey.trim().length > 128) {
    errors.push('Idempotency key is too long (max 128 characters)');
  }

  // Description (optional)
  if (description !== undefined && description !== null && typeof description !== 'string') {
    errors.push('Description must be a string');
  } else if (description && description.length > 255) {
    errors.push('Description cannot exceed 255 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    parsedAmountInPaise,
    cleanRecipientAccountNumber: typeof recipientAccountNumber === 'string' ? recipientAccountNumber.trim().toUpperCase() : '',
    cleanDescription: description && typeof description === 'string' ? description.trim() : '',
    cleanIdempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '',
  };
}

module.exports = {
  validateTransferInput,
};
