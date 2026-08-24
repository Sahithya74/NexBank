'use strict';

const express = require('express');
const controller = require('../controllers/billController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

router.get('/billers', authorize('bill.manage', 'bill.pay'), controller.billers);
router.get('/history', authorize('bill.pay'), controller.history);
router.get('/', authorize('bill.manage', 'bill.pay'), controller.list);

router.post(
  '/',
  authorize('bill.manage'),
  validateBody({
    billerId: { type: 'id', required: true, label: 'Biller' },
    consumerNumber: { type: 'string', required: true, minLength: 3, maxLength: 60, label: 'Consumer number' },
    label: { type: 'string', maxLength: 120, label: 'Label' },
    amount: { type: 'amount', required: true, label: 'Amount' },
    currency: { type: 'currency', label: 'Currency' },
    dueDate: { type: 'date', required: true, label: 'Due date' },
  }),
  controller.add,
);

router.post(
  '/:id/pay',
  authorize('bill.pay'),
  validateBody({ accountId: { type: 'id', required: true, label: 'Payment account' } }),
  controller.pay,
);

router.delete('/:id', authorize('bill.manage'), controller.remove);

module.exports = router;
