'use strict';

const express = require('express');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: { service: 'NexBank API', status: 'ok', time: new Date().toISOString() },
    message: '',
  });
});

router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/accounts', require('./accounts'));
router.use('/wallets', require('./wallets'));
router.use('/currencies', require('./currencies'));
router.use('/transfers', require('./transfers'));
router.use('/transactions', require('./transactions'));
router.use('/beneficiaries', require('./beneficiaries'));
router.use('/cards', require('./cards'));
router.use('/bills', require('./bills'));
router.use('/loans', require('./loans'));
router.use('/notifications', require('./notifications'));
router.use('/admin', require('./admin'));
router.use('/audit-logs', require('./auditLogs'));

module.exports = router;
