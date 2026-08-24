'use strict';

const express = require('express');
const controller = require('../controllers/transactionController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const canView = authorize('transaction.view.own', 'transaction.view.assigned', 'transaction.view.all');

router.get('/filters', canView, controller.filters);
router.get('/summary', canView, controller.summary);
router.get('/analytics', canView, controller.analytics);
router.get('/', canView, controller.list);
router.get('/:reference', canView, controller.getOne);

module.exports = router;
