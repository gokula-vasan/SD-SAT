const accountService = require('../services/accountService');

class AccountController {
  async getMe(req, res, next) {
    try {
      const account = await accountService.getAccountByUserId(req.user.id);
      return res.status(200).json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  async getBalance(req, res, next) {
    try {
      const balance = await accountService.getAccountBalance(req.user.id);
      return res.status(200).json({
        success: true,
        data: balance,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDashboardSummary(req, res, next) {
    try {
      const summary = await accountService.getDashboardSummary(req.user.id);
      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AccountController();
