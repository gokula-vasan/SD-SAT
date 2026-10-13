const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_digital_banking_system_2026_secure';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || 'never';

function generateToken(payload) {
  const options = {};
  // If set to 'never', 'permanent', or false, token will not contain an exp claim and will never expire
  if (
    JWT_EXPIRES_IN &&
    JWT_EXPIRES_IN !== 'never' &&
    JWT_EXPIRES_IN !== 'permanent' &&
    JWT_EXPIRES_IN !== 'none'
  ) {
    options.expiresIn = JWT_EXPIRES_IN;
  }
  return jwt.sign(payload, JWT_SECRET, options);
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  generateToken,
  verifyToken,
};
