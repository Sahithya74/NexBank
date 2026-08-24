import { useState } from 'react';
import Card, { StatCard } from '../components/Card';
import Button from '../components/Button';
import FormField from '../components/FormField';
import Modal, { ConfirmationDialog } from '../components/Modal';
import Icon from '../components/Icon';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import { EmptyState, InlineAlert, QueryState } from '../components/States';
import { useApiQuery } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { formatDate, formatMoney, humanise } from '../utils/format';

const CATEGORY_ICON = {
  electricity: 'alert',
  water: 'info',
  internet: 'globe',
  mobile: 'notifications',
  dth: 'dashboard',
  gas: 'alert',
  insurance: 'shield',
  other: 'bills',
};

export default function Bills() {
  const toast = useToast();
  const bills = useApiQuery('/bills');
  const billers = useApiQuery('/bills/billers');
  const accounts = useApiQuery('/accounts');
  const [historyPage, setHistoryPage] = useState(1);
  const history = useApiQuery('/bills/history', { params: { page: historyPage, limit: 8 } });

  const [addOpen, setAddOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [payAccountId, setPayAccountId] = useState('');
  const [form, setForm] = useState({
    billerId: '',
    consumerNumber: '',
    label: '',
    amount: '',
    dueDate: '',
  });

  const activeAccounts = (accounts.data ?? []).filter((account) => account.status === 'active');
  const summary = bills.data?.summary;

  const openPay = (bill) => {
    setPayTarget(bill);
    setPayAccountId(activeAccounts[0]?.id ?? '');
    setError(null);
  };

  const payBill = async () => {
    if (!payAccountId) {
      setError('Choose the account to pay from.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await api.post(`/bills/${payTarget.id}/pay`, { accountId: Number(payAccountId) });
      setPayTarget(null);
      setReceipt(result);
      toast.success('Bill paid', `${result.biller} · ${formatMoney(result.amount, result.currency)}`);
      await Promise.all([
        bills.reload({ quiet: true }),
        history.reload({ quiet: true }),
        accounts.reload({ quiet: true }),
      ]);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPending(false);
    }
  };

  const addBill = async (event) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api.post('/bills', {
        billerId: Number(form.billerId),
        consumerNumber: form.consumerNumber.trim(),
        label: form.label.trim() || undefined,
        amount: form.amount,
        dueDate: form.dueDate,
      });
      toast.success('Bill added', 'It now appears in your pending bills.');
      setAddOpen(false);
      setForm({ billerId: '', consumerNumber: '', label: '', amount: '', dueDate: '' });
      await bills.reload({ quiet: true });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPending(false);
    }
  };

  const removeBill = async () => {
    setPending(true);
    try {
      await api.delete(`/bills/${removeTarget.id}`);
      toast.success('Bill removed');
      setRemoveTarget(null);
      await bills.reload({ quiet: true });
    } catch (caught) {
      toast.error('Could not remove bill', caught.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Bill payments</h1>
          <p className="page__subtitle">Track your billers, pay what is due and keep a record of every payment.</p>
        </div>
        <div className="page__actions">
          <Button icon="plus" onClick={() => setAddOpen(true)}>Add a bill</Button>
        </div>
      </div>

      <div className="stack">
        {summary ? (
          <div className="grid grid--3">
            <StatCard
              label="Total due"
              value={formatMoney(summary.totalDue, 'INR')}
              meta="Across pending and overdue bills"
              icon="bills"
              tone="navy"
            />
            <StatCard label="Pending" value={summary.pending} icon="clock" tone="warning" />
            <StatCard
              label="Overdue"
              value={summary.overdue}
              meta={summary.overdue > 0 ? 'Pay these first' : 'Nothing overdue'}
              icon="alert"
              tone={summary.overdue > 0 ? 'danger' : 'success'}
            />
          </div>
        ) : null}

        <Card title="Your bills" subtitle="Bills you have registered for payment" flush>
          <DataTable
            columns={[
              {
                key: 'biller',
                header: 'Biller',
                render: (row) => (
                  <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                    <span className="stat__icon stat__icon--navy" style={{ width: 30, height: 30 }} aria-hidden="true">
                      <Icon name={CATEGORY_ICON[row.category] || 'bills'} size={15} />
                    </span>
                    <span>
                      <div className="cell-title">{row.billerName}</div>
                      <div className="cell-sub">
                        {humanise(row.category)}
                        {row.label ? ` · ${row.label}` : ''}
                      </div>
                    </span>
                  </div>
                ),
              },
              {
                key: 'consumerNumber',
                header: 'Consumer number',
                render: (row) => <span className="mono">{row.consumerNumber}</span>,
              },
              { key: 'dueDate', header: 'Due date', render: (row) => formatDate(row.dueDate) },
              {
                key: 'amount',
                header: 'Amount',
                align: 'right',
                render: (row) => formatMoney(row.amount, row.currency),
              },
              { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              {
                key: 'actions',
                header: 'Action',
                render: (row) =>
                  row.status === 'paid' ? (
                    <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>Paid</span>
                  ) : (
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <Button size="sm" onClick={() => openPay(row)} disabled={activeAccounts.length === 0}>
                        Pay
                      </Button>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 30, height: 30 }}
                        onClick={() => setRemoveTarget(row)}
                        aria-label={`Remove ${row.billerName} bill`}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  ),
              },
            ]}
            rows={bills.data?.items}
            loading={bills.loading}
            error={bills.error}
            onRetry={bills.reload}
            caption="Registered bills"
            empty={
              <EmptyState
                icon="bills"
                title="No bills registered"
                text="Add a biller to start tracking and paying your bills here."
                action={<Button icon="plus" onClick={() => setAddOpen(true)}>Add a bill</Button>}
              />
            }
          />
        </Card>

        <Card title="Payment history" subtitle="Bills you have already paid" flush>
          <DataTable
            columns={[
              {
                key: 'biller_name',
                header: 'Biller',
                render: (row) => (
                  <>
                    <div className="cell-title">{row.biller_name}</div>
                    <div className="cell-sub">{humanise(row.category)}</div>
                  </>
                ),
              },
              { key: 'reference', header: 'Reference', render: (row) => <span className="mono">{row.reference}</span> },
              { key: 'paid_at', header: 'Paid on', render: (row) => formatDate(row.paid_at, { withTime: true }) },
              {
                key: 'amount',
                header: 'Amount',
                align: 'right',
                render: (row) => formatMoney(row.amount, row.currency_code),
              },
              { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            ]}
            rows={history.data?.items}
            keyField="reference"
            loading={history.loading}
            error={history.error}
            onRetry={history.reload}
            pagination={history.data?.pagination}
            onPageChange={setHistoryPage}
            caption="Bill payment history"
            empty={<EmptyState icon="clock" title="No payments yet" text="Paid bills will be listed here." />}
          />
        </Card>
      </div>

      {/* Add bill */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a bill"
        subtitle="Register a biller so you can pay it from your NexBank account."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={addBill} loading={pending}>Add bill</Button>
          </>
        }
      >
        <form onSubmit={addBill} className="stack" style={{ gap: 14 }}>
          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

          <FormField
            label="Biller"
            as="select"
            value={form.billerId}
            onChange={(event) => setForm((current) => ({ ...current, billerId: event.target.value }))}
            required
          >
            <option value="">Select a biller</option>
            {(billers.data ?? []).map((biller) => (
              <option key={biller.id} value={biller.id}>
                {biller.name} ({humanise(biller.category)})
              </option>
            ))}
          </FormField>

          <div className="form-grid">
            <FormField
              label="Consumer number"
              placeholder="e.g. TNEB-88213490"
              value={form.consumerNumber}
              onChange={(event) => setForm((current) => ({ ...current, consumerNumber: event.target.value }))}
              required
            />
            <FormField
              label="Label (optional)"
              placeholder="Home electricity"
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
            />
            <FormField
              label="Amount (INR)"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              required
            />
            <FormField
              label="Due date"
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Pay bill */}
      <Modal
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title="Pay bill"
        subtitle={payTarget ? `${payTarget.billerName} · ${payTarget.consumerNumber}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayTarget(null)} disabled={pending}>Cancel</Button>
            <Button onClick={payBill} loading={pending} icon="lock">
              Pay {payTarget ? formatMoney(payTarget.amount, payTarget.currency) : ''}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

          <FormField
            label="Pay from"
            as="select"
            value={payAccountId}
            onChange={(event) => setPayAccountId(event.target.value)}
            required
          >
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {humanise(account.accountType)} {account.accountNumberMasked} ·{' '}
                {formatMoney(account.balance, account.currency)}
              </option>
            ))}
          </FormField>

          <div className="review-list">
            <div className="review-row">
              <span className="review-row__label">Biller</span>
              <span className="review-row__value">{payTarget?.billerName}</span>
            </div>
            <div className="review-row">
              <span className="review-row__label">Due date</span>
              <span className="review-row__value">{formatDate(payTarget?.dueDate)}</span>
            </div>
            <div className="review-row review-row--total">
              <span className="review-row__label">Amount</span>
              <span className="review-row__value">
                {payTarget ? formatMoney(payTarget.amount, payTarget.currency) : ''}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Receipt */}
      <Modal
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title="Payment receipt"
        size="sm"
        footer={<Button onClick={() => setReceipt(null)}>Done</Button>}
      >
        <div className="success-panel" style={{ padding: '10px 0 18px' }}>
          <span className="success-mark"><Icon name="check" size={24} /></span>
          <h3 style={{ fontSize: 17 }}>Bill paid</h3>
        </div>
        <div className="review-list">
          <div className="review-row">
            <span className="review-row__label">Reference</span>
            <span className="review-row__value mono">{receipt?.reference}</span>
          </div>
          <div className="review-row">
            <span className="review-row__label">Biller</span>
            <span className="review-row__value">{receipt?.biller}</span>
          </div>
          <div className="review-row">
            <span className="review-row__label">Amount</span>
            <span className="review-row__value">{formatMoney(receipt?.amount, receipt?.currency)}</span>
          </div>
          <div className="review-row">
            <span className="review-row__label">Balance after</span>
            <span className="review-row__value">{formatMoney(receipt?.balanceAfter, receipt?.currency)}</span>
          </div>
        </div>
      </Modal>

      <ConfirmationDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeBill}
        pending={pending}
        title="Remove this bill?"
        message={`The ${removeTarget?.billerName} bill will no longer be tracked. Paid bills are never removed.`}
        confirmLabel="Remove bill"
        variant="danger"
      />
    </>
  );
}
