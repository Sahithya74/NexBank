'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../utils/validate');
const config = require('../config/env');

const router = express.Router();

/** Credential endpoints are rate limited per IP to blunt brute-force attempts. */
const credentialLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.auth,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again in a few minutes.' },
  },
});

router.post(
  '/register',
  credentialLimiter,
  validateBody({
    fullName: { type: 'string', required: true, minLength: 3, maxLength: 120, label: 'Full name' },
    email: { type: 'email', required: true },
    password: { type: 'password', required: true },
    phone: { type: 'string', maxLength: 20 },
    address: { type: 'string', maxLength: 255 },
  }),
  controller.register,
);

router.post(
  '/login',
  credentialLimiter,
  validateBody({
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, maxLength: 128, label: 'Password' },
  }),
  controller.login,
);

router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);

router.put(
  '/me',
  authenticate,
  authorize('profile.update'),
  validateBody({
    fullName: { type: 'string', required: true, minLength: 3, maxLength: 120, label: 'Full name' },
    phone: { type: 'string', maxLength: 20 },
    address: { type: 'string', maxLength: 255 },
  }),
  controller.updateProfile,
);

router.put(
  '/password',
  authenticate,
  credentialLimiter,
  validateBody({
    currentPassword: { type: 'string', required: true, maxLength: 128, label: 'Current password' },
    newPassword: { type: 'password', required: true, label: 'New password' },
  }),
  controller.changePassword,
);

module.exports = router;
