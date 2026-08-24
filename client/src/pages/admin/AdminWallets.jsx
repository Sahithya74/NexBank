import { useState } from 'react';
import Card, { StatCard } from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState } from '../../components/States';
import { useApiQuery, useDebounced } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatMoney, formatNumber } from '../../utils/format';

/** Wallet monitoring: holdings per customer plus the platform-wide currency mix. */
export default function AdminWallets() {
  const { can } = useAuth();
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebounced(filters.q, 350);

  const wallets = useApiQuery('/wallets/all', {
    params: {
      page,
      limit: 10,
      q: debouncedQuery || undefined,
      status: filters.status || undefined,
    },
  });
  const dashboard = useApiQuery('/admin/dashboard', { enabled: can('admin.dashboard') });

  const base = wallets.data?.base ?? 'INR';
  const distribution = dashboard.data?.currencyDistribution ?? [];
  const totalValue = distribution.reduce((sum, entry) => sum + Number(entry.convertedValue), 0);

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Wallet monitoring</h1>
          <p className="page__subtitle">Multi-currency holdings across every customer wallet.</p>
        </div>
      </div>

      <div className="stack">
        <div className="grid grid--3">
          <StatCard
            label="Wallets"
            value={formatNumber(wallets.data?.pagination?.total ?? 0)}
            meta="Customer wallets on the platform"
            icon="wallet"
            tone="info"
          />
          <StatCard
            label="Total held"
            value={formatMoney(totalValue, base, { compact: true })}
            meta={`Valued in ${base}`}
            icon="reports"
            tone="navy"
          />
          <StatCard
            label="Currencies in use"
            value={distribution.length}
            meta={distribution.map((entry) => entry.currency).join(', ')}
            icon="globe"
            tone="success"
          />
        </div>

        {distribution.length > 0 ? (
          <Card title="Currency distribution" subtitle={`Total holdings by currency, valued in ${base}`} flush>
            <div className="table-wrap">
              <table className="table table--stack">
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th className="num">Holders</th>
                    <th className="num">Total held</th>
                    <th className="num">Value in {base}</th>
                    <th className="num">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {distribution.map((entry) => {
                    const share = totalValue > 0 ? (Number(entry.convertedValue) / totalValue) * 100 : 0;
                    return (
                      <tr key={entry.currency}>
                        <td data-label="Currency"><strong>{entry.currency}</strong></td>
                        <td data-label="Holders" className="num">{entry.holders}</td>
                        <td data-label="Total held" className="num">
                          {formatMoney(entry.total, entry.currency)}
                        </td>
                        <td data-label={`Value in ${base}`} className="num">
                          {formatMoney(entry.convertedValue, base)}
                        </td>
                        <td data-label="Share" className="num">
                          <div className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            <div className="progress" style={{ width: 70 }}>
                              <div className="progress__bar" style={{ width: `${share}%` }} />
                            </div>
                            <span>{share.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        <Card title="Customer wallets" flush>
          <div className="filter-bar">
            <FormField
              label="Search"
              className="field--grow"
              type="search"
              placeholder="Customer name or email"
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
            </FormField>
          </div>

          <DataTable
            columns={[
              {
                key: 'customer',
                header: 'Customer',
                render: (row) => (
                  <>
                    <div className="cell-title">{row.customer}</div>
                    <div className="cell-sub">{row.email}</div>
                  </>
                ),
              },
              { key: 'currencies', header: 'Currencies', align: 'right', render: (row) => row.currencies },
              {
                key: 'totalValue',
                header: `Value in ${base}`,
                align: 'right',
                render: (row) => formatMoney(row.totalValue, base),
              },
              { key: 'createdAt', header: 'Opened', render: (row) => formatDate(row.createdAt) },
              { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            ]}
            rows={wallets.data?.items}
            loading={wallets.loading}
            error={wallets.error}
            onRetry={wallets.reload}
            pagination={wallets.data?.pagination}
            onPageChange={setPage}
            caption="Customer wallets"
            empty={<EmptyState icon="wallet" title="No wallets match these filters" />}
          />
        </Card>
      </div>
    </>
  );
}
