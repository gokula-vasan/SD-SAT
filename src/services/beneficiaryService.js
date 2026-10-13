const beneficiaryRepository = require('../repositories/beneficiaryRepository');
const accountRepository = require('../repositories/accountRepository');
const auditRepository = require('../repositories/auditRepository');

class BeneficiaryService {
  async addBeneficiary({ userId, userAccountNumber, recipientAccountNumber, displayName }) {
    const cleanAcc = recipientAccountNumber.trim().toUpperCase();

    if (userAccountNumber && cleanAcc === userAccountNumber.trim().toUpperCase()) {
      const error = new Error('You cannot add your own account as a beneficiary.');
      error.statusCode = 400;
      error.isOperational = true;
      throw error;
    }

    const recipientAccount = await accountRepository.findByAccountNumber(cleanAcc);
    if (!recipientAccount) {
      const error = new Error(`Recipient account "${cleanAcc}" does not exist.`);
      error.statusCode = 404;
      error.isOperational = true;
      throw error;
    }

    if (recipientAccount.status !== 'active') {
      const error = new Error('Cannot add an inactive or suspended account as a beneficiary.');
      error.statusCode = 400;
      error.isOperational = true;
      throw error;
    }

    // Check duplicate
    const existing = await beneficiaryRepository.findByUserAndAccount(userId, recipientAccount._id);
    if (existing) {
      const error = new Error('This account is already in your beneficiary list.');
      error.statusCode = 409;
      error.isOperational = true;
      throw error;
    }

    const beneficiary = await beneficiaryRepository.create({
      userId,
      beneficiaryAccountId: recipientAccount._id,
      displayName: displayName.trim(),
    });

    await auditRepository.log({
      actorUserId: userId,
      action: 'BENEFICIARY_ADDED',
      entityType: 'beneficiary',
      entityId: beneficiary._id,
      metadata: { recipientAccountNumber: cleanAcc, displayName },
    });

    return {
      id: beneficiary._id.toString(),
      displayName: beneficiary.displayName,
      accountNumber: recipientAccount.accountNumber,
      accountStatus: recipientAccount.status,
      createdAt: beneficiary.createdAt,
    };
  }

  async getBeneficiaries(userId) {
    return beneficiaryRepository.findByUserId(userId);
  }

  async deleteBeneficiary(id, userId) {
    const deleted = await beneficiaryRepository.delete(id, userId);
    if (!deleted) {
      const error = new Error('Beneficiary not found or unauthorized to remove.');
      error.statusCode = 404;
      error.isOperational = true;
      throw error;
    }

    await auditRepository.log({
      actorUserId: userId,
      action: 'BENEFICIARY_REMOVED',
      entityType: 'beneficiary',
      entityId: id,
      metadata: { beneficiaryId: id },
    });

    return { success: true, message: 'Beneficiary removed successfully.' };
  }
}

module.exports = new BeneficiaryService();
