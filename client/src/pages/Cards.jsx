import { useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import FormField from '../components/FormField';
import Modal, { ConfirmationDialog } from '../components/Modal';
import Icon from '../components/Icon';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, QueryState, InlineAlert } from '../components/States';
import { useApiQuery } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { formatDate, formatMoney, humanise } from '../utils/format';

export default function Cards() {
  const toast = useToast();
  const cards = useApiQuery('/cards');
  const [selectedId, setSelectedId] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [controls, setControls] = useState({ online: true, international: false, contactless: true, dailyLimit: '' });

  const activeId = selectedId ?? cards.data?.[0]?.id ?? null;
  const card = (cards.data ?? []).find((item) => item.id === activeId);

  const transactions = useApiQuery(activeId ? `/cards/${activeId}/transactions` : '/cards', {
    enabled: Boolean(activeId),
  });

  const openControls = () => {
    setControls({
      online: card.controls.online,
      international: card.controls.international,
      contactless: card.controls.contactless,
      dailyLimit: card.dailyLimit,
    });
    setError(null);
    setControlsOpen(true);
  };

  const toggleBlock = async () => {
    setPending(true);
    try {
      const nextStatus = blockTarget.status === 'blocked' ? 'active' : 'blocked';
      await api.patch(`/cards/${blockTarget.id}/status`, { status: nextStatus });
      toast.success(
        nextStatus === 'blocked' ? 'Card blocked' : 'Card unblocked',
        `Card ending ${blockTarget.lastFour} is now ${nextStatus}.`,
      );
      setBlockTarget(null);
      await cards.reload({ quiet: true });
    } catch (caught) {
      toast.error('Could not update card', caught.message);
    } finally {
      setPending(false);
    }
  };

  const saveControls = async (event) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.patch(`/cards/${card.id}/controls`, {
        online: controls.online,
        international: controls.international,
        contactless: controls.contactless,
        dailyLimit: String(controls.dailyLimit),
      });
      toast.success('Card controls updated');
      setControlsOpen(false);
      await cards.reload({ quiet: true });
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
          <h1 className="page__title">Cards</h1>
          <p className="page__subtitle">
            Manage your debit and credit cards, set spending controls and block a card instantly.
          </p>
        </div>
      </div>

      <QueryState
        loading={cards.loading}
        error={cards.error}
        onRetry={cards.reload}
        isEmpty={cards.data?.length === 0}
        rows={3}
        empty={
          <Card>
            <EmptyState icon="cards" title="No cards issued" text="Cards issued to you will appear here." />
          </Card>
        }
      >
        <div className="stack">
          <div className="grid grid--3">
            {(cards.data ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                style={{ padding: 0, border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }}
                aria-pressed={item.id === activeId}
              >
                <div
                  className={`bank-card ${item.cardType === 'credit' ? 'bank-card--credit' : ''} ${
                    item.status === 'blocked' ? 'bank-card--blocked' : ''
                  }`}
                  style={item.id === activeId ? { boxShadow: '0 0 0 3px var(--blue-100)' } : undefined}
                >
                  <div className="bank-card__row">
                    <span>
                      <span className="bank-card__label">NexBank</span>
                      <div className="bank-card__value" style={{ textTransform: 'capitalize' }}>
                        {item.cardType} · {item.network}
                      </div>
                    </span>
                    <Icon name={item.status === 'blocked' ? 'block' : 'cards'} size={22} />
                  </div>

                  <div className="bank-card__number">{item.numberMasked}</div>

                  <div className="bank-card__row">
                    <span>
                      <span className="bank-card__label">Card holder</span>
                      <div className="bank-card__value">{item.cardHolder}</div>
                    </span>
                    <span>
                      <span className="bank-card__label">Expires</span>
                      <div className="bank-card__value">{item.expiry}</div>
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {card ? (
            <div className="grid grid--sidebar">
              <Card
                title="Card details"
                subtitle={`${humanise(card.cardType)} card ${card.numberMasked}`}
                actions={<StatusBadge status={card.status} />}
              >
                <dl className="dl">
                  <dt>Card number</dt>
                  <dd className="mono">{card.numberMasked}</dd>
                  <dt>Card holder</dt>
                  <dd>{card.cardHolder}</dd>
                  <dt>Network</dt>
                  <dd style={{ textTransform: 'capitalize' }}>{card.network}</dd>
                  <dt>Expires</dt>
                  <dd>{card.expiry}</dd>
                  <dt>Linked account</dt>
                  <dd className="mono">{card.linkedAccount || '—'}</dd>
                  <dt>Daily limit</dt>
                  <dd>{formatMoney(card.dailyLimit, 'INR')}</dd>
                  {card.creditLimit ? (
                    <>
                      <dt>Credit limit</dt>
                      <dd>{formatMoney(card.creditLimit, 'INR')}</dd>
                    </>
                  ) : null}
                  <dt>Issued</dt>
                  <dd>{formatDate(card.createdAt)}</dd>
                </dl>

                <div className="row" style={{ gap: 8, marginTop: 18 }}>
                  <Button
                    variant={card.status === 'blocked' ? 'primary' : 'danger'}
                    icon={card.status === 'blocked' ? 'check' : 'block'}
                    onClick={() => setBlockTarget(card)}
                    disabled={card.status === 'expired'}
                  >
                    {card.status === 'blocked' ? 'Unblock card' : 'Block card'}
                  </Button>
                  <Button
                    variant="secondary"
                    icon="settings"
                    onClick={openControls}
                    disabled={card.status !== 'active'}
                  >
                    Card controls
                  </Button>
                </div>

                {card.status === 'blocked' ? (
                  <div style={{ marginTop: 14 }}>
                    <InlineAlert variant="warning">
                      This card is blocked. No new payments will be authorised until you unblock it.
                    </InlineAlert>
                  </div>
                ) : null}
              </Card>

              <Card title="Usage controls" subtitle="What this card is allowed to do">
                <div>
                  {[
                    { key: 'online', label: 'Online payments', hint: 'E-commerce and in-app purchases' },
                    { key: 'international', label: 'International use', hint: 'Payments outside India' },
                    { key: 'contactless', label: 'Contactless', hint: 'Tap to pay at terminals' },
                  ].map((control) => (
                    <div className="switch-row" key={control.key}>
                      <span>
                        <div className="checkbox-row__label">{control.label}</div>
                        <div className="checkbox-row__hint">{control.hint}</div>
                      </span>
                      <span className={`badge badge--${card.controls[control.key] ? 'success' : 'neutral'}`}>
                        {card.controls[control.key] ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          <Card title="Card transactions" subtitle="Recent purchases made with this card" flush>
            <QueryState
              loading={transactions.loading}
              error={transactions.error}
              onRetry={transactions.reload}
              isEmpty={transactions.data?.length === 0}
              rows={3}
              empty={
                <EmptyState
                  icon="cards"
                  title="No card transactions yet"
                  text="Purchases made with this card will appear here."
                />
              }
            >
              <div className="table-wrap">
                <table className="table table--stack">
                  <thead>
                    <tr>
                      <th>Merchant</th>
                      <th>Reference</th>
                      <th>Date</th>
                      <th className="num">Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(transactions.data ?? []).map((row) => (
                      <tr key={row.id}>
                        <td data-label="Merchant">
                          <div className="cell-title">{row.counterparty_name || row.description}</div>
                          <div className="cell-sub">{row.description}</div>
                        </td>
                        <td data-label="Reference" className="mono">{row.reference}</td>
                        <td data-label="Date">{formatDate(row.created_at, { withTime: true })}</td>
                        <td data-label="Amount" className="num">{formatMoney(row.amount, row.currency_code)}</td>
                        <td data-label="Status"><StatusBadge status={row.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </QueryState>
          </Card>
        </div>
      </QueryState>

      <ConfirmationDialog
        open={Boolean(blockTarget)}
        onClose={() => setBlockTarget(null)}
        onConfirm={toggleBlock}
        pending={pending}
        title={blockTarget?.status === 'blocked' ? 'Unblock this card?' : 'Block this card?'}
        message={
          blockTarget?.status === 'blocked'
            ? `Card ending ${blockTarget?.lastFour} will be able to make payments again.`
            : `Card ending ${blockTarget?.lastFour} will immediately stop authorising payments. You can unblock it at any time.`
        }
        confirmLabel={blockTarget?.status === 'blocked' ? 'Unblock card' : 'Block card'}
        variant={blockTarget?.status === 'blocked' ? 'primary' : 'danger'}
      />

      <Modal
        open={controlsOpen}
        onClose={() => setControlsOpen(false)}
        title="Card controls"
        subtitle={card ? `Card ending ${card.lastFour}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setControlsOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={saveControls} loading={pending}>Save controls</Button>
          </>
        }
      >
        <form onSubmit={saveControls} className="stack" style={{ gap: 6 }}>
          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

          {[
            { key: 'online', label: 'Online payments', hint: 'Allow e-commerce and in-app purchases' },
            { key: 'international', label: 'International use', hint: 'Allow payments outside India' },
            { key: 'contactless', label: 'Contactless', hint: 'Allow tap to pay at terminals' },
          ].map((control) => (
            <label className="checkbox-row" key={control.key}>
              <input
                type="checkbox"
                checked={controls[control.key]}
                onChange={(event) =>
                  setControls((current) => ({ ...current, [control.key]: event.target.checked }))
                }
              />
              <span>
                <span className="checkbox-row__label">{control.label}</span>
                <br />
                <span className="checkbox-row__hint">{control.hint}</span>
              </span>
            </label>
          ))}

          <div style={{ marginTop: 12 }}>
            <FormField
              label="Daily spending limit (INR)"
              type="number"
              step="100"
              min="0"
              value={controls.dailyLimit}
              onChange={(event) => setControls((current) => ({ ...current, dailyLimit: event.target.value }))}
              hint="Payments above this amount in a single day will be declined."
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
