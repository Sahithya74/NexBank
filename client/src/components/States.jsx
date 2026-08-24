import Icon from './Icon';
import Button from './Button';

/** Loading placeholder shown while a data-driven view is fetching. */
export function LoadingState({ label = 'Loading…', rows = 0 }) {
  if (rows > 0) {
    return (
      <div className="card__body" aria-busy="true" aria-live="polite">
        <span className="visually-hidden">{label}</span>
        {Array.from({ length: rows }).map((_, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} style={{ display: 'flex', gap: 16, padding: '10px 0' }}>
            <div className="skeleton" style={{ flex: 2 }} />
            <div className="skeleton" style={{ flex: 1 }} />
            <div className="skeleton" style={{ flex: 1 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="state" aria-busy="true" aria-live="polite">
      <div className="spinner" />
      <p className="state__text" style={{ marginTop: 12 }}>{label}</p>
    </div>
  );
}

/** Shown when a request succeeds but there is nothing to display yet. */
export function EmptyState({ icon = 'info', title, text, action }) {
  return (
    <div className="state">
      <div className="state__icon">
        <Icon name={icon} size={22} />
      </div>
      <p className="state__title">{title}</p>
      {text ? <p className="state__text">{text}</p> : null}
      {action ? <div className="state__actions">{action}</div> : null}
    </div>
  );
}

/** Shown when a request fails. Always offers a way to retry. */
export function ErrorState({ error, onRetry, title = 'We could not load this' }) {
  const message = error?.message || 'Something went wrong. Please try again.';

  return (
    <div className="state" role="alert">
      <div className="state__icon state__icon--danger">
        <Icon name="alert" size={22} />
      </div>
      <p className="state__title">{title}</p>
      <p className="state__text">{message}</p>
      {onRetry ? (
        <div className="state__actions">
          <Button variant="secondary" icon="refresh" onClick={() => onRetry()}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Inline banner for form-level and operation-level messages. */
export function InlineAlert({ variant = 'info', children }) {
  const icon = { danger: 'alert', success: 'check', warning: 'alert', info: 'info' }[variant];
  return (
    <div className={`inline-alert inline-alert--${variant}`} role={variant === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon} size={16} />
      <div>{children}</div>
    </div>
  );
}

/**
 * Renders the right state for a query result. Keeps every page consistent
 * instead of each one re-implementing loading/error/empty handling.
 */
export function QueryState({ loading, error, isEmpty, onRetry, empty, rows = 4, children }) {
  if (loading) return <LoadingState rows={rows} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty) return empty || <EmptyState title="Nothing to show yet" />;
  return children;
}
