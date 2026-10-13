const { ObjectId } = require('mongodb');
const accountRepository = require('../repositories/accountRepository');
const transferRepository = require('../repositories/transferRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const { formatPaiseToRupees } = require('../utils/formatters');

class AccountService {
  async getAccountByUserId(userId) {
    const account = await accountRepository.findByUserId(userId);
    if (!account) {
      const error = new Error('No bank account found for this user.');
      error.statusCode = 404;
      error.isOperational = true;
      throw error;
    }
    return {
      id: account._id.toString(),
      accountNumber: account.accountNumber,
      balanceInPaise: account.balanceInPaise,
      balanceFormatted: formatPaiseToRupees(account.balanceInPaise),
      currency: account.currency,
      status: account.status,
      createdAt: account.createdAt,
    };
  }

  async getAccountBalance(userId) {
    const account = await this.getAccountByUserId(userId);
    return {
      accountNumber: account.accountNumber,
      balanceInPaise: account.balanceInPaise,
      balanceFormatted: account.balanceFormatted,
      currency: account.currency,
      status: account.status,
    };
  }

  async getDashboardSummary(userId) {
    const account = await accountRepository.findByUserId(userId);
    if (!account) {
      const error = new Error('Bank account not found');
      error.statusCode = 404;
      error.isOperational = true;
      throw error;
    }

    // Retrieve ledger entries to compute total credits & debits
    const ledgerEntries = await ledgerRepository.findByAccountId(account._id, { limit: 500 });
    let totalCreditsInPaise = 0;
    let totalDebitsInPaise = 0;

    for (const entry of ledgerEntries) {
      if (entry.entryType === 'credit') {
        totalCreditsInPaise += entry.amountInPaise;
      } else if (entry.entryType === 'debit') {
        totalDebitsInPaise += entry.amountInPaise;
      }
    }

    // Recent 5 transfers
    const recentTransfers = await transferRepository.findAccountTransfers(account._id, { limit: 5 });
    const formattedRecentTransfers = recentTransfers.map((t) => {
      const isDebit = t.senderAccountId.equals(account._id);
      return {
        id: t._id.toString(),
        reference: t.reference,
        amountInPaise: t.amountInPaise,
        amountFormatted: formatPaiseToRupees(t.amountInPaise),
        type: isDebit ? 'debit' : 'credit',
        status: t.status,
        description: t.description || 'Virtual Transfer',
        date: t.initiatedAt,
      };
    });

    return {
      account: {
        id: account._id.toString(),
        accountNumber: account.accountNumber,
        balanceInPaise: account.balanceInPaise,
        balanceFormatted: formatPaiseToRupees(account.balanceInPaise),
        currency: account.currency,
        status: account.status,
      },
      stats: {
        totalCreditsInPaise,
        totalCreditsFormatted: formatPaiseToRupees(totalCreditsInPaise),
        totalDebitsInPaise,
        totalDebitsFormatted: formatPaiseToRupees(totalDebitsInPaise),
      },
      recentTransfers: formattedRecentTransfers,
    };
  }
}

module.exports = new AccountService();
