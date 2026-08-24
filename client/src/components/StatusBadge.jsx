import { humanise, statusVariant } from '../utils/format';

/** Consistent status pill. Colour always carries the same meaning app-wide. */
export default function StatusBadge({ status, label }) {
  return (
    <span className={`badge badge--${statusVariant(status)}`}>{label || humanise(status)}</span>
  );
}
