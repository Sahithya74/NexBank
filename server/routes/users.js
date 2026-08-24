'use strict';

const express = require('express');
const controller = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * Read-only directory of platform users. Employees and managers use this to look up
 * the customers they support; full user administration lives under /api/admin/users.
 */
const router = express.Router();
router.use(authenticate, authorize('user.view'));

router.get('/', controller.listUsers);
router.get('/:id', controller.getUser);

module.exports = router;
