import { useState } from 'react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import { EmptyState } from '../../components/States';
import { useApiQuery, useDebounced } from '../../hooks/useApi';
import { formatDate, formatRelative } from '../../utils/format';

const EMPTY = { q: '', action: '', status: '', from: '', to: '' };

/**
 * The audit trail. Every sign-in, transfer, conversion, approval and
 * administrative change is written here by the API and is read-only.
 */
export default function AuditLogs() {
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: 'created_at', sortDir: 'desc' });
  const [selected, setSelected] = useState(null);
  const debouncedQuery = useDebounced(filters.q, 350);

  const actions = useApiQuery('/audit-logs/actions');
  const logs = useApiQuery('/audit-logs', {
    params: {
      page,
      limit: 15,
      q: debouncedQuery || undefined,
      action: filters.action || undefined,
      status: filters.status || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      sortBy: sort.sortBy,
      sortDir: sort.sortDir,
    },
  });

  const update = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    setPage(1);
  };

  const activeFilters = Object.entries(filters).filter(([, value]) => value).length;

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Audit logs</h1>
          <p className="page__subtitle">
            A read-only record of every security-relevant and money-moving action on the platform.
          </p>
        </div>
        <div className="page__actions">
          <Button variant="secondary" icon="refresh" onClick={() => logs.reload()}>Refresh</Button>
        </div>
      </div>

      <Card flush>
        <div className="filter-bar">
          <FormField
            label="Search"
            className="field--grow"
            type="search"
            placeholder="Action, description or actor email"
            value={filters.q}
            onChange={update('q')}
          />
          <FormField label="Action" as="select" value={filters.action} onChange={update('action')}>
            <option value="">All actions</option>
            {(actions.data ?? []).map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </FormField>
          <FormField label="Result" as="select" value={filters.status} onChange={update('status')}>
            <option value="">All results</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </FormField>
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

        <DataTable
          columns={[
            {
              key: 'action',
              header: 'Action',
              sortKey: 'action',
              render: (row) => (
                <>
                  <div className="cell-title mono" style={{ fontSize: 12.5 }}>{row.action}</div>
                  <div className="cell-sub">{row.description || '—'}</div>
                </>
              ),
            },
            {
              key: 'actor',
              header: 'Actor',
              render: (row) => (
                <>
                  <div className="cell-title">{row.actor_name || 'Unknown'}</div>
                  <div className="cell-sub">{row.actor_email || '—'}</div>
                </>
              ),
            },
            {
              key: 'entity',
              header: 'Entity',
              render: (row) =>
                row.entity_type ? (
                  <span className="chip chip--muted">
                    {row.entity_type}
                    {row.entity_id ? ` #${row.entity_id}` : ''}
                  </span>
                ) : (
                  '—'
                ),
            },
            { key: 'ip_address', header: 'IP address', render: (row) => <span className="mono">{row.ip_address || '—'}</span> },
            {
              key: 'created_at',
              header: 'When',
              sortKey: 'created_at',
              render: (row) => (
                <>
                  <div>{formatDate(row.created_at, { withTime: true })}</div>
                  <div className="cell-sub">{formatRelative(row.created_at)}</div>
                </>
              ),
            },
            { key: 'status', header: 'Result', sortKey: 'status', render: (row) => <StatusBadge status={row.status} /> },
          ]}
          rows={logs.data?.items}
          loading={logs.loading}
          error={logs.error}
          onRetry={logs.reload}
          pagination={logs.data?.pagination}
          onPageChange={setPage}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
          onRowClick={setSelected}
          caption="Audit log entries"
          empty={
            <EmptyState
              icon="audit"
              title="No audit entries match these filters"
              text="Try widening the date range or clearing the action filter."
            />
          }
        />
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Audit entry"
        subtitle={selected?.action}
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected ? (
          <dl className="dl">
            <dt>Action</dt>
            <dd className="mono">{selected.action}</dd>
            <dt>Description</dt>
            <dd>{selected.description || '—'}</dd>
            <dt>Result</dt>
            <dd><StatusBadge status={selected.status} /></dd>
            <dt>Actor</dt>
            <dd>{selected.actor_name || 'Unknown'}</dd>
            <dt>Actor email</dt>
            <dd>{selected.actor_email || '—'}</dd>
            <dt>Actor role</dt>
            <dd>{selected.actor_role || '—'}</dd>
            <dt>Entity</dt>
            <dd>
              {selected.entity_type ? `${selected.entity_type}${selected.entity_id ? ` #${selected.entity_id}` : ''}` : '—'}
            </dd>
            <dt>IP address</dt>
            <dd className="mono">{selected.ip_address || '—'}</dd>
            <dt>Recorded</dt>
            <dd>{formatDate(selected.created_at, { withTime: true })}</dd>
          </dl>
        ) : null}
      </Modal>
    </>
  );
}
