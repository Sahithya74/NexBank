'use strict';

const express = require('express');
const controller = require('../controllers/accountController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// Staff routes are declared before /:id so "all" is not read as an identifier.
router.get('/all', authorize('account.view.all', 'account.view.assigned'), controller.listAll);

router.post(
  '/',
  authorize('account.manage'),
  validateBody({
    userId: { type: 'id', required: true, label: 'Customer' },
    accountType: { type: 'enum', required: true, values: ['savings', 'current', 'salary', 'fixed_deposit'], label: 'Account type' },
    currency: { type: 'currency', required: true, label: 'Currency' },
  }),
  controller.openAccount,
);

router.patch(
  '/:id/status',
  authorize('account.manage'),
  validateBody({
    status: { type: 'enum', required: true, values: ['active', 'frozen', 'closed'], label: 'Status' },
  }),
  controller.setStatus,
);

router.get('/summary', authorize('account.view.own'), controller.summary);
router.get('/', authorize('account.view.own'), controller.listMine);
router.get('/:id', authorize('account.view.own'), controller.getOne);
router.get('/:id/number', authorize('account.view.own'), controller.revealNumber);
router.get('/:id/statement', authorize('account.view.own'), controller.statement);

module.exports = router;
