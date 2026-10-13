const { verifyToken } = require('../utils/jwt');
const userRepository = require('../repositories/userRepository');
const accountRepository = require('../repositories/accountRepository');

async function authenticate(req, res, next) {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing. Please log in to continue.',
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token. Please log in again.',
      });
    }

    const user = await userRepository.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found. Please log in again.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact bank administration.',
      });
    }

    // Attach user information without passwordHash
    req.user = {
      id: user._id.toString(),
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    // Attach user's bank account if applicable
    const account = await accountRepository.findByUserId(user._id);
    if (account) {
      req.userAccount = {
        id: account._id.toString(),
        _id: account._id,
        accountNumber: account.accountNumber,
        balanceInPaise: account.balanceInPaise,
        currency: account.currency,
        status: account.status,
      };
    }

    next();
  } catch (error) {
    console.error('[AUTH MIDDLEWARE ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication verification.',
    });
  }
}

module.exports = authenticate;
