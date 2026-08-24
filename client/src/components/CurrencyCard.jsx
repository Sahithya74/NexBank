import { formatMoney } from '../utils/format';
import Button from './Button';

/**
 * One currency holding in the multi-currency wallet: the balance in its own
 * currency, its value in the portfolio base currency, and its share of the total.
 */
export default function CurrencyCard({ holding, base, baseSymbol, share = 0, onConvert, onRemove }) {
  const isEmpty = Number(holding.balance) === 0;

  return (
    <article className="currency-card">
      <div className="currency-card__head">
        <span className="currency-badge" aria-hidden="true">{holding.symbol}</span>
        <div style={{ minWidth: 0 }}>
          <div className="currency-card__code">{holding.currency}</div>
          <div className="currency-card__name">{holding.name}</div>
        </div>
      </div>

      <div>
        <div className="currency-card__balance">
          {formatMoney(holding.balance, holding.currency)}
        </div>
        {holding.currency !== base ? (
          <div className="currency-card__converted">
            ≈ {baseSymbol}
            {formatMoney(holding.convertedValue, base, { symbol: false })} · 1 {holding.currency} ={' '}
            {Number(holding.rateToBase).toFixed(4)} {base}
          </div>
        ) : (
          <div className="currency-card__converted">Portfolio base currency</div>
        )}
      </div>

      <div>
        <div className="progress" aria-hidden="true">
          <div className="progress__bar" style={{ width: `${Math.min(share, 100)}%` }} />
        </div>
        <div className="currency-card__converted" style={{ marginTop: 5 }}>
          {share.toFixed(1)}% of portfolio
        </div>
      </div>

      <div className="row" style={{ gap: 6 }}>
        <Button size="sm" variant="secondary" icon="swap" onClick={() => onConvert(holding.currency)}>
          Convert
        </Button>
        {isEmpty && holding.currency !== 'INR' && onRemove ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRemove(holding.currency)}
            aria-label={`Remove ${holding.currency} from wallet`}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </article>
  );
}
