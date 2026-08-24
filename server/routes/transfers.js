'use strict';

const express = require('express');
const controller = require('../controllers/transferController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

router.post(
  '/',
  authorize('transfer.create'),
  validateBody({
    mode: { type: 'enum', required: true, values: ['own', 'beneficiary'], label: 'Transfer type' },
    fromAccountId: { type: 'id', required: true, label: 'Source account' },
    toAccountId: { type: 'id', label: 'Destination account' },
    beneficiaryId: { type: 'id', label: 'Beneficiary' },
    amount: { type: 'amount', required: true, label: 'Amount' },
    remarks: { type: 'string', maxLength: 255, label: 'Remarks' },
    idempotencyKey: { type: 'string', maxLength: 64, label: 'Idempotency key' },
  }),
  controller.create,
);

router.get('/', authorize('transfer.view.own', 'transfer.view.all'), controller.list);
router.get('/:reference', authorize('transfer.view.own', 'transfer.view.all'), controller.getOne);

module.exports = router;
