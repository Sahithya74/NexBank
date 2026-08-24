'use strict';

const { pool, query, queryOne, withTransaction } = require('../config/db');
const { notFound, badRequest, forbidden } = require('../utils/AppError');
const { generateReference } = require('../utils/reference');
const { parsePagination } = require('../utils/validate');
const money = require('../utils/money');
const auditService = require('./auditService');
const notificationService = require('./notificationService');

const OPEN_STATUSES = ['applied', 'under_review', 'approved', 'active'];

/**
 * Standard reducing-balance EMI:  P * r * (1+r)^n / ((1+r)^n - 1)
 * This is a quote, not a balance, so floating point is acceptable here; the result
 * is rounded to two decimals and stored as DECIMAL.
 */
function calculateEmi(principal, annualRate, tenureMonths) {
  const p = Number(principal);
  const n = Number(tenureMonths);
  const r = Number(annualRate) / 12 / 100;

  if (!Number.isFinite(p) || !Number.isFinite(n) || n <= 0) {
    throw badRequest('Enter a valid loan amount and tenure.', 'INVALID_LOAN_TERMS');
  }
  if (r === 0) return (p / n).toFixed(2);

  const factor = (1 + r) ** n;
  return ((p * r * factor) / (factor - 1)).toFixed(2);
}

/** Amortisation summary shown before an application is submitted. */
function quote(principal, annualRate, tenureMonths) {
  const emi = calculateEmi(principal, annualRate, tenureMonths);
  const totalPayable = (Number(emi) * Number(tenureMonths)).toFixed(2);
  const totalInterest = (Number(totalPayable) - Number(principal)).toFixed(2);
  return {
    principal: String(principal),
    interestRate: String(annualRate),
    tenureMonths: Number(tenureMonths),
    emi,
    totalPayable,
    totalInterest,
  };
}

function toDTO(row) {
  return {
    id: row.id,
    reference: row.reference,
    productId: row.product_id,
    productName: row.product_name,
    principal: String(row.principal),
    interestRate: String(row.interest_rate),
    tenureMonths: row.tenure_months,
    emi: String(row.emi_amount),
    outstanding: String(row.outstanding),
    currency: row.currency_code,
    purpose: row.purpose,
    status: row.status,
    decisionNote: row.decision_note,
    decidedAt: row.decided_at,
    decidedBy: row.officer_name,
    appliedAt: row.created_at,
    customer: row.customer_name,
    customerEmail: row.customer_email,
    repaidAmount: row.principal ? money.fromScaled(
      money.toScaled(String(row.principal)) - money.toScaled(String(row.outstanding)),
      2,
    ) : '0.00',
  };
}

const SELECT_LOAN = `
  SELECT l.*, p.name AS product_name, u.full_name AS customer_name, u.email AS customer_email,
         o.full_name AS officer_name
    FROM loans l
    JOIN loan_products p ON p.id = l.product_id
    JOIN users u ON u.id = l.user_id
    LEFT JOIN users o ON o.id = l.decided_by`;

async function listProducts() {
  const rows = await query(
    `SELECT id, name, description, interest_rate, min_amount, max_amount,
            min_tenure_months, max_tenure_months
       FROM loan_products WHERE is_active = 1 ORDER BY interest_rate ASC`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    interestRate: String(row.interest_rate),
    minAmount: String(row.min_amount),
    maxAmount: String(row.max_amount),
    minTenureMonths: row.min_tenure_months,
    maxTenureMonths: row.max_tenure_months,
  }));
}

async function listForUser(userId) {
  const rows = await query(`${SELECT_LOAN} WHERE l.user_id = ? ORDER BY l.created_at DESC`, [userId]);
  return rows.map(toDTO);
}

async function getForUser(userId, loanId) {
  const row = await queryOne(`${SELECT_LOAN} WHERE l.id = ?`, [loanId]);
  if (!row) throw notFound('That loan could not be found.');
  if (String(row.user_id) !== String(userId)) {
    throw forbidden('You do not have access to that loan.');
  }

  const payments = await query(
    'SELECT reference, amount, status, paid_at FROM loan_payments WHERE loan_id = ? ORDER BY paid_at DESC',
    [loanId],
  );
  return {
    ...toDTO(row),
    payments: payments.map((payment) => ({ ...payment, amount: String(payment.amount) })),
  };
}

/** Submit a loan application. Applications start in review; no money moves yet. */
async function apply(user, payload, req) {
  const product = await queryOne(
    'SELECT * FROM loan_products WHERE id = ? AND is_active = 1',
    [payload.productId],
  );
  if (!product) throw notFound('That loan product is not available.');

  const principal = money.normaliseAmount(payload.amount, {
    decimals: 2,
    min: String(product.min_amount),
    max: String(product.max_amount),
    label: 'Loan amount',
  });

  const tenure = Number(payload.tenureMonths);
  if (tenure < product.min_tenure_months || tenure > product.max_tenure_months) {
    throw badRequest(
      `Tenure for this product must be between ${product.min_tenure_months} and ${product.max_tenure_months} months.`,
      'INVALID_TENURE',
    );
  }

  const openLoan = await queryOne(
    `SELECT id FROM loans WHERE user_id = ? AND product_id = ? AND status IN ('applied','under_review')`,
    [user.id, product.id],
  );
  if (openLoan) {
    throw badRequest('You already have an application in progress for this product.', 'APPLICATION_IN_PROGRESS');
  }

  const emi = calculateEmi(principal, product.interest_rate, tenure);
  const reference = generateReference('LON');

  const loanId = await withTransaction(async (conn) => {
    const [result] = await conn.execute(
      `INSERT INTO loans
         (reference, user_id, product_id, account_id, principal, interest_rate, tenure_months,
          emi_amount, outstanding, currency_code, purpose, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, 'under_review')`,
      [reference, user.id, product.id, payload.accountId || null, principal,
        product.interest_rate, tenure, emi, principal, payload.purpose || null],
    );

    await notificationService.create({
      connection: conn,
      userId: user.id,
      title: 'Loan application received',
      message: `Your ${product.name} application ${reference} is under review.`,
      type: 'system',
    });
    await auditService.record({
      connection: conn,
      userId: user.id,
      actorEmail: user.email,
      action: 'loan.apply',
      entityType: 'loan',
      entityId: reference,
      description: `Applied for ${product.name} of ${principal} over ${tenure} months`,
      req,
    });
    return result.insertId;
  });

  return getForUser(user.id, loanId);
}

/** Repay an instalment from a bank account. */
async function repay(user, loanId, { accountId, amount }, req) {
  const loan = await queryOne(`${SELECT_LOAN} WHERE l.id = ?`, [loanId]);
  if (!loan) throw notFound('That loan could not be found.');
  if (String(loan.user_id) !== String(user.id)) throw forbidden('You do not have access to that loan.');
  if (loan.status !== 'active') {
    throw badRequest('Only active loans can be repaid.', 'LOAN_NOT_ACTIVE');
  }

  const account = await queryOne(
    'SELECT id, user_id, currency_code, status FROM accounts WHERE id = ?',
    [accountId],
  );
  if (!account) throw notFound('That account could not be found.');
  if (String(account.user_id) !== String(user.id)) throw forbidden('You do not have access to that account.');
  if (account.status !== 'active') throw badRequest('That account is not active.', 'ACCOUNT_INACTIVE');

  const outstanding = String(loan.outstanding);
  const payment = money.normaliseAmount(amount || String(loan.emi_amount), {
    decimals: 2,
    max: outstanding,
    label: 'Repayment amount',
  });

  return withTransaction(async (conn) => {
    const [locked] = await conn.execute('SELECT balance FROM accounts WHERE id = ? FOR UPDATE', [accountId]);
    if (money.compare(String(locked[0].balance), payment) < 0) {
      throw badRequest(
        `Insufficient balance. Available: ${locked[0].balance} ${account.currency_code}.`,
        'INSUFFICIENT_FUNDS',
      );
    }

    const [debit] = await conn.execute(
      'UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?',
      [payment, accountId, payment],
    );
    if (debit.affectedRows !== 1) {
      throw badRequest('Insufficient balance for this repayment.', 'INSUFFICIENT_FUNDS');
    }

    const [loanUpdate] = await conn.execute(
      'UPDATE loans SET outstanding = outstanding - ? WHERE id = ? AND outstanding >= ?',
      [payment, loanId, payment],
    );
    if (loanUpdate.affectedRows !== 1) {
      throw badRequest('That repayment exceeds the outstanding balance.', 'AMOUNT_TOO_LARGE');
    }

    const [[loanRow]] = await conn.execute('SELECT outstanding FROM loans WHERE id = ?', [loanId]);
    const remaining = String(loanRow.outstanding);
    if (money.compare(remaining, '0') === 0) {
      await conn.execute("UPDATE loans SET status = 'closed' WHERE id = ?", [loanId]);
    }

    const [[balanceRow]] = await conn.execute('SELECT balance FROM accounts WHERE id = ?', [accountId]);
    const reference = generateReference('LPY');

    await conn.execute(
      `INSERT INTO loan_payments (reference, loan_id, user_id, account_id, amount, status)
       VALUES (?, ?, ?, ?, ?, 'completed')`,
      [reference, loanId, user.id, accountId, payment],
    );
    await conn.execute(
      `INSERT INTO transactions
         (reference, user_id, account_id, type, direction, description, counterparty_name,
          amount, currency_code, balance_after, status)
       VALUES (?, ?, ?, 'loan_repayment', 'debit', ?, 'NexBank Loans', ?, ?, ?, 'completed')`,
      [`${reference}D`, user.id, accountId, `${loan.product_name} repayment`,
        payment, account.currency_code, String(balanceRow.balance)],
    );

    await notificationService.create({
      connection: conn,
      userId: user.id,
      title: money.compare(remaining, '0') === 0 ? 'Loan closed' : 'Loan repayment received',
      message: money.compare(remaining, '0') === 0
        ? `Your ${loan.product_name} ${loan.reference} is fully repaid and now closed.`
        : `Repayment of ${payment} received. Outstanding balance: ${remaining}.`,
      type: 'payment',
    });
    await auditService.record({
      connection: conn,
      userId: user.id,
      actorEmail: user.email,
      action: 'loan.repay',
      entityType: 'loan',
      entityId: loan.reference,
      description: `Repaid ${payment} against ${loan.reference}`,
      req,
    });

    return {
      reference,
      amount: payment,
      outstanding: remaining,
      status: money.compare(remaining, '0') === 0 ? 'closed' : 'active',
      balanceAfter: String(balanceRow.balance),
    };
  });
}

/** Staff view of all applications. */
async function listAll(filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20 });

  const where = [];
  const params = [];
  if (filters.status) {
    where.push('l.status = ?');
    params.push(filters.status);
  }
  if (filters.q) {
    where.push('(l.reference LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `${SELECT_LOAN} ${whereSql} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)],
  );
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM loans l JOIN users u ON u.id = l.user_id ${whereSql}`,
    params,
  );

  return { items: rows.map(toDTO), pagination: { page, limit, total: Number(total) } };
}

/**
 * Manager decision. Approving disburses the principal into the customer's account
 * and moves the loan to active - balance update, ledger entry and status change all
 * inside one transaction.
 */
async function decide(actor, loanId, { decision, note, accountId }, req) {
  const loan = await queryOne(`${SELECT_LOAN} WHERE l.id = ?`, [loanId]);
  if (!loan) throw notFound('That loan could not be found.');
  if (!OPEN_STATUSES.includes(loan.status) || loan.status === 'active') {
    throw badRequest('This application has already been decided.', 'LOAN_ALREADY_DECIDED');
  }

  if (decision === 'reject') {
    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE loans SET status = 'rejected', decided_by = ?, decided_at = NOW(), decision_note = ?
          WHERE id = ?`,
        [actor.id, note || null, loanId],
      );
      await notificationService.create({
        connection: conn,
        userId: loan.user_id,
        title: 'Loan application declined',
        message: `Your ${loan.product_name} application ${loan.reference} was not approved.${note ? ` Reason: ${note}` : ''}`,
        type: 'system',
      });
      await auditService.record({
        connection: conn,
        userId: actor.id,
        actorEmail: actor.email,
        action: 'loan.reject',
        entityType: 'loan',
        entityId: loan.reference,
        description: `Rejected ${loan.reference}${note ? `: ${note}` : ''}`,
        req,
      });
    });
    const updated = await queryOne(`${SELECT_LOAN} WHERE l.id = ?`, [loanId]);
    return toDTO(updated);
  }

  const targetAccountId = accountId || loan.account_id;
  const account = await queryOne(
    'SELECT id, user_id, currency_code, status FROM accounts WHERE id = ?',
    [targetAccountId],
  );
  if (!account) throw badRequest('Select a disbursement account for this customer.', 'ACCOUNT_REQUIRED');
  if (String(account.user_id) !== String(loan.user_id)) {
    throw badRequest('The disbursement account does not belong to the applicant.', 'ACCOUNT_MISMATCH');
  }
  if (account.status !== 'active') {
    throw badRequest('The disbursement account is not active.', 'ACCOUNT_INACTIVE');
  }

  const principal = String(loan.principal);

  await withTransaction(async (conn) => {
    await conn.execute('SELECT id FROM accounts WHERE id = ? FOR UPDATE', [targetAccountId]);
    await conn.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', [principal, targetAccountId]);

    const [update] = await conn.execute(
      `UPDATE loans SET status = 'active', account_id = ?, outstanding = principal,
              decided_by = ?, decided_at = NOW(), decision_note = ?
        WHERE id = ? AND status IN ('applied','under_review','approved')`,
      [targetAccountId, actor.id, note || null, loanId],
    );
    if (update.affectedRows !== 1) {
      throw badRequest('This application has already been decided.', 'LOAN_ALREADY_DECIDED');
    }

    const [[balanceRow]] = await conn.execute('SELECT balance FROM accounts WHERE id = ?', [targetAccountId]);

    await conn.execute(
      `INSERT INTO transactions
         (reference, user_id, account_id, type, direction, description, counterparty_name,
          amount, currency_code, balance_after, status)
       VALUES (?, ?, ?, 'loan_disbursement', 'credit', ?, 'NexBank Loans', ?, ?, ?, 'completed')`,
      [generateReference('TXN'), loan.user_id, targetAccountId,
        `${loan.product_name} disbursement`, principal, account.currency_code, String(balanceRow.balance)],
    );

    await notificationService.create({
      connection: conn,
      userId: loan.user_id,
      title: 'Loan approved',
      message: `Your ${loan.product_name} of ${principal} has been approved and disbursed. EMI: ${loan.emi_amount}.`,
      type: 'system',
    });
    await auditService.record({
      connection: conn,
      userId: actor.id,
      actorEmail: actor.email,
      action: 'loan.approve',
      entityType: 'loan',
      entityId: loan.reference,
      description: `Approved ${loan.reference} and disbursed ${principal}`,
      req,
    });
  });

  const updated = await queryOne(`${SELECT_LOAN} WHERE l.id = ?`, [loanId]);
  return toDTO(updated);
}

/** Move an application into review (employee/manager triage). */
async function markUnderReview(actor, loanId, req) {
  const [result] = await pool.execute(
    "UPDATE loans SET status = 'under_review' WHERE id = ? AND status = 'applied'",
    [loanId],
  );
  if (result.affectedRows !== 1) {
    throw badRequest('Only new applications can be moved into review.', 'INVALID_LOAN_STATUS');
  }
  await auditService.record({
    userId: actor.id,
    actorEmail: actor.email,
    action: 'loan.review',
    entityType: 'loan',
    entityId: loanId,
    description: 'Moved loan application into review',
    req,
  });
  const row = await queryOne(`${SELECT_LOAN} WHERE l.id = ?`, [loanId]);
  return toDTO(row);
}

module.exports = {
  calculateEmi,
  quote,
  listProducts,
  listForUser,
  getForUser,
  apply,
  repay,
  listAll,
  decide,
  markUnderReview,
};
