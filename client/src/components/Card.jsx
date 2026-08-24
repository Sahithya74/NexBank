import Icon from './Icon';

/** Generic surface used across the app. */
export default function Card({ title, subtitle, actions, footer, flush = false, className = '', children }) {
  return (
    <section className={`card ${className}`}>
      {title || actions ? (
        <header className="card__header">
          <div>
            <h2 className="card__title">{title}</h2>
            {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="row">{actions}</div> : null}
        </header>
      ) : null}
      <div className={flush ? 'card__body card__body--flush' : 'card__body'}>{children}</div>
      {footer ? <div className="card__footer">{footer}</div> : null}
    </section>
  );
}

/** Headline metric tile used on the dashboards. */
export function StatCard({ label, value, meta, icon, tone = 'info', trend }) {
  return (
    <div className="card">
      <div className="card__body">
        <div className="stat">
          {icon ? (
            <span className={`stat__icon stat__icon--${tone}`}>
              <Icon name={icon} size={19} />
            </span>
          ) : null}
          <div style={{ minWidth: 0 }}>
            <p className="stat__label">{label}</p>
            <p className="stat__value">{value}</p>
            {meta || trend ? (
              <p className="stat__meta">
                {trend ? (
                  <span className={`trend trend--${trend.direction}`}>
                    {trend.direction === 'up' ? '▲' : '▼'} {trend.value}
                  </span>
                ) : null}
                {trend && meta ? ' · ' : ''}
                {meta}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Card wrapper for charts, so every chart has the same frame and header. */
export function ChartCard({ title, subtitle, actions, height = 260, children }) {
  return (
    <Card title={title} subtitle={subtitle} actions={actions}>
      <div style={{ width: '100%', height }}>{children}</div>
    </Card>
  );
}
