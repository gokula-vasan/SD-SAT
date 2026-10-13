/**
 * Authentication input validators
 */

function validateRegisterInput(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Invalid request payload'] };
  }

  const { fullName, email, password } = data;

  if (typeof fullName !== 'string' || !fullName.trim()) {
    errors.push('Full name is required and must be a valid string');
  } else if (fullName.trim().length < 2 || fullName.trim().length > 100) {
    errors.push('Full name must be between 2 and 100 characters');
  }

  if (typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim().toLowerCase())) {
      errors.push('Invalid email address format');
    }
  }

  if (typeof password !== 'string' || !password) {
    errors.push('Password is required');
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function validateLoginInput(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Invalid request payload'] };
  }

  const { email, password } = data;

  if (typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required');
  }

  if (typeof password !== 'string' || !password) {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateRegisterInput,
  validateLoginInput,
};
