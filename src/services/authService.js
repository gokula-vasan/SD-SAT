const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const accountRepository = require('../repositories/accountRepository');
const notificationRepository = require('../repositories/notificationRepository');
const auditRepository = require('../repositories/auditRepository');
const { generateToken } = require('../utils/jwt');
const { generateAccountNumber } = require('../utils/formatters');

class AuthService {
  async register({ fullName, email, password, role = 'customer' }) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check existing user
    const existing = await userRepository.findByEmail(normalizedEmail);
    if (existing) {
      const error = new Error('An account with this email address already exists.');
      error.statusCode = 409;
      error.isOperational = true;
      throw error;
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Create user
    const user = await userRepository.create({
      fullName,
      email: normalizedEmail,
      passwordHash,
      role: role === 'admin' ? 'admin' : 'customer',
      status: 'active',
    });

    // 4. Create initial simulated bank account (with ₹10,000.00 = 1,000,000 paise starting balance)
    let accountNumber;
    let isUnique = false;
    while (!isUnique) {
      accountNumber = generateAccountNumber();
      const existingAcc = await accountRepository.findByAccountNumber(accountNumber);
      if (!existingAcc) isUnique = true;
    }

    const account = await accountRepository.create({
      userId: user._id,
      accountNumber,
      balanceInPaise: 1000000, // ₹10,000.00
      currency: 'INR',
      status: 'active',
    });

    // 5. Send welcome notification
    await notificationRepository.create({
      userId: user._id,
      type: 'ACCOUNT_STATUS_CHANGE',
      message: `Welcome to Digital Banking, ${user.fullName}! Your account ${account.accountNumber} is active with simulated ₹10,000.00.`,
    });

    // 6. Audit log
    await auditRepository.log({
      actorUserId: user._id,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: user._id,
      metadata: { email: user.email, role: user.role, accountNumber: account.accountNumber },
    });

    // 7. Generate JWT
    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      account: {
        id: account._id.toString(),
        accountNumber: account.accountNumber,
        balanceInPaise: account.balanceInPaise,
        currency: account.currency,
        status: account.status,
      },
    };
  }

  async login({ email, password }) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await userRepository.findByEmail(normalizedEmail);

    if (!user) {
      await auditRepository.log({
        actorUserId: null,
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityId: null,
        metadata: { email: normalizedEmail, reason: 'User not found' },
      });
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      error.isOperational = true;
      throw error;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await auditRepository.log({
        actorUserId: user._id,
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityId: user._id,
        metadata: { email: normalizedEmail, reason: 'Password mismatch' },
      });
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      error.isOperational = true;
      throw error;
    }

    if (user.status !== 'active') {
      await auditRepository.log({
        actorUserId: user._id,
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityId: user._id,
        metadata: { email: normalizedEmail, reason: 'Account suspended' },
      });
      const error = new Error('Your account is suspended. Please contact customer support.');
      error.statusCode = 403;
      error.isOperational = true;
      throw error;
    }

    // Success audit log
    await auditRepository.log({
      actorUserId: user._id,
      action: 'LOGIN_SUCCESS',
      entityType: 'auth',
      entityId: user._id,
      metadata: { email: user.email, role: user.role },
    });

    const account = await accountRepository.findByUserId(user._id);

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      account: account
        ? {
            id: account._id.toString(),
            accountNumber: account.accountNumber,
            balanceInPaise: account.balanceInPaise,
            currency: account.currency,
            status: account.status,
          }
        : null,
    };
  }

  async getMe(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      error.isOperational = true;
      throw error;
    }

    const account = await accountRepository.findByUserId(user._id);

    return {
      user: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      account: account
        ? {
            id: account._id.toString(),
            accountNumber: account.accountNumber,
            balanceInPaise: account.balanceInPaise,
            currency: account.currency,
            status: account.status,
          }
        : null,
    };
  }
}

module.exports = new AuthService();
