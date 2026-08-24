'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const transferService = require('../services/transferService');
const { hasPermission } = require('../middleware/auth');

const create = asyncHandler(async (req, res) => {
  const result = await transferService.createTransfer(req.user, req.validated, req);
  return created(
    res,
    result,
    result.duplicate
      ? 'This transfer was already processed.'
      : `${result.amount} ${result.currency} sent successfully.`,
  );
});

const list = asyncHandler(async (req, res) => {
  const scopeUserId = hasPermission(req.user, 'transfer.view.all') ? null : req.user.id;
  return ok(res, await transferService.list(req.query, { scopeUserId }));
});

const getOne = asyncHandler(async (req, res) => {
  const scopeUserId = hasPermission(req.user, 'transfer.view.all') ? null : req.user.id;
  return ok(res, await transferService.getByReference(req.params.reference, { scopeUserId }));
});

module.exports = { create, list, getOne };
