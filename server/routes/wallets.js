'use strict';

const express = require('express');
const controller = require('../controllers/walletController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody, validateQuery } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

router.get('/all', authorize('wallet.view.all'), controller.listAll);

router.get('/', authorize('wallet.view.own'), controller.overview);
router.get('/conversions', authorize('wallet.view.own'), controller.conversionHistory);
router.get('/transactions', authorize('wallet.view.own'), controller.transactions);

router.get(
  '/quote',
  authorize('wallet.view.own'),
  validateQuery({
    from: { type: 'currency', required: true, label: 'From currency' },
    to: { type: 'currency', required: true, label: 'To currency' },
    amount: { type: 'amount', required: true, label: 'Amount' },
  }),
  controller.quote,
);

router.post(
  '/currencies',
  authorize('wallet.manage'),
  validateBody({ currency: { type: 'currency', required: true, label: 'Currency' } }),
  controller.addCurrency,
);

router.delete('/currencies/:code', authorize('wallet.manage'), controller.removeCurrency);

router.post(
  '/convert',
  authorize('wallet.convert'),
  validateBody({
    from: { type: 'currency', required: true, label: 'From currency' },
    to: { type: 'currency', required: true, label: 'To currency' },
    amount: { type: 'amount', required: true, label: 'Amount' },
  }),
  controller.convert,
);

router.post(
  '/transfer',
  authorize('transfer.create'),
  validateBody({
    recipientEmail: { type: 'email', required: true, label: 'Recipient email' },
    currency: { type: 'currency', required: true, label: 'Currency' },
    amount: { type: 'amount', required: true, label: 'Amount' },
    note: { type: 'string', maxLength: 255, label: 'Note' },
  }),
  controller.transfer,
);

module.exports = router;
