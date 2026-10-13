const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

class LedgerRepository {
  get collection() {
    return getDb().collection('ledger_entries');
  }

  async createEntries(entries, session) {
    const formatted = entries.map((entry) => ({
      transferId: new ObjectId(entry.transferId),
      accountId: new ObjectId(entry.accountId),
      entryType: entry.entryType, // 'debit' | 'credit'
      amountInPaise: parseInt(entry.amountInPaise, 10),
      createdAt: new Date(),
    }));
    return this.collection.insertMany(formatted, { session });
  }

  async findByAccountId(accountId, options = {}) {
    if (!ObjectId.isValid(accountId)) return [];
    const filter = { accountId: new ObjectId(accountId) };
    const limit = options.limit || 50;
    const skip = options.skip || 0;
    return this.collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async findByTransferId(transferId) {
    if (!ObjectId.isValid(transferId)) return [];
    return this.collection.find({ transferId: new ObjectId(transferId) }).toArray();
  }
}

module.exports = new LedgerRepository();
