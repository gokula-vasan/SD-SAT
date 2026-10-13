const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authenticate = require('../middleware/authenticate');

router.get('/', authenticate, (req, res, next) => transactionController.getTransactions(req, res, next));

module.exports = router;
