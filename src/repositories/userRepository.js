const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

class UserRepository {
  get collection() {
    return getDb().collection('users');
  }

  async findById(id) {
    if (!ObjectId.isValid(id)) return null;
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  async findByEmail(email) {
    if (!email) return null;
    return this.collection.findOne({ email: email.toLowerCase().trim() });
  }

  async create(userData) {
    const user = {
      fullName: userData.fullName.trim(),
      email: userData.email.toLowerCase().trim(),
      passwordHash: userData.passwordHash,
      role: userData.role || 'customer',
      status: userData.status || 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await this.collection.insertOne(user);
    return { ...user, _id: result.insertedId };
  }

  async updateStatus(id, status) {
    if (!ObjectId.isValid(id)) return null;
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
  }

  async findAll(query = {}) {
    return this.collection
      .find(query, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async count(query = {}) {
    return this.collection.countDocuments(query);
  }
}

module.exports = new UserRepository();
