import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Card, { StatCard, ChartCard } from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, QueryState } from '../../components/States';
import { useApiQuery } from '../../hooks/useApi';
import { formatDate, formatMoney, formatNumber, humanise } from '../../utils/format';

/** Reporting view over completed transactions and the loan book. */
export default function Reports() {
  const [range, setRange] = useState({ from: '', to: '' });
  const reports = useApiQuery('/admin/reports', {
    params: { from: range.from || undefined, to: range.to || undefined },
  });

  const data = reports.data;
  const totalVolume = (data?.byType ?? []).reduce((sum, row) => sum + row.volume, 0);
  const totalCount = (data?.byType ?? []).reduce((sum, row) => sum + row.count, 0);
  const loanPrincipal = (data?.loanSummary ?? []).reduce((sum, row) => sum + row.principal, 0);

  const applyPreset = (days) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setRange({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
  };

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Reports</h1>
          <p className="page__subtitle">Transaction volume, currency mix and loan portfolio analysis.</p>
        </div>
        <div className="page__actions">
          <Button variant="secondary" onClick={() => applyPreset(7)}>Last 7 days</Button>
          <Button variant="secondary" onClick={() => applyPreset(30)}>Last 30 days</Button>
          <Button variant="secondary" onClick={() => applyPreset(90)}>Last 90 days</Button>
        </div>
      </div>

      <Card flush className="stack">
        <div className="filter-bar">
          <FormField
            label="From"
            type="date"
            value={range.from}
            onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
          />
          <FormField
            label="To"
            type="date"
            value={range.to}
            onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
          />
          <Button variant="secondary" onClick={() => setRange({ from: '', to: '' })}>All time</Button>
          <div className="spacer" />
          <Button variant="secondary" icon="refresh" onClick={() => reports.reload()}>Refresh</Button>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <QueryState loading={reports.loading} error={reports.error} onRetry={reports.reload} rows={4}>
          <div className="stack">
            <div className="grid grid--4">
              <StatCard label="Transactions" value={formatNumber(totalCount)} meta="Completed in range" icon="transactions" tone="info" />
              <StatCard label="Total volume" value={formatMoney(totalVolume, 'INR', { compact: true })} icon="reports" tone="navy" />
              <StatCard
                label="Currencies"
                value={(data?.byCurrency ?? []).length}
                meta={(data?.byCurrency ?? []).map((row) => row.currency_code).join(', ')}
                icon="globe"
                tone="success"
              />
              <StatCard
                label="Loan book"
                value={formatMoney(loanPrincipal, 'INR', { compact: true })}
                meta={`${(data?.loanSummary ?? []).reduce((sum, row) => sum + row.count, 0)} applications`}
                icon="loans"
                tone="warning"
              />
            </div>

            <ChartCard
              title="Daily transaction volume"
              subtitle={
                range.from || range.to
                  ? `${range.from || 'Start'} to ${range.to || 'today'}`
                  : 'All completed transactions'
              }
              height={280}
            >
              {(data?.daily ?? []).length === 0 ? (
                <EmptyState icon="reports" title="No transactions in this range" text="Try a wider date range." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.daily} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="#e3e8f0" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: '#5b6b82' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => formatDate(value).slice(0, 6)}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#5b6b82' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => formatMoney(value, 'INR', { compact: true })}
                    />
                    <Tooltip
                      labelFormatter={(value) => formatDate(value)}
                      formatter={(value) => [formatMoney(value, 'INR'), 'Volume']}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e3e8f0', fontSize: 12 }}
                    />
                    <Line isAnimationActive={false} type="monotone" dataKey="volume" stroke="#1f5fd9" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <div className="grid grid--split">
              <ChartCard title="Volume by transaction type" height={280}>
                {(data?.byType ?? []).length === 0 ? (
                  <EmptyState icon="reports" title="No data in this range" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.byType}
                      layout="vertical"
                      margin={{ top: 6, right: 16, left: 24, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#e3e8f0" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: '#5b6b82' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => formatMoney(value, 'INR', { compact: true })}
                      />
                      <YAxis
                        type="category"
                        dataKey="type"
                        width={120}
                        tick={{ fontSize: 11, fill: '#5b6b82' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={humanise}
                      />
                      <Tooltip
                        formatter={(value) => [formatMoney(value, 'INR'), 'Volume']}
                        labelFormatter={humanise}
                        contentStyle={{ borderRadius: 10, border: '1px solid #e3e8f0', fontSize: 12 }}
                        cursor={{ fill: 'rgba(31,95,217,0.06)' }}
                      />
                      <Bar isAnimationActive={false} dataKey="volume" fill="#1f5fd9" radius={[0, 5, 5, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <Card title="Volume by currency" subtitle="Completed transactions in the selected range" flush>
                <div className="table-wrap">
                  <table className="table table--stack table--fit">
                    <thead>
                      <tr>
                        <th>Currency</th>
                        <th className="num">Transactions</th>
                        <th className="num">Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.byCurrency ?? []).map((row) => (
                        <tr key={row.currency_code}>
                          <td data-label="Currency"><strong>{row.currency_code}</strong></td>
                          <td data-label="Transactions" className="num">{formatNumber(row.count)}</td>
                          <td data-label="Volume" className="num">
                            {formatMoney(row.volume, row.currency_code)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <div className="grid grid--split">
              <Card title="Top customers by volume" subtitle="Highest transaction value in range" flush>
                <div className="table-wrap">
                  <table className="table table--stack table--fit">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th className="num">Transactions</th>
                        <th className="num">Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.topCustomers ?? []).map((row) => (
                        <tr key={row.id}>
                          <td data-label="Customer">
                            <div className="cell-title">{row.full_name}</div>
                            <div className="cell-sub">{row.email}</div>
                          </td>
                          <td data-label="Transactions" className="num">{formatNumber(row.transactions)}</td>
                          <td data-label="Volume" className="num">{formatMoney(row.volume, 'INR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Loan portfolio" subtitle="Applications and principal by status" flush>
                <div className="table-wrap">
                  <table className="table table--stack table--fit">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th className="num">Applications</th>
                        <th className="num">Principal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.loanSummary ?? []).map((row) => (
                        <tr key={row.status}>
                          <td data-label="Status"><StatusBadge status={row.status} /></td>
                          <td data-label="Applications" className="num">{formatNumber(row.count)}</td>
                          <td data-label="Principal" className="num">{formatMoney(row.principal, 'INR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        </QueryState>
      </div>
    </>
  );
}
