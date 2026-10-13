const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

class AuditRepository {
  get collection() {
    return getDb().collection('audit_logs');
  }

  async log(data) {
    try {
      const entry = {
        actorUserId: data.actorUserId && ObjectId.isValid(data.actorUserId)
          ? new ObjectId(data.actorUserId)
          : null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ? String(data.entityId) : null,
        metadata: data.metadata || {},
        createdAt: new Date(),
      };
      return await this.collection.insertOne(entry);
    } catch (err) {
      console.error('[AUDIT] Failed to write audit log:', err.message);
      return null;
    }
  }

  async findAll(query = {}, options = {}) {
    const limit = options.limit || 100;
    const skip = options.skip || 0;
    return this.collection
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'actorUserId',
            foreignField: '_id',
            as: 'actor',
          },
        },
        {
          $unwind: {
            path: '$actor',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            actorUserId: 1,
            actorName: '$actor.fullName',
            actorEmail: '$actor.email',
            action: 1,
            entityType: 1,
            entityId: 1,
            metadata: 1,
            createdAt: 1,
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ])
      .toArray();
  }

  async count(query = {}) {
    return this.collection.countDocuments(query);
  }
}

module.exports = new AuditRepository();
