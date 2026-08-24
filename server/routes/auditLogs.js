'use strict';

const express = require('express');
const controller = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('audit.view'));

router.get('/actions', controller.auditActions);
router.get('/', controller.auditLogs);

module.exports = router;
