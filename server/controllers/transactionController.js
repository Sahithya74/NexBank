'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const transactionService = require('../services/transactionService');

const list = asyncHandler(async (req, res) => {
  return ok(res, await transactionService.list(req.user, req.query));
});

const getOne = asyncHandler(async (req, res) => {
  return ok(res, await transactionService.getByReference(req.user, req.params.reference));
});

const summary = asyncHandler(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  return ok(res, await transactionService.summaryForUser(req.user.id, { days }));
});

/** Data for the dashboard analytics cards. */
const analytics = asyncHandler(async (req, res) => {
  const months = Math.min(Number(req.query.months) || 6, 24);
  const days = Math.min(Number(req.query.days) || 30, 365);
  const [series, categories, summaryData] = await Promise.all([
    transactionService.monthlySeries(req.user.id, { months }),
    transactionService.spendingByCategory(req.user.id, { days }),
    transactionService.summaryForUser(req.user.id, { days }),
  ]);
  return ok(res, { series, categories, summary: summaryData });
});

const filters = asyncHandler(async (_req, res) => {
  return ok(res, { types: transactionService.TYPES, statuses: transactionService.STATUSES });
});

module.exports = { list, getOne, summary, analytics, filters };
