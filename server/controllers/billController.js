'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const billService = require('../services/billService');

const billers = asyncHandler(async (req, res) => {
  return ok(res, await billService.listBillers(req.query.category || null));
});

const list = asyncHandler(async (req, res) => {
  return ok(res, await billService.listForUser(req.user.id, req.query));
});

const add = asyncHandler(async (req, res) => {
  const bill = await billService.addBill(req.user, req.validated, req);
  return created(res, bill, `${bill.billerName} bill added.`);
});

const remove = asyncHandler(async (req, res) => {
  const result = await billService.removeBill(req.user, req.params.id, req);
  return ok(res, result, 'Bill removed.');
});

const pay = asyncHandler(async (req, res) => {
  const result = await billService.payBill(
    req.user,
    { billId: req.params.id, accountId: req.validated.accountId },
    req,
  );
  return created(res, result, `${result.biller} bill paid successfully.`);
});

const history = asyncHandler(async (req, res) => {
  return ok(res, await billService.paymentHistory(req.user.id, req.query));
});

module.exports = { billers, list, add, remove, pay, history };
