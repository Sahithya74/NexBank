import { useState } from 'react';
import Card, { StatCard } from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import TransactionTable from '../../components/TransactionTable';
import { useApiQuery, useDebounced } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatMoney, formatNumber, humanise } from '../../utils/format';

const EMPTY = { q: '', type: '', status: '', direction: '', currency: '', from: '', to: '', minAmount: '' };

/** Staff-wide transaction monitor. Scope is decided by the API from the caller's role. */
export default function AdminTransactions() {
  const { can } = useAuth();
  const [filters, setFilters] = useState(EMPTY);
  const [sort, setSort] = useState({ sortBy: 'created_at', sortDir: 'desc' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const debouncedQuery = useDebounced(filters.q, 350);
  const options = useApiQuery('/transactions/filters');
  const currencies = useApiQuery('/currencies');

  const transactions = useApiQuery('/transactions', {
    params: {
      page,
      limit: 12,
      q: debouncedQuery || undefined,
      type: filters.type || undefined,
      status: filters.status || undefined,
      direction: filters.direction || undefined,
      currency: filters.currency || undefined,
      minAmount: filters.minAmount || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      sortBy: sort.sortBy,
      sortDir: sort.sortDir,
    },
  });

  const dashboard = useApiQuery('/admin/dashboard', { enabled: can('admin.dashboard') });
  const stats = dashboard.data?.stats;

  const update = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    setPage(1);
  };

  const activeFilters = Object.entries(filters).filter(([, value]) => value).length;

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Transaction monitoring</h1>
          <p className="page__subtitle">
            {can('transaction.view.all')
              ? 'Every transaction across the platform.'
              : 'Transactions belonging to the customers assigned to you.'}
          </p>
        </div>
        <div className="page__actions">
          <Button variant="secondary" icon="refresh" onClick={() => transactions.reload()}>Refresh</Button>
        </div>
      </div>

      <div className="stack">
        {stats ? (
          <div className="grid grid--4">
            <StatCard label="Total transactions" value={formatNumber(stats.totalTransactions)} icon="transactions" tone="info" />
            <StatCard
              label="Volume (30 days)"
              value={formatMoney(stats.transactionVolume30d, dashboard.data.base, { compact: true })}
              icon="reports"
              tone="navy"
            />
            <StatCard label="Pending" value={formatNumber(stats.pendingTransactions)} icon="clock" tone="warning" />
            <StatCard
              label="Failed"
              value={formatNumber(stats.failedTransactions)}
              icon="alert"
              tone={stats.failedTransactions > 0 ? 'danger' : 'success'}
            />
          </div>
        ) : null}

        <Card flush>
          <div className="filter-bar">
            <FormField
              label="Search"
              className="field--grow"
              type="search"
              placeholder="Reference, description, counterparty or customer"
              value={filters.q}
              onChange={update('q')}
            />
            <FormField label="Type" as="select" value={filters.type} onChange={update('type')}>
              <option value="">All types</option>
              {(options.data?.types ?? []).map((type) => (
                <option key={type} value={type}>{humanise(type)}</option>
              ))}
            </FormField>
            <FormField label="Status" as="select" value={filters.status} onChange={update('status')}>
              <option value="">All statuses</option>
              {(options.data?.statuses ?? []).map((status) => (
                <option key={status} value={status}>{humanise(status)}</option>
              ))}
            </FormField>
            <FormField label="Currency" as="select" value={filters.currency} onChange={update('currency')}>
              <option value="">All</option>
              {(currencies.data ?? []).map((currency) => (
                <option key={currency.code} value={currency.code}>{currency.code}</option>
              ))}
            </FormField>
            <FormField
              label="Min amount"
              type="number"
              min="0"
              placeholder="0"
              value={filters.minAmount}
              onChange={update('minAmount')}
            />
            <FormField label="From" type="date" value={filters.from} onChange={update('from')} />
            <FormField label="To" type="date" value={filters.to} onChange={update('to')} />
            {activeFilters > 0 ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setFilters(EMPTY);
                  setPage(1);
                }}
              >
                Clear ({activeFilters})
              </Button>
            ) : null}
          </div>

          <TransactionTable
            transactions={transactions.data?.items}
            loading={transactions.loading}
            error={transactions.error}
            onRetry={transactions.reload}
            pagination={transactions.data?.pagination}
            onPageChange={setPage}
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
            onSelect={setSelected}
            showCustomer
            showBalance={false}
            emptyTitle="No transactions match these filters"
            emptyText="Adjust the filters to widen the search."
          />
        </Card>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Transaction details"
        subtitle={selected?.reference}
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected ? (
          <dl className="dl">
            <dt>Reference</dt>
            <dd className="mono">{selected.reference}</dd>
            <dt>Customer</dt>
            <dd>{selected.customer} ({selected.customerEmail})</dd>
            <dt>Description</dt>
            <dd>{selected.description}</dd>
            <dt>Type</dt>
            <dd>{humanise(selected.type)}</dd>
            <dt>Direction</dt>
            <dd>{selected.direction === 'credit' ? 'Credit (money in)' : 'Debit (money out)'}</dd>
            <dt>Amount</dt>
            <dd>{formatMoney(selected.amount, selected.currency)}</dd>
            <dt>Status</dt>
            <dd><StatusBadge status={selected.status} /></dd>
            <dt>Counterparty</dt>
            <dd>{selected.counterparty || '—'}</dd>
            <dt>Account</dt>
            <dd className="mono">{selected.accountLastFour ? `•••• ${selected.accountLastFour}` : '—'}</dd>
            <dt>Date</dt>
            <dd>{formatDate(selected.date, { withTime: true })}</dd>
          </dl>
        ) : null}
      </Modal>
    </>
  );
}
