import { initials } from '../utils/format';

/** Initial-based avatar. Decorative by default; the name is read from context. */
export default function UserAvatar({ name, size = 'md', className = '' }) {
  const modifier = size === 'lg' ? 'avatar--lg' : size === 'sm' ? 'avatar--sm' : '';
  return (
    <span className={`avatar ${modifier} ${className}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
