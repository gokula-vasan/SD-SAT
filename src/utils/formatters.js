/**
 * Utility functions for currency conversions, references, and validation
 */

/**
 * Convert rupee string/number to integer paise (minor units)
 * Validates that amount is positive, has at most 2 decimal places, and does not exceed limit
 */
function parseRupeesToPaise(amount) {
  if (amount === undefined || amount === null || amount === '') {
    throw new Error('Transfer amount is required');
  }

  const str = String(amount).trim();
  // Match positive numbers with optional up to 2 decimal places (e.g. 100, 100.5, 100.50)
  const amountRegex = /^[0-9]+(\.[0-9]{1,2})?$/;
  if (!amountRegex.test(str)) {
    throw new Error('Invalid amount format. Must be a positive number with at most 2 decimal places');
  }

  const [rupeesPart, paisePart = ''] = str.split('.');
  const paddedPaise = (paisePart + '00').substring(0, 2);

  const paise = parseInt(rupeesPart, 10) * 100 + parseInt(paddedPaise, 10);

  if (isNaN(paise) || paise <= 0) {
    throw new Error('Transfer amount must be greater than zero');
  }

  // Cap at 10,00,000 INR (10 lakh rupees = 100,000,000 paise) for simulated safety
  if (paise > 100000000) {
    throw new Error('Transfer amount exceeds the maximum allowed limit of ₹10,00,000.00');
  }

  return paise;
}

/**
 * Format integer paise to display string: e.g. 500000 -> "₹5,000.00"
 */
function formatPaiseToRupees(paise) {
  if (typeof paise !== 'number' || isNaN(paise)) {
    paise = 0;
  }
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Generate a random 10-digit simulated bank account number
 */
function generateAccountNumber() {
  const prefix = 'ACC';
  const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
  return `${prefix}-${randomDigits}`;
}

/**
 * Generate a unique transaction reference code: TXN-YYYYMMDD-HEX
 */
function generateTransferReference() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timePart = Date.now().toString(36).slice(-4).toUpperCase();
  return `TXN-${dateStr}-${randomHex}${timePart}`;
}

module.exports = {
  parseRupeesToPaise,
  formatPaiseToRupees,
  generateAccountNumber,
  generateTransferReference,
};
