const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

class AccountRepository {
  get collection() {
    return getDb().collection('accounts');
  }

  async findById(id, options = {}) {
    if (!ObjectId.isValid(id)) return null;
    return this.collection.findOne({ _id: new ObjectId(id) }, options);
  }

  async findByUserId(userId, options = {}) {
    if (!ObjectId.isValid(userId)) return null;
    return this.collection.findOne({ userId: new ObjectId(userId) }, options);
  }

  async findByAccountNumber(accountNumber, options = {}) {
    if (!accountNumber) return null;
    return this.collection.findOne({ accountNumber: accountNumber.trim().toUpperCase() }, options);
  }

  async create(accountData, options = {}) {
    const account = {
      userId: new ObjectId(accountData.userId),
      accountNumber: accountData.accountNumber.trim().toUpperCase(),
      balanceInPaise: parseInt(accountData.balanceInPaise, 10) || 0,
      currency: accountData.currency || 'INR',
      status: accountData.status || 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await this.collection.insertOne(account, options);
    return { ...account, _id: result.insertedId };
  }

  /**
   * Atomic conditional debit
   * Guarantees sender has sufficient balance and account is active
   */
  async debitConditional(accountId, amountInPaise, session) {
    const filter = {
      _id: new ObjectId(accountId),
      status: 'active',
      balanceInPaise: { $gte: amountInPaise },
    };
    const update = {
      $inc: { balanceInPaise: -amountInPaise },
      $set: { updatedAt: new Date() },
    };
    return this.collection.findOneAndUpdate(filter, update, {
      session,
      returnDocument: 'after',
    });
  }

  /**
   * Atomic credit
   * Guarantees recipient account is active
   */
  async credit(accountId, amountInPaise, session) {
    const filter = {
      _id: new ObjectId(accountId),
      status: 'active',
    };
    const update = {
      $inc: { balanceInPaise: amountInPaise },
      $set: { updatedAt: new Date() },
    };
    return this.collection.findOneAndUpdate(filter, update, {
      session,
      returnDocument: 'after',
    });
  }

  async updateStatus(id, status) {
    if (!ObjectId.isValid(id)) return null;
    return this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  async findAll(query = {}) {
    return this.collection.find(query).sort({ createdAt: -1 }).toArray();
  }
}

module.exports = new AccountRepository();
