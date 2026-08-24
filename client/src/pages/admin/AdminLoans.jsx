import { useState } from 'react';
import Card, { StatCard } from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import Modal from '../../components/Modal';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, InlineAlert } from '../../components/States';
import { useApiQuery, useDebounced } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { formatDate, formatMoney, formatNumber } from '../../utils/format';

/** Loan review queue. Approving disburses the principal into the customer's account. */
export default function AdminLoans() {
  const { can } = useAuth();
  const toast = useToast();

  const [filters, setFilters] = useState({ q: '', status: '' });
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebounced(filters.q, 350);

  const loans = useApiQuery('/loans/all', {
    params: {
      page,
      limit: 10,
      q: debouncedQuery || undefined,
      status: filters.status || undefined,
    },
  });

  const [decisionTarget, setDecisionTarget] = useState(null);
  const [decision, setDecision] = useState('approve');
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('');
  const [customerAccounts, setCustomerAccounts] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const canDecide = can('loan.approve');
  const canReview = can('loan.review');

  const openDecision = async (loan) => {
    setDecisionTarget(loan);
    setDecision('approve');
    setNote('');
    setError(null);
    setAccountId('');
    try {
      const result = await api.get('/accounts/all', { params: { userId: loan.userId, limit: 20 } });
      const active = (result.items ?? []).filter((account) => account.status === 'active');
      setCustomerAccounts(active);
      setAccountId(active[0]?.id ?? '');
    } catch {
      setCustomerAccounts([]);
    }
  };

  const submitDecision = async (event) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await api.patch(`/loans/${decisionTarget.id}/decision`, {
        decision,
        note: note.trim() || undefined,
        accountId: decision === 'approve' && accountId ? Number(accountId) : undefined,
      });
      toast.success(
        decision === 'approve' ? 'Loan approved and disbursed' : 'Loan rejected',
        `${result.reference} is now ${result.status}.`,
      );
      setDecisionTarget(null);
      await loans.reload({ quiet: true });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPending(false);
    }
  };

  const moveToReview = async (loan) => {
    try {
      await api.patch(`/loans/${loan.id}/review`);
      toast.success('Moved into review', `${loan.reference} is now under review.`);
      await loans.reload({ quiet: true });
    } catch (caught) {
      toast.error('Could not update loan', caught.message);
    }
  };

  const items = loans.data?.items ?? [];
  const pendingCount = items.filter((loan) => ['applied', 'under_review'].includes(loan.status)).length;
  const activeCount = items.filter((loan) => loan.status === 'active').length;
  const portfolio = items
    .filter((loan) => loan.status === 'active')
    .reduce((sum, loan) => sum + Number(loan.outstanding), 0);

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Loan management</h1>
          <p className="page__subtitle">Review applications, approve disbursements and track the portfolio.</p>
        </div>
      </div>

      <div className="stack">
        <div className="grid grid--3">
          <StatCard
            label="Awaiting decision"
            value={formatNumber(pendingCount)}
            meta="On this page"
            icon="clock"
            tone={pendingCount > 0 ? 'warning' : 'success'}
          />
          <StatCard label="Active loans" value={formatNumber(activeCount)} icon="loans" tone="info" />
          <StatCard
            label="Outstanding"
            value={formatMoney(portfolio, 'INR', { compact: true })}
            meta="Across active loans shown"
            icon="reports"
            tone="navy"
          />
        </div>

        <Card flush>
          <div className="filter-bar">
            <FormField
              label="Search"
              className="field--grow"
              type="search"
              placeholder="Reference, customer name or email"
              value={filters.q}
              onChange={(event) => {
                setFilters((current) => ({ ...current, q: event.target.value }));
                setPage(1);
              }}
            />
            <FormField
              label="Status"
              as="select"
              value={filters.status}
              onChange={(event) => {
                setFilters((current) => ({ ...current, status: event.target.value }));
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="applied">Applied</option>
              <option value="under_review">Under review</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
              <option value="closed">Closed</option>
            </FormField>
          </div>

          <DataTable
            columns={[
              {
                key: 'reference',
                header: 'Application',
                render: (row) => (
                  <>
                    <div className="cell-title">{row.productName}</div>
                    <div className="cell-sub mono">{row.reference}</div>
                  </>
                ),
              },
              {
                key: 'customer',
                header: 'Customer',
                render: (row) => (
                  <>
                    <div className="cell-title">{row.customer}</div>
                    <div className="cell-sub">{row.customerEmail}</div>
                  </>
                ),
              },
              { key: 'appliedAt', header: 'Applied', render: (row) => formatDate(row.appliedAt) },
              {
                key: 'principal',
                header: 'Principal',
                align: 'right',
                render: (row) => formatMoney(row.principal, row.currency),
              },
              {
                key: 'emi',
                header: 'EMI',
                align: 'right',
                render: (row) => (
                  <>
                    {formatMoney(row.emi, row.currency)}
                    <div className="cell-sub">{row.tenureMonths} months @ {row.interestRate}%</div>
                  </>
                ),
              },
              {
                key: 'outstanding',
                header: 'Outstanding',
                align: 'right',
                render: (row) => formatMoney(row.outstanding, row.currency),
              },
              { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              {
                key: 'actions',
                header: 'Actions',
                render: (row) => (
                  <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    {canReview && row.status === 'applied' ? (
                      <Button size="sm" variant="secondary" onClick={() => moveToReview(row)}>
                        Start review
                      </Button>
                    ) : null}
                    {canDecide && ['applied', 'under_review'].includes(row.status) ? (
                      <Button size="sm" onClick={() => openDecision(row)}>Decide</Button>
                    ) : null}
                    {!['applied', 'under_review'].includes(row.status) ? (
                      <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                        {row.decidedBy ? `Decided by ${row.decidedBy}` : '—'}
                      </span>
                    ) : null}
                  </div>
                ),
              },
            ]}
            rows={items}
            loading={loans.loading}
            error={loans.error}
            onRetry={loans.reload}
            pagination={loans.data?.pagination}
            onPageChange={setPage}
            caption="Loan applications"
            empty={<EmptyState icon="loans" title="No loan applications match these filters" />}
          />
        </Card>
      </div>

      <Modal
        open={Boolean(decisionTarget)}
        onClose={() => setDecisionTarget(null)}
        title="Loan decision"
        subtitle={decisionTarget ? `${decisionTarget.reference} · ${decisionTarget.customer}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecisionTarget(null)} disabled={pending}>Cancel</Button>
            <Button
              variant={decision === 'approve' ? 'primary' : 'danger'}
              onClick={submitDecision}
              loading={pending}
              disabled={decision === 'approve' && !accountId}
            >
              {decision === 'approve' ? 'Approve and disburse' : 'Reject application'}
            </Button>
          </>
        }
      >
        <form onSubmit={submitDecision} className="stack" style={{ gap: 14 }}>
          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

          {decisionTarget ? (
            <div className="review-list">
              <div className="review-row">
                <span className="review-row__label">Product</span>
                <span className="review-row__value">{decisionTarget.productName}</span>
              </div>
              <div className="review-row">
                <span className="review-row__label">Principal</span>
                <span className="review-row__value">
                  {formatMoney(decisionTarget.principal, decisionTarget.currency)}
                </span>
              </div>
              <div className="review-row">
                <span className="review-row__label">Terms</span>
                <span className="review-row__value">
                  {decisionTarget.tenureMonths} months at {decisionTarget.interestRate}%
                </span>
              </div>
              <div className="review-row">
                <span className="review-row__label">Monthly EMI</span>
                <span className="review-row__value">
                  {formatMoney(decisionTarget.emi, decisionTarget.currency)}
                </span>
              </div>
              <div className="review-row">
                <span className="review-row__label">Purpose</span>
                <span className="review-row__value">{decisionTarget.purpose || '—'}</span>
              </div>
            </div>
          ) : null}

          <div>
            <span className="field__label" style={{ display: 'block', marginBottom: 8 }}>Decision</span>
            <div className="row" style={{ gap: 8 }}>
              <Button
                variant={decision === 'approve' ? 'primary' : 'secondary'}
                icon="check"
                onClick={() => setDecision('approve')}
              >
                Approve
              </Button>
              <Button
                variant={decision === 'reject' ? 'danger' : 'secondary'}
                icon="block"
                onClick={() => setDecision('reject')}
              >
                Reject
              </Button>
            </div>
          </div>

          {decision === 'approve' ? (
            <>
              <FormField
                label="Disburse into"
                as="select"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                required
              >
                <option value="">Select an account</option>
                {customerAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountNumberMasked} · {formatMoney(account.balance, account.currency)}
                  </option>
                ))}
              </FormField>
              <InlineAlert variant="warning">
                Approving credits the principal to the selected account immediately and records the disbursement
                on the customer&apos;s ledger.
              </InlineAlert>
            </>
          ) : null}

          <FormField
            label="Decision note"
            as="textarea"
            rows={3}
            maxLength={255}
            placeholder={decision === 'approve' ? 'e.g. Income and documents verified' : 'Reason shared with the customer'}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </form>
      </Modal>
    </>
  );
}
