const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authenticate = require('../middleware/authenticate');

router.get('/', authenticate, (req, res, next) => notificationController.getNotifications(req, res, next));
router.patch('/read-all', authenticate, (req, res, next) => notificationController.markAllAsRead(req, res, next));
router.patch('/:id/read', authenticate, (req, res, next) => notificationController.markAsRead(req, res, next));

module.exports = router;
