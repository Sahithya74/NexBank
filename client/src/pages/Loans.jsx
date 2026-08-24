import { useEffect, useState } from 'react';
import Card, { StatCard } from '../components/Card';
import Button from '../components/Button';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, InlineAlert, QueryState } from '../components/States';
import { useApiQuery } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { formatDate, formatMoney } from '../utils/format';

export default function Loans() {
  const toast = useToast();
  const products = useApiQuery('/loans/products');
  const loans = useApiQuery('/loans');
  const accounts = useApiQuery('/accounts');

  const [applyOpen, setApplyOpen] = useState(false);
  const [repayTarget, setRepayTarget] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [quote, setQuote] = useState(null);

  const [form, setForm] = useState({ productId: '', amount: '', tenureMonths: '', purpose: '', accountId: '' });
  const [repayForm, setRepayForm] = useState({ accountId: '', amount: '' });

  const activeAccounts = (accounts.data ?? []).filter((account) => account.status === 'active');
  const product = (products.data ?? []).find((item) => String(item.id) === String(form.productId));

  // Live EMI quote, calculated by the server as the applicant types.
  useEffect(() => {
    if (!product || !form.amount || !form.tenureMonths || Number(form.amount) <= 0) {
      setQuote(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await api.get('/loans/quote', {
          params: { amount: form.amount, interestRate: product.interestRate, tenureMonths: form.tenureMonths },
        });
        if (!cancelled) setQuote(result);
      } catch {
        if (!cancelled) setQuote(null);
      }
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [product, form.amount, form.tenureMonths]);

  const openApply = (selectedProduct) => {
    setForm({
      productId: selectedProduct ? String(selectedProduct.id) : '',
      amount: selectedProduct ? selectedProduct.minAmount : '',
      tenureMonths: selectedProduct ? String(selectedProduct.minTenureMonths) : '',
      purpose: '',
      accountId: activeAccounts[0]?.id ?? '',
    });
    setError(null);
    setApplyOpen(true);
  };

  const submitApplication = async (event) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const loan = await api.post('/loans', {
        productId: Number(form.productId),
        amount: form.amount,
        tenureMonths: Number(form.tenureMonths),
        purpose: form.purpose || undefined,
        accountId: form.accountId ? Number(form.accountId) : undefined,
      });
      toast.success('Application submitted', `${loan.reference} is now under review.`);
      setApplyOpen(false);
      await loans.reload({ quiet: true });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPending(false);
    }
  };

  const submitRepayment = async (event) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await api.post(`/loans/${repayTarget.id}/repay`, {
        accountId: Number(repayForm.accountId),
        amount: repayForm.amount || undefined,
      });
      toast.success(
        result.status === 'closed' ? 'Loan fully repaid' : 'Repayment received',
        `Outstanding balance: ${formatMoney(result.outstanding, 'INR')}.`,
      );
      setRepayTarget(null);
      await Promise.all([loans.reload({ quiet: true }), accounts.reload({ quiet: true })]);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPending(false);
    }
  };

  const openDetail = async (loan) => {
    try {
      setDetail(await api.get(`/loans/${loan.id}`));
    } catch (caught) {
      toast.error('Could not load loan', caught.message);
    }
  };

  const activeLoans = (loans.data ?? []).filter((loan) => loan.status === 'active');
  const totalOutstanding = activeLoans.reduce((sum, loan) => sum + Number(loan.outstanding), 0);
  const totalEmi = activeLoans.reduce((sum, loan) => sum + Number(loan.emi), 0);

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Loans</h1>
          <p className="page__subtitle">Compare products, check your EMI and manage repayments.</p>
        </div>
        <div className="page__actions">
          <Button icon="plus" onClick={() => openApply(null)}>Apply for a loan</Button>
        </div>
      </div>

      <div className="stack">
        <div className="grid grid--3">
          <StatCard
            label="Total outstanding"
            value={formatMoney(totalOutstanding, 'INR')}
            meta={`${activeLoans.length} active loan${activeLoans.length === 1 ? '' : 's'}`}
            icon="loans"
            tone="navy"
          />
          <StatCard label="Monthly EMI" value={formatMoney(totalEmi, 'INR')} meta="Across active loans" icon="calendar" tone="info" />
          <StatCard
            label="Applications"
            value={(loans.data ?? []).filter((loan) => ['applied', 'under_review'].includes(loan.status)).length}
            meta="Awaiting a decision"
            icon="clock"
            tone="warning"
          />
        </div>

        <div>
          <h2 className="section-title">Available loan products</h2>
          <QueryState loading={products.loading} error={products.error} onRetry={products.reload} rows={2}>
            <div className="grid grid--4">
              {(products.data ?? []).map((item) => (
                <div className="card" key={item.id}>
                  <div className="card__body">
                    <span className="stat__icon stat__icon--navy" aria-hidden="true">
                      <Icon name="loans" size={18} />
                    </span>
                    <h3 style={{ fontSize: 14.5, marginTop: 12 }}>{item.name}</h3>
                    <p className="card__subtitle" style={{ minHeight: 34 }}>{item.description}</p>
                    <div className="row row--between" style={{ marginTop: 12 }}>
                      <span>
                        <span className="stat__label">Interest</span>
                        <div style={{ fontWeight: 650, fontSize: 17 }}>{item.interestRate}%</div>
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        <span className="stat__label">Up to</span>
                        <div style={{ fontWeight: 600 }}>
                          {formatMoney(item.maxAmount, 'INR', { compact: true })}
                        </div>
                      </span>
                    </div>
                    <p className="field__hint" style={{ marginTop: 8 }}>
                      {item.minTenureMonths}–{item.maxTenureMonths} months
                    </p>
                    <Button variant="secondary" block style={{ marginTop: 12 }} onClick={() => openApply(item)}>
                      Apply
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </QueryState>
        </div>

        <Card title="Your loans" subtitle="Applications and active loans" flush>
          <QueryState
            loading={loans.loading}
            error={loans.error}
            onRetry={loans.reload}
            isEmpty={loans.data?.length === 0}
            rows={3}
            empty={
              <EmptyState
                icon="loans"
                title="No loans yet"
                text="Apply for a loan and track its progress here."
                action={<Button icon="plus" onClick={() => openApply(null)}>Apply for a loan</Button>}
              />
            }
          >
            <div className="table-wrap">
              <table className="table table--stack">
                <thead>
                  <tr>
                    <th>Loan</th>
                    <th>Applied</th>
                    <th className="num">Principal</th>
                    <th className="num">Outstanding</th>
                    <th className="num">EMI</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(loans.data ?? []).map((loan) => (
                    <tr key={loan.id}>
                      <td data-label="Loan">
                        <div className="cell-title">{loan.productName}</div>
                        <div className="cell-sub mono">{loan.reference}</div>
                      </td>
                      <td data-label="Applied">{formatDate(loan.appliedAt)}</td>
                      <td data-label="Principal" className="num">{formatMoney(loan.principal, loan.currency)}</td>
                      <td data-label="Outstanding" className="num">{formatMoney(loan.outstanding, loan.currency)}</td>
                      <td data-label="EMI" className="num">{formatMoney(loan.emi, loan.currency)}</td>
                      <td data-label="Status"><StatusBadge status={loan.status} /></td>
                      <td data-label="Action">
                        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                          <Button size="sm" variant="secondary" onClick={() => openDetail(loan)}>Details</Button>
                          {loan.status === 'active' ? (
                            <Button
                              size="sm"
                              onClick={() => {
                                setRepayTarget(loan);
                                setRepayForm({ accountId: activeAccounts[0]?.id ?? '', amount: loan.emi });
                                setError(null);
                              }}
                            >
                              Repay
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QueryState>
        </Card>
      </div>

      {/* Apply */}
      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title="Apply for a loan"
        subtitle="Your EMI is calculated before you submit."
        footer={
          <>
            <Button variant="secondary" onClick={() => setApplyOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submitApplication} loading={pending} disabled={!quote}>Submit application</Button>
          </>
        }
      >
        <form onSubmit={submitApplication} className="stack" style={{ gap: 14 }}>
          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

          <FormField
            label="Loan product"
            as="select"
            value={form.productId}
            onChange={(event) => {
              const next = (products.data ?? []).find((item) => String(item.id) === event.target.value);
              setForm((current) => ({
                ...current,
                productId: event.target.value,
                amount: next ? next.minAmount : '',
                tenureMonths: next ? String(next.minTenureMonths) : '',
              }));
            }}
            required
          >
            <option value="">Select a product</option>
            {(products.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {item.interestRate}% p.a.
              </option>
            ))}
          </FormField>

          {product ? (
            <>
              <FormField
                label="Loan amount (INR)"
                type="number"
                step="1000"
                min={product.minAmount}
                max={product.maxAmount}
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                hint={`Between ${formatMoney(product.minAmount, 'INR')} and ${formatMoney(product.maxAmount, 'INR')}`}
                required
              />
              <FormField
                label="Tenure (months)"
                type="number"
                min={product.minTenureMonths}
                max={product.maxTenureMonths}
                value={form.tenureMonths}
                onChange={(event) => setForm((current) => ({ ...current, tenureMonths: event.target.value }))}
                hint={`Between ${product.minTenureMonths} and ${product.maxTenureMonths} months`}
                required
              />
              <FormField
                label="Disbursement account"
                as="select"
                value={form.accountId}
                onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
              >
                <option value="">Choose later</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountNumberMasked} · {formatMoney(account.balance, account.currency)}
                  </option>
                ))}
              </FormField>
              <FormField
                label="Purpose (optional)"
                as="textarea"
                rows={2}
                value={form.purpose}
                onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))}
              />

              <div className="card" style={{ background: 'var(--surface-muted)' }}>
                <div className="card__body">
                  {quote ? (
                    <div className="review-list">
                      <div className="review-row">
                        <span className="review-row__label">Interest rate</span>
                        <span className="review-row__value">{product.interestRate}% per annum</span>
                      </div>
                      <div className="review-row">
                        <span className="review-row__label">Total interest</span>
                        <span className="review-row__value">{formatMoney(quote.totalInterest, 'INR')}</span>
                      </div>
                      <div className="review-row">
                        <span className="review-row__label">Total payable</span>
                        <span className="review-row__value">{formatMoney(quote.totalPayable, 'INR')}</span>
                      </div>
                      <div className="review-row review-row--total">
                        <span className="review-row__label">Monthly EMI</span>
                        <span className="review-row__value">{formatMoney(quote.emi, 'INR')}</span>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                      Enter an amount and tenure to see your EMI.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </form>
      </Modal>

      {/* Repay */}
      <Modal
        open={Boolean(repayTarget)}
        onClose={() => setRepayTarget(null)}
        title="Make a repayment"
        subtitle={repayTarget ? `${repayTarget.productName} · ${repayTarget.reference}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRepayTarget(null)} disabled={pending}>Cancel</Button>
            <Button onClick={submitRepayment} loading={pending} icon="lock">Pay now</Button>
          </>
        }
      >
        <form onSubmit={submitRepayment} className="stack" style={{ gap: 14 }}>
          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

          <FormField
            label="Pay from"
            as="select"
            value={repayForm.accountId}
            onChange={(event) => setRepayForm((current) => ({ ...current, accountId: event.target.value }))}
            required
          >
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.accountNumberMasked} · {formatMoney(account.balance, account.currency)}
              </option>
            ))}
          </FormField>

          <FormField
            label="Amount (INR)"
            type="number"
            step="0.01"
            min="0"
            value={repayForm.amount}
            onChange={(event) => setRepayForm((current) => ({ ...current, amount: event.target.value }))}
            hint={
              repayTarget
                ? `EMI ${formatMoney(repayTarget.emi, 'INR')} · outstanding ${formatMoney(repayTarget.outstanding, 'INR')}`
                : undefined
            }
            required
          />
        </form>
      </Modal>

      {/* Detail */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Loan details"
        subtitle={detail?.reference}
        footer={<Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>}
      >
        {detail ? (
          <div className="stack" style={{ gap: 18 }}>
            <dl className="dl">
              <dt>Product</dt>
              <dd>{detail.productName}</dd>
              <dt>Status</dt>
              <dd><StatusBadge status={detail.status} /></dd>
              <dt>Principal</dt>
              <dd>{formatMoney(detail.principal, detail.currency)}</dd>
              <dt>Outstanding</dt>
              <dd>{formatMoney(detail.outstanding, detail.currency)}</dd>
              <dt>Repaid so far</dt>
              <dd>{formatMoney(detail.repaidAmount, detail.currency)}</dd>
              <dt>Interest rate</dt>
              <dd>{detail.interestRate}% per annum</dd>
              <dt>Tenure</dt>
              <dd>{detail.tenureMonths} months</dd>
              <dt>Monthly EMI</dt>
              <dd>{formatMoney(detail.emi, detail.currency)}</dd>
              <dt>Applied on</dt>
              <dd>{formatDate(detail.appliedAt)}</dd>
              {detail.decidedAt ? (
                <>
                  <dt>Decided</dt>
                  <dd>{formatDate(detail.decidedAt)} {detail.decidedBy ? `by ${detail.decidedBy}` : ''}</dd>
                </>
              ) : null}
              {detail.decisionNote ? (
                <>
                  <dt>Note</dt>
                  <dd>{detail.decisionNote}</dd>
                </>
              ) : null}
            </dl>

            <div>
              <h3 className="card__title" style={{ marginBottom: 8 }}>Repayment history</h3>
              {detail.payments.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>No repayments recorded yet.</p>
              ) : (
                <div className="timeline">
                  {detail.payments.map((payment) => (
                    <div className="timeline__item" key={payment.reference}>
                      <span className="timeline__dot" aria-hidden="true" />
                      <div style={{ flex: 1 }}>
                        <div className="row row--between">
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            {formatMoney(payment.amount, detail.currency)}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {formatDate(payment.paid_at)}
                          </span>
                        </div>
                        <div className="cell-sub mono">{payment.reference}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
