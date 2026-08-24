'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const config = require('../config/env');
const currencyService = require('../services/currencyService');
const auditService = require('../services/auditService');

const list = asyncHandler(async (req, res) => {
  return ok(res, await currencyService.list({ activeOnly: req.query.all !== 'true' }));
});

const rates = asyncHandler(async (req, res) => {
  const base = (req.query.base || config.baseCurrency).toUpperCase();
  return ok(res, await currencyService.rateTable(base));
});

const quote = asyncHandler(async (req, res) => {
  const { from, to, amount } = req.validatedQuery;
  return ok(res, await currencyService.quote(from, to, amount));
});

const createCurrency = asyncHandler(async (req, res) => {
  const currency = await currencyService.createCurrency(req.validated);
  await auditService.record({
    userId: req.user.id,
    actorEmail: req.user.email,
    action: 'currency.create',
    entityType: 'currency',
    entityId: currency.code,
    description: `Added currency ${currency.code}`,
    req,
  });
  return created(res, currency, `${currency.code} is now available.`);
});

const updateRate = asyncHandler(async (req, res) => {
  const result = await currencyService.upsertRate(req.params.code.toUpperCase(), req.validated.rate);
  await auditService.record({
    userId: req.user.id,
    actorEmail: req.user.email,
    action: 'currency.rate.update',
    entityType: 'currency',
    entityId: result.quote,
    description: `Set USD/${result.quote} rate to ${result.rate}`,
    req,
  });
  return ok(res, result, 'Exchange rate updated.');
});

const setActive = asyncHandler(async (req, res) => {
  const currency = await currencyService.setActive(req.params.code.toUpperCase(), req.validated.isActive);
  await auditService.record({
    userId: req.user.id,
    actorEmail: req.user.email,
    action: 'currency.status.update',
    entityType: 'currency',
    entityId: currency.code,
    description: `${currency.code} set to ${currency.is_active ? 'active' : 'inactive'}`,
    req,
  });
  return ok(res, currency, 'Currency updated.');
});

module.exports = { list, rates, quote, createCurrency, updateRate, setActive };
