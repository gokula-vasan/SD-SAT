const transferService = require('../services/transferService');
const transferRepository = require('../repositories/transferRepository');
const { validateTransferInput } = require('../validators/transferValidator');
const { formatPaiseToRupees } = require('../utils/formatters');

class TransferController {
  async createTransfer(req, res, next) {
    try {
      if (!req.userAccount) {
        return res.status(400).json({
          success: false,
          message: 'Active bank account required to initiate transfers.',
        });
      }

      // Read idempotency key from header or body
      const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;
      const payload = { ...req.body, idempotencyKey };

      const validation = validateTransferInput(payload, req.userAccount.accountNumber);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.errors[0],
          errors: validation.errors,
        });
      }

      const result = await transferService.executeTransfer({
        senderUser: req.user,
        senderAccount: req.userAccount,
        recipientAccountNumber: validation.cleanRecipientAccountNumber,
        amountInPaise: validation.parsedAmountInPaise,
        description: validation.cleanDescription,
        idempotencyKey: validation.cleanIdempotencyKey,
      });

      const statusCode = result.idempotentReplay ? 200 : 201;
      return res.status(statusCode).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransfers(req, res, next) {
    try {
      if (!req.userAccount) {
        return res.status(400).json({
          success: false,
          message: 'Active bank account required to view transfers.',
        });
      }

      const transfers = await transferRepository.findAccountTransfers(req.userAccount._id, {
        limit: 50,
      });

      const formatted = transfers.map((t) => ({
        id: t._id.toString(),
        reference: t.reference,
        amountInPaise: t.amountInPaise,
        amountFormatted: formatPaiseToRupees(t.amountInPaise),
        type: t.senderAccountId.equals(req.userAccount._id) ? 'debit' : 'credit',
        status: t.status,
        description: t.description,
        initiatedAt: t.initiatedAt,
        completedAt: t.completedAt,
      }));

      return res.status(200).json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransferById(req, res, next) {
    try {
      const { id } = req.params;
      const transfer = await transferService.getTransferById(id, req.userAccount);
      return res.status(200).json({
        success: true,
        data: transfer,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransferByReference(req, res, next) {
    try {
      const { reference } = req.params;
      const transfer = await transferService.getTransferByReference(reference, req.userAccount);
      return res.status(200).json({
        success: true,
        data: transfer,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TransferController();
