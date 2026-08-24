'use strict';

const express = require('express');
const controller = require('../controllers/loanController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody, validateQuery } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

router.get('/products', controller.products);

router.get(
  '/quote',
  validateQuery({
    amount: { type: 'amount', required: true, label: 'Loan amount' },
    interestRate: { type: 'amount', required: true, label: 'Interest rate' },
    tenureMonths: { type: 'int', required: true, min: 1, max: 480, label: 'Tenure' },
  }),
  controller.quote,
);

// Staff review queue - declared before /:id.
router.get('/all', authorize('loan.view.all'), controller.listAll);
router.patch('/:id/review', authorize('loan.review'), controller.review);

router.patch(
  '/:id/decision',
  authorize('loan.approve'),
  validateBody({
    decision: { type: 'enum', required: true, values: ['approve', 'reject'], label: 'Decision' },
    note: { type: 'string', maxLength: 255, label: 'Note' },
    accountId: { type: 'id', label: 'Disbursement account' },
  }),
  controller.decide,
);

router.get('/', authorize('loan.view.own'), controller.listMine);
router.get('/:id', authorize('loan.view.own'), controller.getOne);

router.post(
  '/',
  authorize('loan.apply'),
  validateBody({
    productId: { type: 'id', required: true, label: 'Loan product' },
    amount: { type: 'amount', required: true, label: 'Loan amount' },
    tenureMonths: { type: 'int', required: true, min: 1, max: 480, label: 'Tenure' },
    purpose: { type: 'string', maxLength: 255, label: 'Purpose' },
    accountId: { type: 'id', label: 'Disbursement account' },
  }),
  controller.apply,
);

router.post(
  '/:id/repay',
  authorize('loan.repay'),
  validateBody({
    accountId: { type: 'id', required: true, label: 'Payment account' },
    amount: { type: 'amount', label: 'Amount' },
  }),
  controller.repay,
);

module.exports = router;
