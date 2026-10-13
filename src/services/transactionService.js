const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { formatPaiseToRupees } = require('../utils/formatters');

class TransactionService {
  async getAccountTransactions({ userAccount, page = 1, limit = 10, type, status, startDate, endDate }) {
    const db = getDb();
    const accountId = new ObjectId(userAccount._id);

    const matchQuery = {
      $or: [{ senderAccountId: accountId }, { recipientAccountId: accountId }],
    };

    // Filter by Status
    if (status && status !== 'all') {
      matchQuery.status = status;
    }

    // Filter by Date
    if (startDate || endDate) {
      matchQuery.initiatedAt = {};
      if (startDate) {
        matchQuery.initiatedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchQuery.initiatedAt.$lte = end;
      }
    }

    // Filter by Type (Credit vs Debit)
    if (type === 'debit') {
      matchQuery.senderAccountId = accountId;
      delete matchQuery.$or;
    } else if (type === 'credit') {
      matchQuery.recipientAccountId = accountId;
      delete matchQuery.$or;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await db.collection('transfers').countDocuments(matchQuery);

    const transfers = await db
      .collection('transfers')
      .aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'accounts',
            localField: 'senderAccountId',
            foreignField: '_id',
            as: 'senderAccount',
          },
        },
        { $unwind: { path: '$senderAccount', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'senderAccount.userId',
            foreignField: '_id',
            as: 'senderUser',
          },
        },
        { $unwind: { path: '$senderUser', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'accounts',
            localField: 'recipientAccountId',
            foreignField: '_id',
            as: 'recipientAccount',
          },
        },
        { $unwind: { path: '$recipientAccount', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'recipientAccount.userId',
            foreignField: '_id',
            as: 'recipientUser',
          },
        },
        { $unwind: { path: '$recipientUser', preserveNullAndEmptyArrays: true } },
        { $sort: { initiatedAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
      ])
      .toArray();

    const formattedTransactions = transfers.map((tx) => {
      const isDebit = tx.senderAccountId.equals(accountId);
      return {
        id: tx._id.toString(),
        reference: tx.reference,
        type: isDebit ? 'debit' : 'credit',
        amountInPaise: tx.amountInPaise,
        amountFormatted: formatPaiseToRupees(tx.amountInPaise),
        senderAccountNumber: tx.senderAccount ? tx.senderAccount.accountNumber : 'UNKNOWN',
        senderName: tx.senderUser ? tx.senderUser.fullName : 'Bank Customer',
        recipientAccountNumber: tx.recipientAccount ? tx.recipientAccount.accountNumber : 'UNKNOWN',
        recipientName: tx.recipientUser ? tx.recipientUser.fullName : 'Bank Customer',
        description: tx.description || 'Virtual Transfer',
        status: tx.status,
        date: tx.initiatedAt,
        completedAt: tx.completedAt,
        failureReason: tx.failureReason,
      };
    });

    return {
      transactions: formattedTransactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    };
  }
}

module.exports = new TransactionService();
