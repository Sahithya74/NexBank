'use strict';

const express = require('express');
const controller = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('notification.view'));

router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', controller.markAllRead);
router.get('/', controller.list);
router.patch('/:id/read', controller.markRead);
router.delete('/:id', controller.remove);

module.exports = router;
