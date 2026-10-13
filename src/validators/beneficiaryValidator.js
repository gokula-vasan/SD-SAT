function validateBeneficiaryInput(data, userAccountNumber) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Invalid beneficiary request body'] };
  }

  const { accountNumber, displayName } = data;

  if (typeof accountNumber !== 'string' || !accountNumber.trim()) {
    errors.push('Account number is required');
  } else {
    const cleanAcc = accountNumber.trim().toUpperCase();
    if (userAccountNumber && cleanAcc === userAccountNumber.trim().toUpperCase()) {
      errors.push('You cannot add your own account as a beneficiary');
    }
  }

  if (typeof displayName !== 'string' || !displayName.trim()) {
    errors.push('Display name is required');
  } else if (displayName.trim().length < 2 || displayName.trim().length > 60) {
    errors.push('Display name must be between 2 and 60 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    cleanAccountNumber: typeof accountNumber === 'string' ? accountNumber.trim().toUpperCase() : '',
    cleanDisplayName: typeof displayName === 'string' ? displayName.trim() : '',
  };
}

module.exports = {
  validateBeneficiaryInput,
};
