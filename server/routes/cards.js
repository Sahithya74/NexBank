'use strict';

const express = require('express');
const controller = require('../controllers/cardController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

router.get('/all', authorize('account.view.all'), controller.listAll);

router.get('/', authorize('card.view'), controller.list);
router.get('/:id', authorize('card.view'), controller.getOne);
router.get('/:id/transactions', authorize('card.view'), controller.transactions);

router.patch(
  '/:id/status',
  authorize('card.manage'),
  validateBody({
    status: { type: 'enum', required: true, values: ['active', 'blocked'], label: 'Status' },
  }),
  controller.setStatus,
);

router.patch(
  '/:id/controls',
  authorize('card.manage'),
  validateBody({
    online: { type: 'boolean', label: 'Online payments' },
    international: { type: 'boolean', label: 'International use' },
    contactless: { type: 'boolean', label: 'Contactless' },
    dailyLimit: { type: 'amount', label: 'Daily limit' },
  }),
  controller.updateControls,
);

module.exports = router;
