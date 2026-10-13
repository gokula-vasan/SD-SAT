const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const userRepository = require('../repositories/userRepository');
const accountRepository = require('../repositories/accountRepository');
const auditRepository = require('../repositories/auditRepository');
const notificationRepository = require('../repositories/notificationRepository');
const { formatPaiseToRupees } = require('../utils/formatters');

class AdminService {
  async getAllUsers() {
    const db = getDb();
    const usersWithAccounts = await db
      .collection('users')
      .aggregate([
        {
          $lookup: {
            from: 'accounts',
            localField: '_id',
            foreignField: 'userId',
            as: 'account',
          },
        },
        { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            id: '$_id',
            fullName: 1,
            email: 1,
            role: 1,
            status: 1,
            createdAt: 1,
            accountNumber: '$account.accountNumber',
            balanceInPaise: '$account.balanceInPaise',
            accountStatus: '$account.status',
          },
        },
        { $sort: { createdAt: -1 } },
      ])
      .toArray();

    return usersWithAccounts.map((u) => ({
      id: u._id.toString(),
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      accountNumber: u.accountNumber || 'N/A',
      accountStatus: u.accountStatus || 'N/A',
      balanceFormatted: u.balanceInPaise !== undefined ? formatPaiseToRupees(u.balanceInPaise) : 'N/A',
      balanceInPaise: u.balanceInPaise || 0,
    }));
  }

  async updateUserStatus(targetUserId, newStatus, adminUser) {
    if (!['active', 'suspended'].includes(newStatus)) {
      const error = new Error('Invalid status. Status must be "active" or "suspended".');
      error.statusCode = 400;
      error.isOperational = true;
      throw error;
    }

    const user = await userRepository.findById(targetUserId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      error.isOperational = true;
      throw error;
    }

    // Prevent suspending another admin
    if (user.role === 'admin' && newStatus === 'suspended') {
      const error = new Error('Administrator accounts cannot be suspended.');
      error.statusCode = 403;
      error.isOperational = true;
      throw error;
    }

    await userRepository.updateStatus(user._id, newStatus);

    // Also update user's account status
    const account = await accountRepository.findByUserId(user._id);
    if (account) {
      await accountRepository.updateStatus(account._id, newStatus);
    }

    // Notification for user
    await notificationRepository.create({
      userId: user._id,
      type: 'ACCOUNT_STATUS_CHANGE',
      message: `Your account status has been changed to "${newStatus}" by administrator.`,
    });

    // Audit log
    await auditRepository.log({
      actorUserId: adminUser._id,
      action: 'USER_STATUS_UPDATED',
      entityType: 'user',
      entityId: user._id,
      metadata: {
        previousStatus: user.status,
        newStatus,
        targetEmail: user.email,
      },
    });

    return {
      success: true,
      message: `User ${user.email} status updated to "${newStatus}".`,
    };
  }

  async getAllTransfers(page = 1, limit = 20) {
    const db = getDb();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await db.collection('transfers').countDocuments();

    const transfers = await db
      .collection('transfers')
      .aggregate([
        {
          $lookup: {
            from: 'accounts',
            localField: 'senderAccountId',
            foreignField: '_id',
            as: 'senderAcc',
          },
        },
        { $unwind: { path: '$senderAcc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'accounts',
            localField: 'recipientAccountId',
            foreignField: '_id',
            as: 'recipientAcc',
          },
        },
        { $unwind: { path: '$recipientAcc', preserveNullAndEmptyArrays: true } },
        { $sort: { initiatedAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
      ])
      .toArray();

    return {
      transfers: transfers.map((t) => ({
        id: t._id.toString(),
        reference: t.reference,
        senderAccountNumber: t.senderAcc ? t.senderAcc.accountNumber : 'UNKNOWN',
        recipientAccountNumber: t.recipientAcc ? t.recipientAcc.accountNumber : 'UNKNOWN',
        amountInPaise: t.amountInPaise,
        amountFormatted: formatPaiseToRupees(t.amountInPaise),
        status: t.status,
        description: t.description,
        initiatedAt: t.initiatedAt,
        completedAt: t.completedAt,
        failureReason: t.failureReason,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    };
  }

  async getAuditLogs(page = 1, limit = 50) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const logs = await auditRepository.findAll({}, { limit: limitNum, skip });
    const totalCount = await auditRepository.count({});

    return {
      auditLogs: logs.map((l) => ({
        id: l._id.toString(),
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        actorName: l.actorName || 'System',
        actorEmail: l.actorEmail || 'system@bank.internal',
        metadata: l.metadata,
        createdAt: l.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    };
  }
}

module.exports = new AdminService();
