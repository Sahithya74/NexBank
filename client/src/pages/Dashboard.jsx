import { Link } from 'react-router-dom';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Card, { StatCard, ChartCard } from '../components/Card';
import AccountCard from '../components/AccountCard';
import Button from '../components/Button';
import Icon from '../components/Icon';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState, QueryState } from '../components/States';
import { useApiQuery } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoney, humanise } from '../utils/format';

const CHART_COLOURS = ['#1f5fd9', '#0f8a5f', '#b7791f', '#7c4dbe', '#0b8fa8', '#c22b2b'];

const QUICK_ACTIONS = [
  { to: '/transfers', label: 'Transfer money', hint: 'Send to a beneficiary', icon: 'send', permission: 'transfer.create' },
  { to: '/wallet', label: 'Convert currency', hint: 'Live exchange rates', icon: 'swap', permission: 'wallet.convert' },
  { to: '/bills', label: 'Pay a bill', hint: 'Utilities and more', icon: 'bills', permission: 'bill.pay' },
  { to: '/loans', label: 'Apply for a loan', hint: 'Check your EMI', icon: 'loans', permission: 'loan.apply' },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user, can } = useAuth();

  const accounts = useApiQuery('/accounts', { enabled: can('account.view.own') });
  const summary = useApiQuery('/accounts/summary', { enabled: can('account.view.own') });
  const wallet = useApiQuery('/wallets', { enabled: can('wallet.view.own') });
  const analytics = useApiQuery('/transactions/analytics', { enabled: can('transaction.view.own') });
  const recent = useApiQuery('/transactions', {
    params: { limit: 6 },
    enabled: can('transaction.view.own'),
  });

  const actions = QUICK_ACTIONS.filter((action) => can(action.permission));
  const monthly = analytics.data?.series ?? [];
  const categories = (analytics.data?.categories ?? []).slice(0, 5);
  const stats = analytics.data?.summary;

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            {greeting()}, {user?.fullName?.split(' ')[0]}
          </h1>
          <p className="page__subtitle">
            Here is what has been happening across your accounts and wallet.
          </p>
        </div>
        <div className="page__actions">
          {can('transfer.create') ? (
            <Button to="/transfers" icon="send">Transfer money</Button>
          ) : null}
          {can('wallet.convert') ? (
            <Button to="/wallet" variant="secondary" icon="swap">Convert currency</Button>
          ) : null}
        </div>
      </div>

      <div className="stack">
        {/* Total balance + wallet portfolio */}
        <div className="grid grid--split">
          <div className="balance-hero">
            {summary.loading ? (
              <LoadingState label="Loading your balance…" />
            ) : summary.error ? (
              <p style={{ color: '#ffd9d9', fontSize: 13 }}>{summary.error.message}</p>
            ) : (
              <>
                <p className="balance-hero__label">Total balance across accounts</p>
                <p className="balance-hero__value">
                  {formatMoney(summary.data?.totalBalance ?? 0, summary.data?.base ?? 'INR')}
                </p>
                <p className="balance-hero__meta">
                  {summary.data?.byCurrency?.[0]?.accounts ?? 0} active account
                  {(summary.data?.byCurrency?.[0]?.accounts ?? 0) === 1 ? '' : 's'} · valued in{' '}
                  {summary.data?.base}
                </p>

                <div className="balance-hero__grid">
                  <div>
                    <p className="balance-hero__item-label">Wallet portfolio</p>
                    <p className="balance-hero__item-value">
                      {wallet.data
                        ? formatMoney(wallet.data.totalValue, wallet.data.base)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="balance-hero__item-label">Money in (30d)</p>
                    <p className="balance-hero__item-value">
                      {stats ? formatMoney(stats.income, 'INR', { compact: true }) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="balance-hero__item-label">Money out (30d)</p>
                    <p className="balance-hero__item-value">
                      {stats ? formatMoney(stats.spending, 'INR', { compact: true }) : '—'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <Card
            title="Multi-currency wallet"
            subtitle="Your holdings valued in one place"
            actions={<Button to="/wallet" variant="ghost" size="sm" iconRight="chevronRight">Open wallet</Button>}
          >
            <QueryState
              loading={wallet.loading}
              error={wallet.error}
              onRetry={wallet.reload}
              isEmpty={wallet.data?.balances?.length === 0}
              rows={3}
              empty={<EmptyState icon="wallet" title="No currencies yet" text="Add a currency to start using your wallet." />}
            >
              <div className="stack" style={{ gap: 10 }}>
                {(wallet.data?.balances ?? []).slice(0, 5).map((holding) => (
                  <div className="row row--between" key={holding.currency} style={{ gap: 12 }}>
                    <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                      <span className="currency-badge" style={{ width: 30, height: 30, fontSize: 12 }} aria-hidden="true">
                        {holding.symbol}
                      </span>
                      <span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{holding.currency}</span>
                        <span className="cell-sub">{holding.name}</span>
                      </span>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(holding.balance, holding.currency)}
                      </div>
                      {holding.currency !== wallet.data.base ? (
                        <div className="cell-sub">
                          ≈ {formatMoney(holding.convertedValue, wallet.data.base)}
                        </div>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </QueryState>
          </Card>
        </div>

        {/* Quick actions */}
        {actions.length > 0 ? (
          <div>
            <h2 className="section-title">Quick actions</h2>
            <div className="grid grid--4">
              {actions.map((action) => (
                <Link key={action.to} to={action.to} className="quick-action">
                  <span className="quick-action__icon" aria-hidden="true">
                    <Icon name={action.icon} size={17} />
                  </span>
                  <span>
                    <span className="quick-action__label">{action.label}</span>
                    <br />
                    <span className="quick-action__hint">{action.hint}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* Transaction stats */}
        {stats ? (
          <div className="grid grid--4">
            <StatCard label="Transactions (30d)" value={stats.total} icon="transactions" tone="info" />
            <StatCard
              label="Money in"
              value={formatMoney(stats.income, 'INR', { compact: true })}
              icon="arrowDown"
              tone="success"
            />
            <StatCard
              label="Money out"
              value={formatMoney(stats.spending, 'INR', { compact: true })}
              icon="arrowUp"
              tone="navy"
            />
            <StatCard
              label="Needs attention"
              value={stats.pending + stats.failed}
              meta={`${stats.pending} pending · ${stats.failed} failed`}
              icon="alert"
              tone={stats.failed > 0 ? 'danger' : 'warning'}
            />
          </div>
        ) : null}

        {/* Accounts */}
        {can('account.view.own') ? (
          <div>
            <h2 className="section-title">
              Your accounts
              <Button to="/accounts" variant="ghost" size="sm" iconRight="chevronRight">View all</Button>
            </h2>
            <QueryState
              loading={accounts.loading}
              error={accounts.error}
              onRetry={accounts.reload}
              isEmpty={accounts.data?.length === 0}
              rows={2}
              empty={<EmptyState icon="accounts" title="No accounts yet" text="Your accounts will appear here once opened." />}
            >
              <div className="grid grid--3">
                {(accounts.data ?? []).map((account) => (
                  <AccountCard key={account.id} account={account} as="div" />
                ))}
              </div>
            </QueryState>
          </div>
        ) : null}

        {/* Analytics */}
        <div className="grid grid--split">
          <ChartCard title="Money in and out" subtitle="Last six months" height={260}>
            {analytics.loading ? (
              <LoadingState label="Loading analytics…" />
            ) : analytics.error ? (
              <ErrorState error={analytics.error} onRetry={analytics.reload} />
            ) : monthly.length === 0 ? (
              <EmptyState icon="reports" title="Not enough history yet" text="Your monthly trend appears once you have activity." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f8a5f" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#0f8a5f" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1f5fd9" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#1f5fd9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e3e8f0" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#5b6b82' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#5b6b82' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatMoney(value, 'INR', { compact: true })}
                  />
                  <Tooltip
                    formatter={(value, name) => [formatMoney(value, 'INR'), name === 'income' ? 'Money in' : 'Money out']}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e3e8f0', fontSize: 12 }}
                  />
                  <Area isAnimationActive={false} type="monotone" dataKey="income" stroke="#0f8a5f" strokeWidth={2} fill="url(#inGradient)" />
                  <Area isAnimationActive={false} type="monotone" dataKey="spending" stroke="#1f5fd9" strokeWidth={2} fill="url(#outGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Where your money goes" subtitle="Last 30 days by type" height={260}>
            {analytics.loading ? (
              <LoadingState label="Loading breakdown…" />
            ) : categories.length === 0 ? (
              <EmptyState icon="reports" title="No spending yet" text="Your spending breakdown will appear here." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={categories}
                    dataKey="total"
                    nameKey="type"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {categories.map((entry, index) => (
                      <Cell key={entry.type} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [formatMoney(value, 'INR'), humanise(name)]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e3e8f0', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Recent transactions */}
        {can('transaction.view.own') ? (
          <Card
            title="Recent transactions"
            subtitle="Your latest activity"
            actions={<Button to="/transactions" variant="ghost" size="sm" iconRight="chevronRight">View all</Button>}
            flush
          >
            <QueryState
              loading={recent.loading}
              error={recent.error}
              onRetry={recent.reload}
              isEmpty={recent.data?.items?.length === 0}
              rows={5}
              empty={<EmptyState icon="transactions" title="No transactions yet" text="Your activity will appear here." />}
            >
              <div className="table-wrap">
                <table className="table table--stack">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Date</th>
                      <th className="num">Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recent.data?.items ?? []).map((transaction) => (
                      <tr key={transaction.id}>
                        <td data-label="Description">
                          <div className="cell-title">{transaction.description}</div>
                          <div className="cell-sub">{humanise(transaction.type)}</div>
                        </td>
                        <td data-label="Date">{formatDate(transaction.date)}</td>
                        <td data-label="Amount" className="num">
                          <span className={transaction.direction === 'credit' ? 'amount--credit' : 'amount--debit'}>
                            {transaction.direction === 'credit' ? '+' : '−'}
                            {formatMoney(transaction.amount, transaction.currency)}
                          </span>
                        </td>
                        <td data-label="Status">
                          <StatusBadge status={transaction.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </QueryState>
          </Card>
        ) : null}
      </div>
    </>
  );
}
