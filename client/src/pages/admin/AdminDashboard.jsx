import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Card, { StatCard, ChartCard } from '../../components/Card';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, QueryState } from '../../components/States';
import { useApiQuery } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, formatNumber, formatRelative, humanise } from '../../utils/format';

const CHART_COLOURS = ['#1f5fd9', '#0f8a5f', '#b7791f', '#7c4dbe', '#0b8fa8', '#c22b2b'];
const STATUS_COLOUR = {
  completed: '#0f8a5f',
  pending: '#b7791f',
  failed: '#c22b2b',
  cancelled: '#8a99ae',
};

export default function AdminDashboard() {
  const { user, can } = useAuth();
  const dashboard = useApiQuery('/admin/dashboard');

  const stats = dashboard.data?.stats;
  const base = dashboard.data?.base ?? 'INR';
  // Recharts needs numeric values; money arrives as exact decimal strings.
  const currencyChart = (dashboard.data?.currencyDistribution ?? []).map((entry) => ({
    ...entry,
    convertedValue: Number(entry.convertedValue),
  }));

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Administration overview</h1>
          <p className="page__subtitle">
            Platform health, transaction volume and pending work across NexBank.
          </p>
        </div>
        <div className="page__actions">
          <Button variant="secondary" icon="refresh" onClick={() => dashboard.reload()}>Refresh</Button>
          {can('report.view') ? <Button to="/admin/reports" icon="reports">Open reports</Button> : null}
        </div>
      </div>

      <QueryState loading={dashboard.loading} error={dashboard.error} onRetry={dashboard.reload} rows={4}>
        <div className="stack">
          <div className="grid grid--4">
            <StatCard label="Customers" value={formatNumber(stats?.customers)} meta={`${formatNumber(stats?.activeUsers)} active users`} icon="users" tone="info" />
            <StatCard label="Active accounts" value={formatNumber(stats?.activeAccounts)} meta={`${formatMoney(stats?.totalDeposits, base, { compact: true })} on deposit`} icon="accounts" tone="navy" />
            <StatCard label="Active wallets" value={formatNumber(stats?.activeWallets)} meta={`${formatMoney(stats?.walletPortfolioValue, base, { compact: true })} held`} icon="wallet" tone="success" />
            <StatCard
              label="Pending approvals"
              value={formatNumber(stats?.pendingApprovals)}
              meta="Loan applications awaiting a decision"
              icon="clock"
              tone={stats?.pendingApprovals > 0 ? 'warning' : 'success'}
            />
          </div>

          <div className="grid grid--4">
            <StatCard label="Transactions" value={formatNumber(stats?.totalTransactions)} meta="All time" icon="transactions" tone="info" />
            <StatCard label="Volume (30 days)" value={formatMoney(stats?.transactionVolume30d, base, { compact: true })} meta="Completed transactions" icon="reports" tone="navy" />
            <StatCard label="Pending" value={formatNumber(stats?.pendingTransactions)} meta="Awaiting settlement" icon="clock" tone="warning" />
            <StatCard
              label="Failed"
              value={formatNumber(stats?.failedTransactions)}
              meta="Rejected or unsuccessful"
              icon="alert"
              tone={stats?.failedTransactions > 0 ? 'danger' : 'success'}
            />
          </div>

          <div className="grid grid--split">
            <ChartCard title="Transaction volume" subtitle="Completed volume by month" height={280}>
              {(dashboard.data?.monthlyVolume ?? []).length === 0 ? (
                <EmptyState icon="reports" title="No volume recorded yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.data.monthlyVolume} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="#e3e8f0" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#5b6b82' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#5b6b82' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => formatMoney(value, base, { compact: true })}
                    />
                    <Tooltip
                      formatter={(value) => [formatMoney(value, base), 'Volume']}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e3e8f0', fontSize: 12 }}
                      cursor={{ fill: 'rgba(31,95,217,0.06)' }}
                    />
                    <Bar isAnimationActive={false} dataKey="volume" fill="#1f5fd9" radius={[5, 5, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Currency distribution" subtitle={`Wallet holdings valued in ${base}`} height={280}>
              {(dashboard.data?.currencyDistribution ?? []).length === 0 ? (
                <EmptyState icon="wallet" title="No wallet balances yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={currencyChart}
                      dataKey="convertedValue"
                      nameKey="currency"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {currencyChart.map((entry, index) => (
                        <Cell key={entry.currency} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                      ))}
                    </Pie>
                    <Legend verticalAlign="bottom" height={26} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value, name) => [formatMoney(value, base), name]}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e3e8f0', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="grid grid--split">
            <Card title="Transactions by type" subtitle="Completed volume by transaction type" flush>
              <div className="table-wrap">
                <table className="table table--stack table--fit">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th className="num">Count</th>
                      <th className="num">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard.data?.typeSplit ?? []).map((row) => (
                      <tr key={row.type}>
                        <td data-label="Type">{humanise(row.type)}</td>
                        <td data-label="Count" className="num">{formatNumber(row.count)}</td>
                        <td data-label="Volume" className="num">{formatMoney(row.volume, base)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Transaction status" subtitle="Across the whole platform">
              <div className="stack" style={{ gap: 14 }}>
                {(dashboard.data?.statusSplit ?? []).map((row) => {
                  const total = (dashboard.data?.statusSplit ?? []).reduce((sum, item) => sum + item.count, 0);
                  const share = total > 0 ? (row.count / total) * 100 : 0;
                  return (
                    <div key={row.status}>
                      <div className="row row--between" style={{ marginBottom: 6 }}>
                        <span className="row" style={{ gap: 8 }}>
                          <StatusBadge status={row.status} />
                        </span>
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {formatNumber(row.count)} ({share.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="progress">
                        <div
                          className="progress__bar"
                          style={{ width: `${share}%`, background: STATUS_COLOUR[row.status] || '#1f5fd9' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card
            title="Recent system activity"
            subtitle="Latest entries from the audit log"
            actions={
              can('audit.view') ? (
                <Button to="/admin/audit-logs" variant="ghost" size="sm" iconRight="chevronRight">
                  View audit log
                </Button>
              ) : null
            }
            flush
          >
            {(dashboard.data?.recentActivity ?? []).length === 0 ? (
              <EmptyState icon="audit" title="No activity recorded yet" />
            ) : (
              <div>
                {dashboard.data.recentActivity.map((entry) => (
                  <div className="notification-item" key={entry.id}>
                    <span
                      className={`stat__icon ${entry.status === 'failure' ? 'stat__icon--danger' : 'stat__icon--navy'}`}
                      style={{ width: 32, height: 32 }}
                      aria-hidden="true"
                    >
                      <Icon name={entry.status === 'failure' ? 'alert' : 'audit'} size={15} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row row--between" style={{ gap: 12 }}>
                        <span className="notification-item__title">{entry.description || entry.action}</span>
                        <StatusBadge status={entry.status} />
                      </div>
                      <div className="notification-item__text">
                        <span className="mono">{entry.action}</span>
                        {entry.actor_name ? ` · ${entry.actor_name}` : ''}
                        {entry.actor_email ? ` (${entry.actor_email})` : ''}
                      </div>
                      <div className="notification-item__time">{formatRelative(entry.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <p className="field__hint">
            Signed in as {user?.fullName} · {user?.roleLabel}. Every action shown here is enforced and recorded by
            the NexBank API.
          </p>
        </div>
      </QueryState>
    </>
  );
}
