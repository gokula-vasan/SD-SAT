const adminService = require('../services/adminService');

class AdminController {
  async getUsers(req, res, next) {
    try {
      const users = await adminService.getAllUsers();
      return res.status(200).json({
        success: true,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status field is required (active or suspended).',
        });
      }

      const result = await adminService.updateUserStatus(id, status, req.user);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getTransfers(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await adminService.getAllTransfers(page, limit);
      return res.status(200).json({
        success: true,
        data: result.transfers,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAuditLogs(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await adminService.getAuditLogs(page, limit);
      return res.status(200).json({
        success: true,
        data: result.auditLogs,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();
