'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const config = require('../config/env');
const accountService = require('../services/accountService');
const { hasPermission } = require('../middleware/auth');

const listMine = asyncHandler(async (req, res) => {
  const accounts = await accountService.listForUser(req.user.id);
  return ok(res, accounts);
});

const summary = asyncHandler(async (req, res) => {
  const base = (req.query.base || config.baseCurrency).toUpperCase();
  return ok(res, await accountService.summaryForUser(req.user.id, base));
});

const getOne = asyncHandler(async (req, res) => {
  return ok(res, await accountService.getForUser(req.user.id, req.params.id));
});

const revealNumber = asyncHandler(async (req, res) => {
  return ok(res, await accountService.revealAccountNumber(req.user, req.params.id, req));
});

const statement = asyncHandler(async (req, res) => {
  const result = await accountService.statement(req.user.id, req.params.id, req.query);
  return ok(res, result);
});

/** Staff listing - employees see only accounts of customers assigned to them. */
const listAll = asyncHandler(async (req, res) => {
  const assignedTo = hasPermission(req.user, 'account.view.all') ? null : req.user.id;
  const result = await accountService.listAll(req.query, { assignedTo });
  return ok(res, result);
});

const openAccount = asyncHandler(async (req, res) => {
  const account = await accountService.openAccount(
    {
      userId: req.validated.userId,
      accountType: req.validated.accountType,
      currency: req.validated.currency,
    },
    { actor: req.user, req },
  );
  return created(res, account, 'The account has been opened.');
});

const setStatus = asyncHandler(async (req, res) => {
  const account = await accountService.setStatus(req.params.id, req.validated.status, req.user, req);
  return ok(res, account, `Account status set to ${req.validated.status}.`);
});

module.exports = { listMine, summary, getOne, revealNumber, statement, listAll, openAccount, setStatus };
