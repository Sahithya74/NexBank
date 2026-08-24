import { Link } from 'react-router-dom';
import Icon from './Icon';

/**
 * Shared button. Renders a real <button> (or a Link when `to` is given) so
 * keyboard and assistive-technology behaviour comes for free.
 */
export default function Button({
  children,
  variant = 'primary',
  size,
  icon,
  iconRight,
  loading = false,
  block = false,
  to,
  type = 'button',
  className = '',
  disabled,
  ...rest
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'sm' ? 'btn--sm' : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {loading ? (
        <span
          className={`spinner spinner--sm ${variant === 'primary' || variant === 'navy' || variant === 'danger' ? 'spinner--light' : ''}`}
          aria-hidden="true"
        />
      ) : icon ? (
        <Icon name={icon} size={size === 'sm' ? 14 : 16} />
      ) : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={size === 'sm' ? 14 : 16} /> : null}
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    // eslint-disable-next-line react/button-has-type
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {content}
    </button>
  );
}
