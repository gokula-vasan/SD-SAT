const transactionService = require('../services/transactionService');

class TransactionController {
  async getTransactions(req, res, next) {
    try {
      if (!req.userAccount) {
        return res.status(400).json({
          success: false,
          message: 'Active bank account required to access transaction history.',
        });
      }

      const { page, limit, type, status, startDate, endDate } = req.query;

      const result = await transactionService.getAccountTransactions({
        userAccount: req.userAccount,
        page,
        limit,
        type,
        status,
        startDate,
        endDate,
      });

      return res.status(200).json({
        success: true,
        data: result.transactions,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TransactionController();
