const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const authenticate = require('../middleware/authenticate');

router.get('/me', authenticate, (req, res, next) => accountController.getMe(req, res, next));
router.get('/me/balance', authenticate, (req, res, next) => accountController.getBalance(req, res, next));
router.get('/me/dashboard', authenticate, (req, res, next) => accountController.getDashboardSummary(req, res, next));

module.exports = router;
