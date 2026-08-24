'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const cardService = require('../services/cardService');

const list = asyncHandler(async (req, res) => {
  return ok(res, await cardService.listForUser(req.user.id));
});

const getOne = asyncHandler(async (req, res) => {
  return ok(res, await cardService.getForUser(req.user.id, req.params.id));
});

const setStatus = asyncHandler(async (req, res) => {
  const card = await cardService.setStatus(req.user, req.params.id, req.validated.status, req);
  return ok(res, card, `Card ${req.validated.status === 'blocked' ? 'blocked' : 'unblocked'}.`);
});

const updateControls = asyncHandler(async (req, res) => {
  const card = await cardService.updateControls(req.user, req.params.id, req.validated, req);
  return ok(res, card, 'Card controls updated.');
});

const transactions = asyncHandler(async (req, res) => {
  return ok(res, await cardService.cardTransactions(req.user.id, req.params.id, req.query));
});

const listAll = asyncHandler(async (req, res) => {
  return ok(res, await cardService.listAll(req.query));
});

module.exports = { list, getOne, setStatus, updateControls, transactions, listAll };
