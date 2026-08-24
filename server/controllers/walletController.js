'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const config = require('../config/env');
const walletService = require('../services/walletService');
const currencyService = require('../services/currencyService');

const baseFrom = (req) => (req.query.base || config.baseCurrency).toUpperCase();

const overview = asyncHandler(async (req, res) => {
  return ok(res, await walletService.overview(req.user.id, baseFrom(req)));
});

const addCurrency = asyncHandler(async (req, res) => {
  const result = await walletService.addCurrency(req.user, req.validated.currency, req);
  return created(res, result, `${req.validated.currency} added to your wallet.`);
});

const removeCurrency = asyncHandler(async (req, res) => {
  const result = await walletService.removeCurrency(req.user, req.params.code.toUpperCase(), req);
  return ok(res, result, `${req.params.code.toUpperCase()} removed from your wallet.`);
});

/** Preview a conversion. Read-only: no balance is touched. */
const quote = asyncHandler(async (req, res) => {
  const { from, to, amount } = req.validatedQuery;
  return ok(res, await currencyService.quote(from, to, amount));
});

const convert = asyncHandler(async (req, res) => {
  const result = await walletService.convertCurrency(req.user, req.validated, req);
  return created(
    res,
    result,
    `Converted ${result.fromAmount} ${result.from} to ${result.toAmount} ${result.to}.`,
  );
});

const transfer = asyncHandler(async (req, res) => {
  const result = await walletService.transferToWallet(req.user, req.validated, req);
  return created(res, result, `${result.amount} ${result.currency} sent to ${result.recipient}.`);
});

const conversionHistory = asyncHandler(async (req, res) => {
  return ok(res, await walletService.conversionHistory(req.user.id, req.query));
});

const transactions = asyncHandler(async (req, res) => {
  return ok(res, await walletService.walletTransactions(req.user.id, req.query));
});

/** Staff monitoring view. */
const listAll = asyncHandler(async (req, res) => {
  return ok(res, await walletService.listAllWallets(req.query, baseFrom(req)));
});

module.exports = {
  overview,
  addCurrency,
  removeCurrency,
  quote,
  convert,
  transfer,
  conversionHistory,
  transactions,
  listAll,
};
