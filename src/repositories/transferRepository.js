const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

class TransferRepository {
  get collection() {
    return getDb().collection('transfers');
  }

  async findById(id) {
    if (!ObjectId.isValid(id)) return null;
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  async findByReference(reference) {
    if (!reference) return null;
    return this.collection.findOne({ reference: reference.trim().toUpperCase() });
  }

  async findByIdempotencyKey(senderAccountId, idempotencyKey) {
    if (!ObjectId.isValid(senderAccountId) || !idempotencyKey) return null;
    return this.collection.findOne({
      senderAccountId: new ObjectId(senderAccountId),
      idempotencyKey: String(idempotencyKey).trim(),
    });
  }

  async create(transferData, options = {}) {
    const transfer = {
      reference: transferData.reference.trim().toUpperCase(),
      senderAccountId: new ObjectId(transferData.senderAccountId),
      recipientAccountId: new ObjectId(transferData.recipientAccountId),
      amountInPaise: parseInt(transferData.amountInPaise, 10),
      description: transferData.description ? transferData.description.trim() : '',
      status: transferData.status || 'pending',
      idempotencyKey: String(transferData.idempotencyKey).trim(),
      initiatedAt: transferData.initiatedAt || new Date(),
      completedAt: transferData.completedAt || null,
      failureReason: transferData.failureReason || null,
    };
    const result = await this.collection.insertOne(transfer, options);
    return { ...transfer, _id: result.insertedId };
  }

  async updateStatus(id, status, failureReason = null, session = null) {
    if (!ObjectId.isValid(id)) return null;
    const update = {
      $set: {
        status,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : null,
        failureReason,
      },
    };
    const options = { returnDocument: 'after' };
    if (session) options.session = session;
    return this.collection.findOneAndUpdate({ _id: new ObjectId(id) }, update, options);
  }

  async findAccountTransfers(accountId, options = {}) {
    const accId = new ObjectId(accountId);
    const filter = {
      $or: [{ senderAccountId: accId }, { recipientAccountId: accId }],
    };
    return this.collection
      .find(filter)
      .sort({ initiatedAt: -1 })
      .limit(options.limit || 50)
      .toArray();
  }

  async findAll(query = {}, options = {}) {
    const limit = options.limit || 50;
    const skip = options.skip || 0;
    return this.collection
      .find(query)
      .sort({ initiatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async count(query = {}) {
    return this.collection.countDocuments(query);
  }
}

module.exports = new TransferRepository();
