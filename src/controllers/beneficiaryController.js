const beneficiaryService = require('../services/beneficiaryService');
const { validateBeneficiaryInput } = require('../validators/beneficiaryValidator');

class BeneficiaryController {
  async addBeneficiary(req, res, next) {
    try {
      if (!req.userAccount) {
        return res.status(400).json({
          success: false,
          message: 'Active bank account required.',
        });
      }

      const validation = validateBeneficiaryInput(req.body, req.userAccount.accountNumber);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.errors[0],
          errors: validation.errors,
        });
      }

      const beneficiary = await beneficiaryService.addBeneficiary({
        userId: req.user._id,
        userAccountNumber: req.userAccount.accountNumber,
        recipientAccountNumber: validation.cleanAccountNumber,
        displayName: validation.cleanDisplayName,
      });

      return res.status(201).json({
        success: true,
        message: 'Beneficiary added successfully.',
        data: beneficiary,
      });
    } catch (error) {
      next(error);
    }
  }

  async getBeneficiaries(req, res, next) {
    try {
      const beneficiaries = await beneficiaryService.getBeneficiaries(req.user._id);
      return res.status(200).json({
        success: true,
        data: beneficiaries,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteBeneficiary(req, res, next) {
    try {
      const { id } = req.params;
      const result = await beneficiaryService.deleteBeneficiary(id, req.user._id);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BeneficiaryController();
