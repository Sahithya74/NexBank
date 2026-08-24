import { useState } from 'react';
import Card, { StatCard } from '../components/Card';
import AccountCard from '../components/AccountCard';
import Button from '../components/Button';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import TransactionTable from '../components/TransactionTable';
import { EmptyState, QueryState, InlineAlert } from '../components/States';
import { useApiQuery } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { formatDate, formatMoney, humanise } from '../utils/format';

export default function Accounts() {
  const toast = useToast();
  const accounts = useApiQuery('/accounts');
  const summary = useApiQuery('/accounts/summary');

  const [selectedId, setSelectedId] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const [revealed, setRevealed] = useState(null);
  const [revealing, setRevealing] = useState(false);

  const activeId = selectedId ?? accounts.data?.[0]?.id ?? null;
  const activeAccount = (accounts.data ?? []).find((account) => account.id === activeId);

  const statement = useApiQuery(activeId ? `/accounts/${activeId}/statement` : '/accounts', {
    params: { page, limit: 10, from: range.from || undefined, to: range.to || undefined },
    enabled: Boolean(activeId),
  });

  const revealNumber = async () => {
    setRevealing(true);
    try {
      const result = await api.get(`/accounts/${activeId}/number`);
      setRevealed(result);
    } catch (error) {
      toast.error('Could not reveal account number', error.message);
    } finally {
      setRevealing(false);
    }
  };

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Accounts</h1>
          <p className="page__subtitle">Balances, details and statements for every account you hold.</p>
        </div>
      </div>

      <div className="stack">
        {summary.data ? (
          <div className="grid grid--3">
            <StatCard
              label="Total balance"
              value={formatMoney(summary.data.totalBalance, summary.data.base)}
              meta={`Valued in ${summary.data.base}`}
              icon="bank"
              tone="navy"
            />
            <StatCard
              label="Accounts"
              value={accounts.data?.length ?? 0}
              meta={`${(accounts.data ?? []).filter((a) => a.status === 'active').length} active`}
              icon="accounts"
              tone="info"
            />
            <StatCard
              label="Currencies held"
              value={summary.data.byCurrency.length}
              meta={summary.data.byCurrency.map((entry) => entry.currency).join(', ')}
              icon="globe"
              tone="success"
            />
          </div>
        ) : null}

        <div>
          <h2 className="section-title">Select an account</h2>
          <QueryState
            loading={accounts.loading}
            error={accounts.error}
            onRetry={accounts.reload}
            isEmpty={accounts.data?.length === 0}
            rows={2}
            empty={
              <Card>
                <EmptyState
                  icon="accounts"
                  title="You do not have any accounts yet"
                  text="Once an account is opened for you it will appear here."
                />
              </Card>
            }
          >
            <div className="grid grid--3">
              {(accounts.data ?? []).map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  selected={account.id === activeId}
                  onSelect={() => {
                    setSelectedId(account.id);
                    setPage(1);
                    setRevealed(null);
                  }}
                />
              ))}
            </div>
          </QueryState>
        </div>

        {activeAccount ? (
          <div className="grid grid--sidebar">
            <Card
              title="Account statement"
              subtitle={`${humanise(activeAccount.accountType)} account ${activeAccount.accountNumberMasked}`}
              flush
            >
              <div className="filter-bar">
                <FormField
                  label="From"
                  type="date"
                  value={range.from}
                  onChange={(event) => {
                    setRange((current) => ({ ...current, from: event.target.value }));
                    setPage(1);
                  }}
                />
                <FormField
                  label="To"
                  type="date"
                  value={range.to}
                  onChange={(event) => {
                    setRange((current) => ({ ...current, to: event.target.value }));
                    setPage(1);
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRange({ from: '', to: '' });
                    setPage(1);
                  }}
                >
                  Clear
                </Button>
              </div>

              {statement.data?.totals ? (
                <div className="row" style={{ gap: 24, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                  <span>
                    <span className="stat__label">Credits</span>
                    <div style={{ fontWeight: 650, color: 'var(--success)' }}>
                      {formatMoney(statement.data.totals.credits, activeAccount.currency)}
                    </div>
                  </span>
                  <span>
                    <span className="stat__label">Debits</span>
                    <div style={{ fontWeight: 650 }}>
                      {formatMoney(statement.data.totals.debits, activeAccount.currency)}
                    </div>
                  </span>
                </div>
              ) : null}

              <TransactionTable
                transactions={(statement.data?.items ?? []).map((item) => ({
                  ...item,
                  date: item.created_at,
                  currency: item.currency_code,
                  counterparty: item.counterparty_name,
                }))}
                loading={statement.loading}
                error={statement.error}
                onRetry={statement.reload}
                pagination={statement.data?.pagination}
                onPageChange={setPage}
                emptyTitle="No transactions in this period"
                emptyText="Try widening the date range."
              />
            </Card>

            <Card title="Account details">
              <dl className="dl">
                <dt>Account number</dt>
                <dd className="mono">{activeAccount.accountNumberMasked}</dd>
                <dt>Type</dt>
                <dd>{humanise(activeAccount.accountType)}</dd>
                <dt>Currency</dt>
                <dd>{activeAccount.currency}</dd>
                <dt>Status</dt>
                <dd style={{ textTransform: 'capitalize' }}>{activeAccount.status}</dd>
                <dt>IFSC</dt>
                <dd className="mono">{activeAccount.ifscCode || '—'}</dd>
                <dt>Branch</dt>
                <dd>{activeAccount.branch || '—'}</dd>
                <dt>Opened</dt>
                <dd>{formatDate(activeAccount.openedAt)}</dd>
                <dt>Available balance</dt>
                <dd>{formatMoney(activeAccount.balance, activeAccount.currency)}</dd>
              </dl>

              <div style={{ marginTop: 18 }}>
                <Button variant="secondary" icon="eye" block loading={revealing} onClick={revealNumber}>
                  Reveal full account number
                </Button>
                <p className="field__hint" style={{ marginTop: 8 }}>
                  Numbers are masked by default. Every reveal is recorded in the audit log.
                </p>
              </div>
            </Card>
          </div>
        ) : null}
      </div>

      <Modal
        open={Boolean(revealed)}
        onClose={() => setRevealed(null)}
        title="Your account number"
        subtitle="Share this only with people you intend to receive money from."
        size="sm"
        footer={<Button variant="secondary" onClick={() => setRevealed(null)}>Close</Button>}
      >
        <div className="stack" style={{ gap: 14 }}>
          <div>
            <span className="stat__label">Account number</span>
            <div className="mono" style={{ fontSize: 19, fontWeight: 650, letterSpacing: '0.04em' }}>
              {revealed?.accountNumber}
            </div>
          </div>
          <div>
            <span className="stat__label">IFSC code</span>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{revealed?.ifscCode || '—'}</div>
          </div>
          <InlineAlert variant="info">
            This reveal has been written to the audit log against your account.
          </InlineAlert>
        </div>
      </Modal>
    </>
  );
}
