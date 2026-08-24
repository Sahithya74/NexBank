'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const beneficiaryService = require('../services/beneficiaryService');

const list = asyncHandler(async (req, res) => {
  return ok(res, await beneficiaryService.listForUser(req.user.id));
});

const create = asyncHandler(async (req, res) => {
  const beneficiary = await beneficiaryService.create(req.user, req.validated, req);
  return created(res, beneficiary, `${beneficiary.nickname} has been added.`);
});

const update = asyncHandler(async (req, res) => {
  const beneficiary = await beneficiaryService.update(req.user, req.params.id, req.validated, req);
  return ok(res, beneficiary, 'Beneficiary updated.');
});

const remove = asyncHandler(async (req, res) => {
  const result = await beneficiaryService.remove(req.user, req.params.id, req);
  return ok(res, result, 'Beneficiary removed.');
});

/** Confirm the holder name before a beneficiary is saved. */
const verify = asyncHandler(async (req, res) => {
  return ok(res, await beneficiaryService.verifyAccount(req.validatedQuery.accountNumber));
});

module.exports = { list, create, update, remove, verify };
