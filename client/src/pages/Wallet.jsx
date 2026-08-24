import { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import Card, { StatCard } from '../components/Card';
import CurrencyCard from '../components/CurrencyCard';
import Button from '../components/Button';
import Modal, { ConfirmationDialog } from '../components/Modal';
import FormField from '../components/FormField';
import Icon from '../components/Icon';
import { EmptyState, InlineAlert, LoadingState, QueryState } from '../components/States';
import { useApiQuery } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { formatDate, formatMoney } from '../utils/format';

const CHART_COLOURS = ['#1f5fd9', '#0f8a5f', '#b7791f', '#7c4dbe', '#0b8fa8', '#c22b2b'];

/** Live conversion preview, quoted by the server rather than computed here. */
function useQuote({ from, to, amount, open }) {
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !from || !to || !amount || Number(amount) <= 0 || from === to) {
      setQuote(null);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api.get('/wallets/quote', { params: { from, to, amount } });
        if (!cancelled) {
          setQuote(result);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setQuote(null);
          setError(caught);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [from, to, amount, open]);

  return { quote, error, loading };
}

export default function Wallet() {
  const toast = useToast();
  const wallet = useApiQuery('/wallets');
  const [conversionPage, setConversionPage] = useState(1);
  const conversions = useApiQuery('/wallets/conversions', {
    params: { page: conversionPage, limit: 5 },
  });

  const [convertOpen, setConvertOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [formError, setFormError] = useState(null);

  const [convertForm, setConvertForm] = useState({ from: '', to: '', amount: '' });
  const [newCurrency, setNewCurrency] = useState('');

  const balances = wallet.data?.balances ?? [];
  const distribution = wallet.data?.distribution ?? [];

  // Recharts needs numeric values; money arrives as exact decimal strings.
  const chartData = useMemo(
    () => distribution.map((entry) => ({ ...entry, value: Number(entry.value) })),
    [distribution],
  );

  const shareByCurrency = useMemo(
    () => Object.fromEntries(distribution.map((entry) => [entry.currency, entry.share])),
    [distribution],
  );

  const quote = useQuote({ ...convertForm, open: convertOpen });

  const openConvert = (from) => {
    const fallbackTo = balances.find((holding) => holding.currency !== from)?.currency ?? '';
    setConvertForm({ from: from || balances[0]?.currency || '', to: fallbackTo, amount: '' });
    setFormError(null);
    setConvertOpen(true);
  };

  const submitConvert = async (event) => {
    event.preventDefault();
    setFormError(null);

    if (convertForm.from === convertForm.to) {
      setFormError('Choose two different currencies.');
      return;
    }
    if (!convertForm.amount || Number(convertForm.amount) <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }

    setPending(true);
    try {
      const result = await api.post('/wallets/convert', convertForm);
      setConvertOpen(false);
      setReceipt(result);
      toast.success(
        'Conversion complete',
        `${formatMoney(result.fromAmount, result.from)} converted to ${formatMoney(result.toAmount, result.to)}.`,
      );
      await Promise.all([wallet.reload({ quiet: true }), conversions.reload({ quiet: true })]);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setPending(false);
    }
  };

  const submitAddCurrency = async (event) => {
    event.preventDefault();
    if (!newCurrency) return;
    setPending(true);
    try {
      await api.post('/wallets/currencies', { currency: newCurrency });
      toast.success(`${newCurrency} added`, 'You can now hold and convert this currency.');
      setAddOpen(false);
      setNewCurrency('');
      await wallet.reload({ quiet: true });
    } catch (error) {
      toast.error('Could not add currency', error.message);
    } finally {
      setPending(false);
    }
  };

  const confirmRemove = async () => {
    setPending(true);
    try {
      await api.delete(`/wallets/currencies/${removeTarget}`);
      toast.success(`${removeTarget} removed`, 'The empty balance has been closed.');
      setRemoveTarget(null);
      await wallet.reload({ quiet: true });
    } catch (error) {
      toast.error('Could not remove currency', error.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Multi-currency wallet</h1>
          <p className="page__subtitle">
            Hold balances in several currencies and convert between them at live rates.
          </p>
        </div>
        <div className="page__actions">
          <Button variant="secondary" icon="plus" onClick={() => setAddOpen(true)}>Add currency</Button>
          <Button icon="swap" onClick={() => openConvert()} disabled={balances.length < 2}>
            Convert
          </Button>
        </div>
      </div>

      <QueryState loading={wallet.loading} error={wallet.error} onRetry={wallet.reload} rows={4}>
        <div className="stack">
          <div className="grid grid--split">
            <div className="balance-hero">
              <p className="balance-hero__label">Total portfolio value</p>
              <p className="balance-hero__value">
                {formatMoney(wallet.data?.totalValue ?? 0, wallet.data?.base ?? 'INR')}
              </p>
              <p className="balance-hero__meta">
                {balances.length} currenc{balances.length === 1 ? 'y' : 'ies'} · valued in {wallet.data?.base}
              </p>
              <div className="balance-hero__grid">
                {balances.slice(0, 3).map((holding) => (
                  <div key={holding.currency}>
                    <p className="balance-hero__item-label">{holding.currency}</p>
                    <p className="balance-hero__item-value">
                      {formatMoney(holding.balance, holding.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Card title="Portfolio distribution" subtitle={`Share of total value in ${wallet.data?.base}`}>
              {distribution.length === 0 ? (
                <EmptyState icon="wallet" title="No balances yet" />
              ) : (
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        isAnimationActive={false}
                        data={chartData}
                        dataKey="value"
                        nameKey="currency"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {distribution.map((entry, index) => (
                          <Cell key={entry.currency} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [formatMoney(value, wallet.data.base), name]}
                        contentStyle={{ borderRadius: 10, border: '1px solid #e3e8f0', fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          <div>
            <h2 className="section-title">Your currencies</h2>
            {balances.length === 0 ? (
              <Card>
                <EmptyState
                  icon="wallet"
                  title="Your wallet is empty"
                  text="Add a currency to start holding and converting funds."
                  action={<Button icon="plus" onClick={() => setAddOpen(true)}>Add currency</Button>}
                />
              </Card>
            ) : (
              <div className="grid grid--3">
                {balances.map((holding) => (
                  <CurrencyCard
                    key={holding.currency}
                    holding={holding}
                    base={wallet.data.base}
                    baseSymbol={wallet.data.baseSymbol}
                    share={shareByCurrency[holding.currency] ?? 0}
                    onConvert={openConvert}
                    onRemove={setRemoveTarget}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid--split">
            <Card title="Exchange rates" subtitle={`Quoted against ${wallet.data?.base}`} flush>
              <div className="table-wrap">
                <table className="table table--stack table--fit">
                  <thead>
                    <tr>
                      <th>Currency</th>
                      <th className="num">1 unit in {wallet.data?.base}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(wallet.data?.rates ?? []).map((rate) => (
                      <tr key={rate.code}>
                        <td data-label="Currency">
                          <div className="row" style={{ gap: 9, flexWrap: 'nowrap' }}>
                            <span className="currency-badge" style={{ width: 28, height: 28, fontSize: 12 }} aria-hidden="true">
                              {rate.symbol}
                            </span>
                            <span>
                              <span className="cell-title">{rate.code}</span>
                              <span className="cell-sub">{rate.name}</span>
                            </span>
                          </div>
                        </td>
                        <td data-label={`In ${wallet.data?.base}`} className="num">
                          {rate.rate ? Number(rate.rate).toFixed(4) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Recent conversions" subtitle="Your conversion history" flush>
              <QueryState
                loading={conversions.loading}
                error={conversions.error}
                onRetry={conversions.reload}
                isEmpty={conversions.data?.items?.length === 0}
                rows={4}
                empty={<EmptyState icon="swap" title="No conversions yet" text="Converted amounts will appear here." />}
              >
                <div className="table-wrap">
                  <table className="table table--stack table--fit">
                    <thead>
                      <tr>
                        <th>Conversion</th>
                        <th>Rate</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(conversions.data?.items ?? []).map((conversion) => (
                        <tr key={conversion.reference}>
                          <td data-label="Conversion">
                            <div className="cell-title">
                              {formatMoney(conversion.from_amount, conversion.from_currency)} →{' '}
                              {formatMoney(conversion.to_amount, conversion.to_currency)}
                            </div>
                            <div className="cell-sub mono">{conversion.reference}</div>
                          </td>
                          <td data-label="Rate">{Number(conversion.rate).toFixed(4)}</td>
                          <td data-label="Date">{formatDate(conversion.created_at, { withTime: true })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </QueryState>
              {conversions.data?.pagination?.total > 5 ? (
                <div className="pagination">
                  <span className="pagination__info">
                    Page {conversions.data.pagination.page} of{' '}
                    {Math.ceil(conversions.data.pagination.total / conversions.data.pagination.limit)}
                  </span>
                  <div className="pagination__controls">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={conversionPage <= 1}
                      onClick={() => setConversionPage((page) => page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={
                        conversionPage >= Math.ceil(conversions.data.pagination.total / conversions.data.pagination.limit)
                      }
                      onClick={() => setConversionPage((page) => page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      </QueryState>

      {/* Convert */}
      <Modal
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        title="Convert currency"
        subtitle="Rates are quoted live by NexBank at the moment you convert."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConvertOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitConvert} loading={pending} disabled={!quote.quote}>
              Convert now
            </Button>
          </>
        }
      >
        <form onSubmit={submitConvert} className="stack" style={{ gap: 14 }}>
          {formError ? <InlineAlert variant="danger">{formError}</InlineAlert> : null}

          <div className="form-grid">
            <FormField
              label="From"
              as="select"
              value={convertForm.from}
              onChange={(event) => setConvertForm((form) => ({ ...form, from: event.target.value }))}
              required
            >
              {balances.map((holding) => (
                <option key={holding.currency} value={holding.currency}>
                  {holding.currency} — {formatMoney(holding.balance, holding.currency)} available
                </option>
              ))}
            </FormField>

            <FormField
              label="To"
              as="select"
              value={convertForm.to}
              onChange={(event) => setConvertForm((form) => ({ ...form, to: event.target.value }))}
              required
            >
              <option value="">Select a currency</option>
              {(wallet.data?.rates ?? [])
                .filter((rate) => rate.code !== convertForm.from)
                .map((rate) => (
                  <option key={rate.code} value={rate.code}>
                    {rate.code} — {rate.name}
                  </option>
                ))}
            </FormField>
          </div>

          <FormField
            label={`Amount in ${convertForm.from || ''}`}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
            value={convertForm.amount}
            onChange={(event) => setConvertForm((form) => ({ ...form, amount: event.target.value }))}
            hint={
              convertForm.from
                ? `Available: ${formatMoney(
                    balances.find((holding) => holding.currency === convertForm.from)?.balance ?? 0,
                    convertForm.from,
                  )}`
                : undefined
            }
            required
          />

          <div className="card" style={{ background: 'var(--surface-muted)' }}>
            <div className="card__body">
              {quote.loading ? (
                <LoadingState label="Fetching live rate…" />
              ) : quote.error ? (
                <InlineAlert variant="danger">{quote.error.message}</InlineAlert>
              ) : quote.quote ? (
                <div className="review-list">
                  <div className="review-row">
                    <span className="review-row__label">Exchange rate</span>
                    <span className="review-row__value">
                      1 {quote.quote.from} = {Number(quote.quote.rate).toFixed(4)} {quote.quote.to}
                    </span>
                  </div>
                  <div className="review-row">
                    <span className="review-row__label">You convert</span>
                    <span className="review-row__value">
                      {formatMoney(quote.quote.amount, quote.quote.from)}
                    </span>
                  </div>
                  <div className="review-row review-row--total">
                    <span className="review-row__label">You receive</span>
                    <span className="review-row__value" style={{ color: 'var(--success)' }}>
                      {formatMoney(quote.quote.convertedAmount, quote.quote.to)}
                    </span>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Choose currencies and an amount to see a live quote.
                </p>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Add currency */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a currency"
        subtitle="Open a new balance in your wallet."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submitAddCurrency} loading={pending} disabled={!newCurrency}>Add currency</Button>
          </>
        }
      >
        {(wallet.data?.availableCurrencies ?? []).length === 0 ? (
          <EmptyState icon="check" title="You already hold every available currency" />
        ) : (
          <form onSubmit={submitAddCurrency}>
            <FormField
              label="Currency"
              as="select"
              value={newCurrency}
              onChange={(event) => setNewCurrency(event.target.value)}
              required
            >
              <option value="">Select a currency</option>
              {(wallet.data?.availableCurrencies ?? []).map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
            </FormField>
          </form>
        )}
      </Modal>

      <ConfirmationDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        pending={pending}
        title={`Remove ${removeTarget}?`}
        message={`This closes your empty ${removeTarget} balance. You can add it again at any time.`}
        confirmLabel="Remove currency"
        variant="danger"
      />

      {/* Receipt */}
      <Modal
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title="Conversion receipt"
        size="sm"
        footer={<Button onClick={() => setReceipt(null)}>Done</Button>}
      >
        <div className="success-panel" style={{ padding: '10px 0 18px' }}>
          <span className="success-mark">
            <Icon name="check" size={24} />
          </span>
          <h3 style={{ fontSize: 17 }}>Conversion complete</h3>
          <p className="state__text" style={{ margin: '6px auto 0' }}>
            Your wallet balances have been updated.
          </p>
        </div>
        <div className="review-list">
          <div className="review-row">
            <span className="review-row__label">Reference</span>
            <span className="review-row__value mono">{receipt?.reference}</span>
          </div>
          <div className="review-row">
            <span className="review-row__label">Converted</span>
            <span className="review-row__value">{formatMoney(receipt?.fromAmount, receipt?.from)}</span>
          </div>
          <div className="review-row">
            <span className="review-row__label">Received</span>
            <span className="review-row__value">{formatMoney(receipt?.toAmount, receipt?.to)}</span>
          </div>
          <div className="review-row">
            <span className="review-row__label">Rate applied</span>
            <span className="review-row__value">{Number(receipt?.rate ?? 0).toFixed(4)}</span>
          </div>
        </div>
      </Modal>
    </>
  );
}
