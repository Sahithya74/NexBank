import { useMemo, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import FormField from '../components/FormField';
import Modal, { ConfirmationDialog } from '../components/Modal';
import Icon from '../components/Icon';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import { EmptyState, InlineAlert, QueryState } from '../components/States';
import { useApiQuery } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { formatDate, formatMoney, humanise } from '../utils/format';

const STEPS = ['Recipient', 'Amount', 'Review', 'Confirm'];

/** Stable key so a double submit cannot create a second transfer. */
function newIdempotencyKey() {
  return `tr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Transfers() {
  const toast = useToast();
  const accounts = useApiQuery('/accounts');
  const beneficiaries = useApiQuery('/beneficiaries');
  const [page, setPage] = useState(1);
  const history = useApiQuery('/transfers', { params: { page, limit: 10 } });

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    mode: 'beneficiary',
    fromAccountId: '',
    toAccountId: '',
    beneficiaryId: '',
    amount: '',
    remarks: '',
  });
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [benForm, setBenForm] = useState({ nickname: '', accountNumber: '', holderName: '', ifscCode: '' });
  const [benError, setBenError] = useState(null);
  const [verified, setVerified] = useState(null);

  const activeAccounts = (accounts.data ?? []).filter((account) => account.status === 'active');
  const fromAccount = activeAccounts.find((account) => String(account.id) === String(form.fromAccountId));
  const beneficiary = (beneficiaries.data ?? []).find(
    (item) => String(item.id) === String(form.beneficiaryId),
  );
  const toAccount = activeAccounts.find((account) => String(account.id) === String(form.toAccountId));

  const recipientLabel = useMemo(() => {
    if (form.mode === 'own') return toAccount ? `${humanise(toAccount.accountType)} · ${toAccount.accountNumberMasked}` : '';
    return beneficiary ? `${beneficiary.holderName} · ${beneficiary.accountNumberMasked}` : '';
  }, [form.mode, toAccount, beneficiary]);

  const resetFlow = () => {
    setStep(0);
    setForm({ mode: 'beneficiary', fromAccountId: '', toAccountId: '', beneficiaryId: '', amount: '', remarks: '' });
    setIdempotencyKey(newIdempotencyKey());
    setErrors({});
    setFormError(null);
  };

  const validateStep = () => {
    const next = {};
    if (step === 0) {
      if (!form.fromAccountId) next.fromAccountId = 'Choose the account to send from.';
      if (form.mode === 'own' && !form.toAccountId) next.toAccountId = 'Choose the account to send to.';
      if (form.mode === 'beneficiary' && !form.beneficiaryId) next.beneficiaryId = 'Choose a beneficiary.';
      if (form.mode === 'own' && form.fromAccountId && form.fromAccountId === form.toAccountId) {
        next.toAccountId = 'Choose two different accounts.';
      }
    }
    if (step === 1) {
      const amount = Number(form.amount);
      if (!form.amount || Number.isNaN(amount) || amount <= 0) {
        next.amount = 'Enter an amount greater than zero.';
      } else if (fromAccount && amount > Number(fromAccount.balance)) {
        next.amount = `Amount exceeds your available balance of ${formatMoney(fromAccount.balance, fromAccount.currency)}.`;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (validateStep()) setStep((current) => current + 1);
  };

  const submitTransfer = async () => {
    setPending(true);
    setFormError(null);
    try {
      const payload = {
        mode: form.mode,
        fromAccountId: Number(form.fromAccountId),
        amount: form.amount,
        remarks: form.remarks || undefined,
        idempotencyKey,
        ...(form.mode === 'own'
          ? { toAccountId: Number(form.toAccountId) }
          : { beneficiaryId: Number(form.beneficiaryId) }),
      };
      const result = await api.post('/transfers', payload);
      setReceipt(result);
      setStep(3);
      toast.success('Transfer completed', `${formatMoney(result.amount, result.currency)} sent successfully.`);
      await Promise.all([accounts.reload({ quiet: true }), history.reload({ quiet: true })]);
    } catch (error) {
      setFormError(error.message);
      if (error.details) setErrors(error.details);
    } finally {
      setPending(false);
    }
  };

  const verifyBeneficiary = async () => {
    setBenError(null);
    setVerified(null);
    if (!benForm.accountNumber.trim()) {
      setBenError('Enter the account number to verify.');
      return;
    }
    try {
      const result = await api.get('/beneficiaries/verify', {
        params: { accountNumber: benForm.accountNumber.trim() },
      });
      setVerified(result);
      setBenForm((current) => ({ ...current, holderName: result.holderName }));
    } catch (error) {
      setBenError(error.message);
    }
  };

  const addBeneficiary = async (event) => {
    event.preventDefault();
    setBenError(null);
    setPending(true);
    try {
      await api.post('/beneficiaries', {
        nickname: benForm.nickname.trim(),
        accountNumber: benForm.accountNumber.trim(),
        holderName: benForm.holderName.trim() || undefined,
        ifscCode: benForm.ifscCode.trim() || undefined,
      });
      toast.success('Beneficiary added', `${benForm.nickname} is ready to receive transfers.`);
      setAddOpen(false);
      setBenForm({ nickname: '', accountNumber: '', holderName: '', ifscCode: '' });
      setVerified(null);
      await beneficiaries.reload({ quiet: true });
    } catch (error) {
      setBenError(error.message);
    } finally {
      setPending(false);
    }
  };

  const removeBeneficiary = async () => {
    setPending(true);
    try {
      await api.delete(`/beneficiaries/${removeTarget.id}`);
      toast.success('Beneficiary removed', `${removeTarget.nickname} has been removed.`);
      setRemoveTarget(null);
      await beneficiaries.reload({ quiet: true });
    } catch (error) {
      toast.error('Could not remove beneficiary', error.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Transfer money</h1>
          <p className="page__subtitle">Move funds between your accounts or send to a saved beneficiary.</p>
        </div>
        <div className="page__actions">
          <Button variant="secondary" icon="plus" onClick={() => setAddOpen(true)}>Add beneficiary</Button>
        </div>
      </div>

      <div className="grid grid--sidebar">
        <Card flush>
          <div className="stepper" role="list" aria-label="Transfer progress">
            {STEPS.map((label, index) => (
              <div
                key={label}
                role="listitem"
                className={`step ${index === step ? 'is-active' : ''} ${index < step ? 'is-done' : ''}`}
              >
                <span className="step__dot">{index < step ? <Icon name="check" size={12} /> : index + 1}</span>
                <span className="step__label">{label}</span>
                {index < STEPS.length - 1 ? <span className="step__line" aria-hidden="true" /> : null}
              </div>
            ))}
          </div>

          <div className="card__body">
            {formError ? (
              <div style={{ marginBottom: 16 }}>
                <InlineAlert variant="danger">{formError}</InlineAlert>
              </div>
            ) : null}

            {/* Step 1 - recipient */}
            {step === 0 ? (
              <div className="stack" style={{ gap: 16 }}>
                <div>
                  <span className="field__label" style={{ display: 'block', marginBottom: 8 }}>
                    Transfer type
                  </span>
                  <div className="row" style={{ gap: 8 }}>
                    <Button
                      variant={form.mode === 'beneficiary' ? 'primary' : 'secondary'}
                      icon="send"
                      onClick={() => setForm((current) => ({ ...current, mode: 'beneficiary', toAccountId: '' }))}
                    >
                      To a beneficiary
                    </Button>
                    <Button
                      variant={form.mode === 'own' ? 'primary' : 'secondary'}
                      icon="swap"
                      onClick={() => setForm((current) => ({ ...current, mode: 'own', beneficiaryId: '' }))}
                    >
                      Between my accounts
                    </Button>
                  </div>
                </div>

                <FormField
                  label="From account"
                  as="select"
                  value={form.fromAccountId}
                  onChange={(event) => setForm((current) => ({ ...current, fromAccountId: event.target.value }))}
                  error={errors.fromAccountId}
                  required
                >
                  <option value="">Select an account</option>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {humanise(account.accountType)} {account.accountNumberMasked} ·{' '}
                      {formatMoney(account.balance, account.currency)}
                    </option>
                  ))}
                </FormField>

                {form.mode === 'own' ? (
                  <FormField
                    label="To account"
                    as="select"
                    value={form.toAccountId}
                    onChange={(event) => setForm((current) => ({ ...current, toAccountId: event.target.value }))}
                    error={errors.toAccountId}
                    required
                  >
                    <option value="">Select an account</option>
                    {activeAccounts
                      .filter((account) => String(account.id) !== String(form.fromAccountId))
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {humanise(account.accountType)} {account.accountNumberMasked} ·{' '}
                          {formatMoney(account.balance, account.currency)}
                        </option>
                      ))}
                  </FormField>
                ) : (
                  <QueryState
                    loading={beneficiaries.loading}
                    error={beneficiaries.error}
                    onRetry={beneficiaries.reload}
                    isEmpty={beneficiaries.data?.length === 0}
                    rows={2}
                    empty={
                      <EmptyState
                        icon="users"
                        title="No beneficiaries saved"
                        text="Add someone you want to send money to."
                        action={<Button icon="plus" onClick={() => setAddOpen(true)}>Add beneficiary</Button>}
                      />
                    }
                  >
                    <FormField
                      label="Beneficiary"
                      as="select"
                      value={form.beneficiaryId}
                      onChange={(event) => setForm((current) => ({ ...current, beneficiaryId: event.target.value }))}
                      error={errors.beneficiaryId}
                      required
                    >
                      <option value="">Select a beneficiary</option>
                      {(beneficiaries.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nickname} — {item.holderName} ({item.accountNumberMasked})
                        </option>
                      ))}
                    </FormField>
                  </QueryState>
                )}
              </div>
            ) : null}

            {/* Step 2 - amount */}
            {step === 1 ? (
              <div className="stack" style={{ gap: 16 }}>
                <div className="card" style={{ background: 'var(--surface-muted)' }}>
                  <div className="card__body">
                    <div className="review-list">
                      <div className="review-row">
                        <span className="review-row__label">From</span>
                        <span className="review-row__value">
                          {fromAccount?.accountNumberMasked} · {formatMoney(fromAccount?.balance, fromAccount?.currency)}
                        </span>
                      </div>
                      <div className="review-row">
                        <span className="review-row__label">To</span>
                        <span className="review-row__value">{recipientLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <FormField
                  label={`Amount (${fromAccount?.currency ?? 'INR'})`}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  error={errors.amount}
                  hint={fromAccount ? `Available: ${formatMoney(fromAccount.balance, fromAccount.currency)}` : undefined}
                  required
                />

                <FormField
                  label="Remarks (optional)"
                  as="textarea"
                  rows={3}
                  maxLength={255}
                  placeholder="What is this transfer for?"
                  value={form.remarks}
                  onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
                />
              </div>
            ) : null}

            {/* Step 3 - review */}
            {step === 2 ? (
              <div className="stack" style={{ gap: 16 }}>
                <InlineAlert variant="info">
                  Check these details carefully. Transfers to another customer cannot be reversed.
                </InlineAlert>

                <div className="review-list">
                  <div className="review-row">
                    <span className="review-row__label">From</span>
                    <span className="review-row__value">
                      {humanise(fromAccount?.accountType)} {fromAccount?.accountNumberMasked}
                    </span>
                  </div>
                  <div className="review-row">
                    <span className="review-row__label">To</span>
                    <span className="review-row__value">{recipientLabel}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-row__label">Remarks</span>
                    <span className="review-row__value">{form.remarks || '—'}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-row__label">Balance after transfer</span>
                    <span className="review-row__value">
                      {formatMoney(Number(fromAccount?.balance ?? 0) - Number(form.amount || 0), fromAccount?.currency)}
                    </span>
                  </div>
                  <div className="review-row review-row--total">
                    <span className="review-row__label">Amount</span>
                    <span className="review-row__value">
                      {formatMoney(form.amount, fromAccount?.currency)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Step 4 - result */}
            {step === 3 && receipt ? (
              <div>
                <div className="success-panel">
                  <span className="success-mark">
                    <Icon name="check" size={26} />
                  </span>
                  <h3 style={{ fontSize: 18 }}>Transfer completed</h3>
                  <p className="state__text" style={{ margin: '6px auto 0' }}>
                    {formatMoney(receipt.amount, receipt.currency)} has been sent to {receipt.counterparty}.
                  </p>
                </div>
                <div className="review-list">
                  <div className="review-row">
                    <span className="review-row__label">Reference</span>
                    <span className="review-row__value mono">{receipt.reference}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-row__label">From</span>
                    <span className="review-row__value">{receipt.fromAccount}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-row__label">To</span>
                    <span className="review-row__value">{receipt.toAccount}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-row__label">Status</span>
                    <span className="review-row__value"><StatusBadge status={receipt.status} /></span>
                  </div>
                  <div className="review-row">
                    <span className="review-row__label">Balance after</span>
                    <span className="review-row__value">
                      {formatMoney(receipt.balanceAfter, receipt.currency)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="card__footer">
            <div className="row row--between">
              {step > 0 && step < 3 ? (
                <Button variant="secondary" icon="chevronLeft" onClick={() => setStep((current) => current - 1)}>
                  Back
                </Button>
              ) : (
                <span />
              )}

              {step < 2 ? (
                <Button iconRight="chevronRight" onClick={goNext}>Continue</Button>
              ) : step === 2 ? (
                <Button icon="lock" onClick={submitTransfer} loading={pending}>
                  Confirm and send
                </Button>
              ) : (
                <Button onClick={resetFlow} icon="plus">Make another transfer</Button>
              )}
            </div>
          </div>
        </Card>

        <Card
          title="Beneficiaries"
          subtitle={`${beneficiaries.data?.length ?? 0} saved`}
          actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => setAddOpen(true)}>Add</Button>}
          flush
        >
          <QueryState
            loading={beneficiaries.loading}
            error={beneficiaries.error}
            onRetry={beneficiaries.reload}
            isEmpty={beneficiaries.data?.length === 0}
            rows={3}
            empty={<EmptyState icon="users" title="No beneficiaries yet" text="Saved recipients appear here." />}
          >
            <div>
              {(beneficiaries.data ?? []).map((item) => (
                <div className="notification-item" key={item.id}>
                  <span className="notification-item__icon" aria-hidden="true">
                    <Icon name="user" size={15} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="notification-item__title">{item.nickname}</div>
                    <div className="notification-item__text">{item.holderName}</div>
                    <div className="notification-item__time mono">
                      {item.accountNumberMasked} · {item.bankName}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 30, height: 30 }}
                    onClick={() => setRemoveTarget(item)}
                    aria-label={`Remove ${item.nickname}`}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </QueryState>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card title="Transfer history" subtitle="Every transfer you have initiated" flush>
          <DataTable
            columns={[
              {
                key: 'reference',
                header: 'Reference',
                render: (row) => <span className="mono">{row.reference}</span>,
              },
              {
                key: 'to',
                header: 'To',
                render: (row) => (
                  <>
                    <div className="cell-title">{row.beneficiaryName || 'Own account'}</div>
                    <div className="cell-sub mono">{row.toAccount || '—'}</div>
                  </>
                ),
              },
              { key: 'remarks', header: 'Remarks', render: (row) => row.remarks || '—' },
              { key: 'createdAt', header: 'Date', render: (row) => formatDate(row.createdAt, { withTime: true }) },
              {
                key: 'amount',
                header: 'Amount',
                align: 'right',
                render: (row) => formatMoney(row.amount, row.currency),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <>
                    <StatusBadge status={row.status} />
                    {row.failureReason ? <div className="cell-sub">{row.failureReason}</div> : null}
                  </>
                ),
              },
            ]}
            rows={history.data?.items}
            keyField="id"
            loading={history.loading}
            error={history.error}
            onRetry={history.reload}
            pagination={history.data?.pagination}
            onPageChange={setPage}
            caption="Transfer history"
            empty={<EmptyState icon="transfer" title="No transfers yet" text="Your transfers will be listed here." />}
          />
        </Card>
      </div>

      {/* Add beneficiary */}
      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setVerified(null);
          setBenError(null);
        }}
        title="Add a beneficiary"
        subtitle="We verify NexBank account numbers before saving them."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={addBeneficiary} loading={pending} disabled={!verified}>Save beneficiary</Button>
          </>
        }
      >
        <form onSubmit={addBeneficiary} className="stack" style={{ gap: 14 }}>
          {benError ? <InlineAlert variant="danger">{benError}</InlineAlert> : null}
          {verified ? (
            <InlineAlert variant="success">
              Account verified — <strong>{verified.holderName}</strong> ({verified.accountNumberMasked},{' '}
              {verified.currency})
            </InlineAlert>
          ) : null}

          <FormField
            label="Account number"
            placeholder="NEX1000000003"
            value={benForm.accountNumber}
            onChange={(event) => {
              setBenForm((current) => ({ ...current, accountNumber: event.target.value }));
              setVerified(null);
            }}
            hint="Enter the full NexBank account number, then verify it."
            required
          />
          <Button variant="secondary" icon="check" onClick={verifyBeneficiary} disabled={!benForm.accountNumber}>
            Verify account
          </Button>

          <FormField
            label="Nickname"
            placeholder="e.g. Arjun — Savings"
            value={benForm.nickname}
            onChange={(event) => setBenForm((current) => ({ ...current, nickname: event.target.value }))}
            required
          />
          <FormField
            label="IFSC code (optional)"
            placeholder="NEXB0005678"
            value={benForm.ifscCode}
            onChange={(event) => setBenForm((current) => ({ ...current, ifscCode: event.target.value }))}
          />
        </form>
      </Modal>

      <ConfirmationDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeBeneficiary}
        pending={pending}
        title="Remove beneficiary?"
        message={`${removeTarget?.nickname} will no longer appear when you make a transfer. Past transfers are unaffected.`}
        confirmLabel="Remove"
        variant="danger"
      />
    </>
  );
}
