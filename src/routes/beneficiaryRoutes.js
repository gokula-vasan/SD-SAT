const express = require('express');
const router = express.Router();
const beneficiaryController = require('../controllers/beneficiaryController');
const authenticate = require('../middleware/authenticate');

router.post('/', authenticate, (req, res, next) => beneficiaryController.addBeneficiary(req, res, next));
router.get('/', authenticate, (req, res, next) => beneficiaryController.getBeneficiaries(req, res, next));
router.delete('/:id', authenticate, (req, res, next) => beneficiaryController.deleteBeneficiary(req, res, next));

module.exports = router;
