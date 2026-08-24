'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const loanService = require('../services/loanService');

const products = asyncHandler(async (_req, res) => {
  return ok(res, await loanService.listProducts());
});

/** EMI calculator - pure arithmetic, no records created. */
const quote = asyncHandler(async (req, res) => {
  const { amount, interestRate, tenureMonths } = req.validatedQuery;
  return ok(res, loanService.quote(amount, interestRate, tenureMonths));
});

const listMine = asyncHandler(async (req, res) => {
  return ok(res, await loanService.listForUser(req.user.id));
});

const getOne = asyncHandler(async (req, res) => {
  return ok(res, await loanService.getForUser(req.user.id, req.params.id));
});

const apply = asyncHandler(async (req, res) => {
  const loan = await loanService.apply(req.user, req.validated, req);
  return created(res, loan, `Application ${loan.reference} submitted for review.`);
});

const repay = asyncHandler(async (req, res) => {
  const result = await loanService.repay(req.user, req.params.id, req.validated, req);
  return created(
    res,
    result,
    result.status === 'closed' ? 'Final repayment received - this loan is now closed.' : 'Repayment received.',
  );
});

const listAll = asyncHandler(async (req, res) => {
  return ok(res, await loanService.listAll(req.query));
});

const review = asyncHandler(async (req, res) => {
  return ok(res, await loanService.markUnderReview(req.user, req.params.id, req), 'Loan moved into review.');
});

const decide = asyncHandler(async (req, res) => {
  const loan = await loanService.decide(req.user, req.params.id, req.validated, req);
  return ok(
    res,
    loan,
    req.validated.decision === 'approve'
      ? `${loan.reference} approved and disbursed.`
      : `${loan.reference} rejected.`,
  );
});

module.exports = { products, quote, listMine, getOne, apply, repay, listAll, review, decide };
