const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

class BeneficiaryRepository {
  get collection() {
    return getDb().collection('beneficiaries');
  }

  async findById(id) {
    if (!ObjectId.isValid(id)) return null;
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  async findByUserAndAccount(userId, beneficiaryAccountId) {
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(beneficiaryAccountId)) return null;
    return this.collection.findOne({
      userId: new ObjectId(userId),
      beneficiaryAccountId: new ObjectId(beneficiaryAccountId),
    });
  }

  async findByUserId(userId) {
    if (!ObjectId.isValid(userId)) return [];
    // Aggregate to join with accounts collection and users to get account details
    return this.collection
      .aggregate([
        { $match: { userId: new ObjectId(userId) } },
        {
          $lookup: {
            from: 'accounts',
            localField: 'beneficiaryAccountId',
            foreignField: '_id',
            as: 'account',
          },
        },
        { $unwind: '$account' },
        {
          $lookup: {
            from: 'users',
            localField: 'account.userId',
            foreignField: '_id',
            as: 'owner',
          },
        },
        { $unwind: '$owner' },
        {
          $project: {
            _id: 1,
            userId: 1,
            beneficiaryAccountId: 1,
            displayName: 1,
            createdAt: 1,
            accountNumber: '$account.accountNumber',
            accountStatus: '$account.status',
            ownerName: '$owner.fullName',
          },
        },
        { $sort: { createdAt: -1 } },
      ])
      .toArray();
  }

  async create(beneficiaryData) {
    const beneficiary = {
      userId: new ObjectId(beneficiaryData.userId),
      beneficiaryAccountId: new ObjectId(beneficiaryData.beneficiaryAccountId),
      displayName: beneficiaryData.displayName.trim(),
      createdAt: new Date(),
    };
    const result = await this.collection.insertOne(beneficiary);
    return { ...beneficiary, _id: result.insertedId };
  }

  async delete(id, userId) {
    if (!ObjectId.isValid(id) || !ObjectId.isValid(userId)) return null;
    return this.collection.findOneAndDelete({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });
  }
}

module.exports = new BeneficiaryRepository();
