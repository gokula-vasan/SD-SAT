const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const authenticate = require('../middleware/authenticate');

router.post('/', authenticate, (req, res, next) => transferController.createTransfer(req, res, next));
router.get('/', authenticate, (req, res, next) => transferController.getTransfers(req, res, next));
router.get('/reference/:reference', authenticate, (req, res, next) => transferController.getTransferByReference(req, res, next));
router.get('/:id', authenticate, (req, res, next) => transferController.getTransferById(req, res, next));

module.exports = router;
