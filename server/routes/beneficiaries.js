'use strict';

const express = require('express');
const controller = require('../controllers/beneficiaryController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody, validateQuery } = require('../utils/validate');

const router = express.Router();
router.use(authenticate, authorize('beneficiary.manage'));

router.get(
  '/verify',
  validateQuery({
    accountNumber: { type: 'string', required: true, minLength: 6, maxLength: 20, label: 'Account number' },
  }),
  controller.verify,
);

router.get('/', controller.list);

router.post(
  '/',
  validateBody({
    nickname: { type: 'string', required: true, minLength: 2, maxLength: 80, label: 'Nickname' },
    accountNumber: { type: 'string', required: true, minLength: 6, maxLength: 20, label: 'Account number' },
    holderName: { type: 'string', maxLength: 120, label: 'Account holder' },
    bankName: { type: 'string', maxLength: 120, label: 'Bank' },
    ifscCode: { type: 'string', maxLength: 15, label: 'IFSC code' },
    currency: { type: 'currency', label: 'Currency' },
  }),
  controller.create,
);

router.put(
  '/:id',
  validateBody({
    nickname: { type: 'string', required: true, minLength: 2, maxLength: 80, label: 'Nickname' },
    ifscCode: { type: 'string', maxLength: 15, label: 'IFSC code' },
  }),
  controller.update,
);

router.delete('/:id', controller.remove);

module.exports = router;
