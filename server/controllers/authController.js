'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const authService = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.validated, req);
  return created(res, result, 'Welcome to NexBank. Your account is ready.');
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.validated, req);
  return ok(res, result, `Signed in as ${result.user.roleLabel}.`);
});

const logout = asyncHandler(async (req, res) => {
  const result = await authService.logout(req.user, req);
  return ok(res, null, result.message);
});

const me = asyncHandler(async (req, res) => {
  const profile = await authService.profile(req.user.id);
  return ok(res, profile);
});

const updateProfile = asyncHandler(async (req, res) => {
  const profile = await authService.updateProfile(req.user, req.validated, req);
  return ok(res, profile, 'Your profile has been updated.');
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user, req.validated, req);
  return ok(res, null, result.message);
});

module.exports = { register, login, logout, me, updateProfile, changePassword };
