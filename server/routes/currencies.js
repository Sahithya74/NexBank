'use strict';

const express = require('express');
const controller = require('../controllers/currencyController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody, validateQuery } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

router.get('/', controller.list);
router.get('/rates', controller.rates);
router.get(
  '/quote',
  validateQuery({
    from: { type: 'currency', required: true, label: 'From currency' },
    to: { type: 'currency', required: true, label: 'To currency' },
    amount: { type: 'amount', required: true, label: 'Amount' },
  }),
  controller.quote,
);

// Adding a currency is data entry, not a schema change.
router.post(
  '/',
  authorize('settings.manage'),
  validateBody({
    code: { type: 'currency', required: true, label: 'Currency code' },
    name: { type: 'string', required: true, maxLength: 60, label: 'Name' },
    symbol: { type: 'string', required: true, maxLength: 8, label: 'Symbol' },
    decimals: { type: 'int', required: true, min: 0, max: 6, label: 'Decimals' },
    rate: { type: 'amount', required: true, label: 'Rate against USD' },
  }),
  controller.createCurrency,
);

router.put(
  '/:code/rate',
  authorize('settings.manage'),
  validateBody({ rate: { type: 'amount', required: true, label: 'Rate' } }),
  controller.updateRate,
);

router.patch(
  '/:code/status',
  authorize('settings.manage'),
  validateBody({ isActive: { type: 'boolean', required: true, label: 'Active' } }),
  controller.setActive,
);

module.exports = router;
