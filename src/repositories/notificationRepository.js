const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

class NotificationRepository {
  get collection() {
    return getDb().collection('notifications');
  }

  async create(data, options = {}) {
    const notification = {
      userId: new ObjectId(data.userId),
      type: data.type,
      message: data.message.trim(),
      relatedTransferId: data.relatedTransferId && ObjectId.isValid(data.relatedTransferId)
        ? new ObjectId(data.relatedTransferId)
        : null,
      isRead: false,
      createdAt: new Date(),
    };
    const result = await this.collection.insertOne(notification, options);
    return { ...notification, _id: result.insertedId };
  }

  async findByUserId(userId, options = {}) {
    if (!ObjectId.isValid(userId)) return [];
    const limit = options.limit || 50;
    return this.collection
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async markAsRead(id, userId) {
    if (!ObjectId.isValid(id) || !ObjectId.isValid(userId)) return null;
    return this.collection.findOneAndUpdate(
      { _id: new ObjectId(id), userId: new ObjectId(userId) },
      { $set: { isRead: true } },
      { returnDocument: 'after' }
    );
  }

  async markAllAsRead(userId) {
    if (!ObjectId.isValid(userId)) return null;
    return this.collection.updateMany(
      { userId: new ObjectId(userId), isRead: false },
      { $set: { isRead: true } }
    );
  }

  async countUnread(userId) {
    if (!ObjectId.isValid(userId)) return 0;
    return this.collection.countDocuments({
      userId: new ObjectId(userId),
      isRead: false,
    });
  }
}

module.exports = new NotificationRepository();
