'use strict';

const express = require('express');
const controller = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', authorize('admin.dashboard'), controller.dashboard);
router.get('/reports', authorize('report.view'), controller.reports);
router.get('/staff', authorize('user.view'), controller.staff);

// Users
router.get('/users', authorize('user.view'), controller.listUsers);
router.get('/users/:id', authorize('user.view'), controller.getUser);

router.post(
  '/users',
  authorize('user.manage'),
  validateBody({
    fullName: { type: 'string', required: true, minLength: 3, maxLength: 120, label: 'Full name' },
    email: { type: 'email', required: true },
    password: { type: 'password', required: true },
    roleId: { type: 'id', required: true, label: 'Role' },
    phone: { type: 'string', maxLength: 20 },
    address: { type: 'string', maxLength: 255 },
    status: { type: 'enum', values: ['active', 'suspended', 'pending'], label: 'Status' },
    managedBy: { type: 'id', label: 'Assigned employee' },
  }),
  controller.createUser,
);

router.put(
  '/users/:id',
  authorize('user.manage'),
  validateBody({
    fullName: { type: 'string', required: true, minLength: 3, maxLength: 120, label: 'Full name' },
    phone: { type: 'string', maxLength: 20 },
    address: { type: 'string', maxLength: 255 },
    roleId: { type: 'id', label: 'Role' },
    managedBy: { type: 'id', label: 'Assigned employee' },
  }),
  controller.updateUser,
);

router.patch(
  '/users/:id/status',
  authorize('user.manage'),
  validateBody({
    status: { type: 'enum', required: true, values: ['active', 'suspended', 'pending'], label: 'Status' },
  }),
  controller.setUserStatus,
);

router.post(
  '/users/:id/password',
  authorize('user.manage'),
  validateBody({ password: { type: 'password', required: true, label: 'New password' } }),
  controller.resetPassword,
);

// Roles & permissions
router.get('/roles', authorize('role.view'), controller.listRoles);
router.put('/roles/:id/permissions', authorize('role.manage'), controller.updateRolePermissions);

module.exports = router;
