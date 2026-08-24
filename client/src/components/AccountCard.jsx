import { formatMoney, humanise } from '../utils/format';
import StatusBadge from './StatusBadge';
import Icon from './Icon';

/** Bank account tile. The number is always the masked value from the API. */
export default function AccountCard({ account, selected = false, onSelect, as = 'button' }) {
  const Wrapper = as === 'div' ? 'div' : 'button';

  return (
    <Wrapper
      type={as === 'div' ? undefined : 'button'}
      className={`account-card ${selected ? 'is-selected' : ''}`}
      onClick={onSelect ? () => onSelect(account) : undefined}
      aria-pressed={onSelect ? selected : undefined}
    >
      <div className="row row--between" style={{ width: '100%' }}>
        <span className="row" style={{ gap: 8 }}>
          <span className="stat__icon stat__icon--navy" style={{ width: 32, height: 32 }}>
            <Icon name="bank" size={16} />
          </span>
          <span className="account-card__type">{humanise(account.accountType)} account</span>
        </span>
        <StatusBadge status={account.status} />
      </div>

      <div>
        <div className="account-card__number">{account.accountNumberMasked}</div>
        <div className="account-card__balance">
          {formatMoney(account.balance, account.currency)}
        </div>
        <div className="card__subtitle" style={{ marginTop: 2 }}>
          Available balance · {account.currency}
        </div>
      </div>

      {account.branch ? (
        <div className="card__subtitle" style={{ marginTop: 'auto' }}>
          {account.branch}
          {account.ifscCode ? ` · ${account.ifscCode}` : ''}
        </div>
      ) : null}
    </Wrapper>
  );
}
