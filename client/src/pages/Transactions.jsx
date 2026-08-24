import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import TransactionTable from '../components/TransactionTable';
import { useApiQuery, useDebounced } from '../hooks/useApi';
import { formatDate, formatMoney, humanise } from '../utils/format';

const EMPTY_FILTERS = {
  q: '',
  type: '',
  status: '',
  direction: '',
  from: '',
  to: '',
};

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, q: searchParams.get('q') || '' });
  const [sort, setSort] = useState({ sortBy: 'created_at', sortDir: 'desc' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const debouncedSearch = useDebounced(filters.q, 350);
  const options = useApiQuery('/transactions/filters');

  const transactions = useApiQuery('/transactions', {
    params: {
      page,
      limit: 10,
      q: debouncedSearch || undefined,
      type: filters.type || undefined,
      status: filters.status || undefined,
      direction: filters.direction || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      sortBy: sort.sortBy,
      sortDir: sort.sortDir,
    },
  });

  // Keep the URL in step with the search box so results can be shared.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set('q', debouncedSearch);
    else next.delete('q');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const update = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    setPage(1);
  };

  const activeFilters = Object.entries(filters).filter(([, value]) => value).length;

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Transactions</h1>
          <p className="page__subtitle">Search, filter and review every movement on your accounts and wallet.</p>
        </div>
        <div className="page__actions">
          <Button variant="secondary" icon="refresh" onClick={() => transactions.reload()}>Refresh</Button>
        </div>
      </div>

      <Card flush>
        <div className="filter-bar">
          <FormField
            label="Search"
            className="field--grow"
            type="search"
            placeholder="Reference, description or counterparty"
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
          <FormField label="Direction" as="select" value={filters.direction} onChange={update('direction')}>
            <option value="">All</option>
            <option value="credit">Money in</option>
            <option value="debit">Money out</option>
          </FormField>
          <FormField label="From" type="date" value={filters.from} onChange={update('from')} />
          <FormField label="To" type="date" value={filters.to} onChange={update('to')} />
          {activeFilters > 0 ? (
            <Button
              variant="secondary"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
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
          emptyTitle={activeFilters > 0 ? 'No transactions match these filters' : 'No transactions yet'}
          emptyText={
            activeFilters > 0
              ? 'Try clearing a filter or widening the date range.'
              : 'Your activity will appear here as soon as money moves.'
          }
        />
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Transaction details"
        subtitle={selected?.reference}
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected ? (
          <div className="stack" style={{ gap: 18 }}>
            <div>
              <span className="stat__label">{selected.direction === 'credit' ? 'Amount received' : 'Amount paid'}</span>
              <p
                className="stat__value"
                style={{ color: selected.direction === 'credit' ? 'var(--success)' : 'var(--text)' }}
              >
                {selected.direction === 'credit' ? '+' : '−'}
                {formatMoney(selected.amount, selected.currency)}
              </p>
            </div>

            <dl className="dl">
              <dt>Reference</dt>
              <dd className="mono">{selected.reference}</dd>
              <dt>Description</dt>
              <dd>{selected.description}</dd>
              <dt>Type</dt>
              <dd>{humanise(selected.type)}</dd>
              <dt>Status</dt>
              <dd><StatusBadge status={selected.status} /></dd>
              <dt>Date</dt>
              <dd>{formatDate(selected.date, { withTime: true })}</dd>
              <dt>Counterparty</dt>
              <dd>{selected.counterparty || '—'}</dd>
              {selected.counterpartyRef ? (
                <>
                  <dt>Counterparty account</dt>
                  <dd className="mono">{selected.counterpartyRef}</dd>
                </>
              ) : null}
              {selected.accountLastFour ? (
                <>
                  <dt>Account</dt>
                  <dd className="mono">•••• {selected.accountLastFour}</dd>
                </>
              ) : null}
              <dt>Balance after</dt>
              <dd>
                {selected.balanceAfter === null
                  ? '—'
                  : formatMoney(selected.balanceAfter, selected.currency)}
              </dd>
            </dl>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
