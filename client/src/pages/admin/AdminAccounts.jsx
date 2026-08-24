import { useState } from 'react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import { EmptyState, InlineAlert } from '../../components/States';
import { useApiQuery, useDebounced } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { formatDate, formatMoney, humanise } from '../../utils/format';

export default function AdminAccounts() {
  const { can } = useAuth();
  const toast = useToast();

  const [filters, setFilters] = useState({ q: '', status: '', currency: '' });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: 'created_at', sortDir: 'desc' });
  const debouncedQuery = useDebounced(filters.q, 350);

  const currencies = useApiQuery('/currencies');
  const accounts = useApiQuery('/accounts/all', {
    params: {
      page,
      limit: 10,
      q: debouncedQuery || undefined,
      status: filters.status || undefined,
      currency: filters.currency || undefined,
      sortBy: sort.sortBy,
      sortDir: sort.sortDir,
    },
  });

  const [statusTarget, setStatusTarget] = useState(null);
  const [nextStatus, setNextStatus] = useState('frozen');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const canManage = can('account.manage');

  const applyStatus = async (event) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.patch(`/accounts/${statusTarget.id}/status`, { status: nextStatus });
      toast.success('Account updated', `Account ${statusTarget.accountNumberMasked} is now ${nextStatus}.`);
      setStatusTarget(null);
      await accounts.reload({ quiet: true });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Accounts</h1>
          <p className="page__subtitle">
            {can('account.view.all')
              ? 'Every account on the platform.'
              : 'Accounts belonging to the customers assigned to you.'}
          </p>
        </div>
      </div>

      <Card flush>
        <div className="filter-bar">
          <FormField
            label="Search"
            className="field--grow"
            type="search"
            placeholder="Account number, customer name or email"
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
            <option value="active">Active</option>
            <option value="frozen">Frozen</option>
            <option value="closed">Closed</option>
          </FormField>
          <FormField
            label="Currency"
            as="select"
            value={filters.currency}
            onChange={(event) => {
              setFilters((current) => ({ ...current, currency: event.target.value }));
              setPage(1);
            }}
          >
            <option value="">All currencies</option>
            {(currencies.data ?? []).map((currency) => (
              <option key={currency.code} value={currency.code}>{currency.code}</option>
            ))}
          </FormField>
        </div>

        <DataTable
          columns={[
            {
              key: 'account',
              header: 'Account',
              render: (row) => (
                <>
                  <div className="cell-title mono">{row.accountNumberMasked}</div>
                  <div className="cell-sub">{humanise(row.accountType)} · {row.currency}</div>
                </>
              ),
            },
            {
              key: 'owner',
              header: 'Customer',
              render: (row) => (
                <>
                  <div className="cell-title">{row.ownerName}</div>
                  <div className="cell-sub">{row.ownerEmail}</div>
                </>
              ),
            },
            { key: 'branch', header: 'Branch', render: (row) => row.branch || '—' },
            { key: 'openedAt', header: 'Opened', sortKey: 'created_at', render: (row) => formatDate(row.openedAt) },
            {
              key: 'balance',
              header: 'Balance',
              align: 'right',
              sortKey: 'balance',
              render: (row) => formatMoney(row.balance, row.currency),
            },
            { key: 'status', header: 'Status', sortKey: 'status', render: (row) => <StatusBadge status={row.status} /> },
            ...(canManage
              ? [
                  {
                    key: 'actions',
                    header: 'Actions',
                    render: (row) => (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setStatusTarget(row);
                          setNextStatus(row.status === 'active' ? 'frozen' : 'active');
                          setError(null);
                        }}
                      >
                        Change status
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
          rows={accounts.data?.items}
          loading={accounts.loading}
          error={accounts.error}
          onRetry={accounts.reload}
          pagination={accounts.data?.pagination}
          onPageChange={setPage}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
          caption="All accounts"
          empty={<EmptyState icon="accounts" title="No accounts match these filters" />}
        />
      </Card>

      <Modal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title="Change account status"
        subtitle={statusTarget ? `${statusTarget.accountNumberMasked} · ${statusTarget.ownerName}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusTarget(null)} disabled={pending}>Cancel</Button>
            <Button onClick={applyStatus} loading={pending}>Apply status</Button>
          </>
        }
      >
        <form onSubmit={applyStatus} className="stack" style={{ gap: 14 }}>
          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

          <FormField
            label="New status"
            as="select"
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value)}
            required
          >
            <option value="active">Active — normal operation</option>
            <option value="frozen">Frozen — no transactions permitted</option>
            <option value="closed">Closed — permanent, requires zero balance</option>
          </FormField>

          <InlineAlert variant="warning">
            Freezing an account immediately blocks transfers and payments. This action is recorded in the audit log.
          </InlineAlert>
        </form>
      </Modal>
    </>
  );
}
