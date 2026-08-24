'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const config = require('../config/env');
const adminService = require('../services/adminService');
const auditService = require('../services/auditService');

const dashboard = asyncHandler(async (req, res) => {
  const base = (req.query.base || config.baseCurrency).toUpperCase();
  return ok(res, await adminService.dashboard(base));
});

const listUsers = asyncHandler(async (req, res) => {
  return ok(res, await adminService.listUsers(req.query));
});

const getUser = asyncHandler(async (req, res) => {
  return ok(res, await adminService.getUser(req.params.id));
});

const createUser = asyncHandler(async (req, res) => {
  const user = await adminService.createUser(req.user, req.validated, req);
  return created(res, user, `${user.fullName} has been created.`);
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await adminService.updateUser(req.user, req.params.id, req.validated, req);
  return ok(res, user, 'User updated.');
});

const setUserStatus = asyncHandler(async (req, res) => {
  const user = await adminService.setUserStatus(req.user, req.params.id, req.validated.status, req);
  return ok(res, user, `User set to ${req.validated.status}.`);
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await adminService.resetUserPassword(req.user, req.params.id, req.validated.password, req);
  return ok(res, null, result.message);
});

const listRoles = asyncHandler(async (_req, res) => {
  return ok(res, await adminService.listRoles());
});

const updateRolePermissions = asyncHandler(async (req, res) => {
  const result = await adminService.updateRolePermissions(
    req.user,
    req.params.id,
    req.body.permissionIds || [],
    req,
  );
  return ok(res, result, 'Role permissions updated.');
});

const reports = asyncHandler(async (req, res) => {
  return ok(res, await adminService.reports({ from: req.query.from, to: req.query.to }));
});

const staff = asyncHandler(async (_req, res) => {
  return ok(res, await adminService.listStaff());
});

const auditLogs = asyncHandler(async (req, res) => {
  return ok(res, await auditService.list(req.query));
});

const auditActions = asyncHandler(async (_req, res) => {
  return ok(res, await auditService.actions());
});

module.exports = {
  dashboard,
  listUsers,
  getUser,
  createUser,
  updateUser,
  setUserStatus,
  resetPassword,
  listRoles,
  updateRolePermissions,
  reports,
  staff,
  auditLogs,
  auditActions,
};
