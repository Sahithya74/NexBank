/**
 * Single stroke-icon set so every screen uses the same visual language.
 * Icons are decorative by default; pass a `title` when one carries meaning.
 */

const PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.6" /><rect x="14" y="3" width="7" height="7" rx="1.6" /><rect x="3" y="14" width="7" height="7" rx="1.6" /><rect x="14" y="14" width="7" height="7" rx="1.6" /></>,
  accounts: <><path d="M3 9.5L12 4l9 5.5" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 21h18" /></>,
  wallet: <><path d="M3 7.5A2.5 2.5 0 015.5 5H18a2 2 0 012 2v1" /><rect x="3" y="7.5" width="18" height="12.5" rx="2.4" /><path d="M16 13.8h2.5" /></>,
  transfer: <><path d="M4 8h13l-3-3" /><path d="M20 16H7l3 3" /></>,
  transactions: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
  bills: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9.5 8h5M9.5 12h5" /></>,
  cards: <><rect x="2.5" y="5" width="19" height="14" rx="2.4" /><path d="M2.5 9.8h19" /><path d="M6.5 14.5h3" /></>,
  loans: <><circle cx="12" cy="12" r="8.5" /><path d="M14.6 9.2c-.5-.9-1.5-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2.1c1.6.4 2.7 1 2.7 2.2s-1.2 2-2.7 2c-1.2 0-2.2-.5-2.7-1.5" /><path d="M12 6v12" /></>,
  notifications: <><path d="M18 8.5a6 6 0 10-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z" /><path d="M13.7 19a2 2 0 01-3.4 0" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5v.2a2 2 0 01-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 010-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 014 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1h.2a2 2 0 010 4h-.1a1.6 1.6 0 00-1.5 1z" /></>,
  users: <><path d="M16 20v-1.6a3.4 3.4 0 00-3.4-3.4H6.4A3.4 3.4 0 003 18.4V20" /><circle cx="9.5" cy="8" r="3.4" /><path d="M21 20v-1.6a3.4 3.4 0 00-2.6-3.3" /><path d="M15.5 4.7a3.4 3.4 0 010 6.6" /></>,
  roles: <><path d="M12 3l7.5 3v5.4c0 4.4-3 8.3-7.5 9.6-4.5-1.3-7.5-5.2-7.5-9.6V6L12 3z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
  audit: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3.5h6a1 1 0 011 1V6H8V4.5a1 1 0 011-1z" /><path d="M9 11h6M9 15h4" /></>,
  reports: <><path d="M4 20V9M10 20V4M16 20v-7M22 20H2" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L20 20" /></>,
  logout: <><path d="M15 17l5-5-5-5" /><path d="M20 12H9" /><path d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h5" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  chevronLeft: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  chevronRight: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
  chevronDown: <path d="M5.5 9.5L12 16l6.5-6.5" />,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.2M12 16.2v.3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.3" /></>,
  arrowUp: <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></>,
  arrowDown: <><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></>,
  refresh: <><path d="M20 11a8 8 0 10-2.3 6.3" /><path d="M20 4.5V11h-6.4" /></>,
  trash: <><path d="M4 7h16" /><path d="M9.5 7V5.2A1.2 1.2 0 0110.7 4h2.6a1.2 1.2 0 011.2 1.2V7" /><path d="M6.5 7l.8 12a1.6 1.6 0 001.6 1.5h6.2a1.6 1.6 0 001.6-1.5L17.5 7" /></>,
  edit: <><path d="M12 20h8" /><path d="M16.5 3.7a2 2 0 012.8 2.8L7.5 18.3 3.5 19.5l1.2-4L16.5 3.7z" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.2" /><path d="M8 10.5V7.8a4 4 0 018 0v2.7" /></>,
  shield: <><path d="M12 3l7.5 3v5.4c0 4.4-3 8.3-7.5 9.6-4.5-1.3-7.5-5.2-7.5-9.6V6L12 3z" /></>,
  filter: <><path d="M3.5 5.5h17l-6.8 8v5.2l-3.4 1.8V13.5l-6.8-8z" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2.2" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.7 3.8 5.8 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.8-3.8-9S9.5 5.7 12 3z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 1.8" /></>,
  download: <><path d="M12 4v11" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M4.5 19.5h15" /></>,
  bank: <><path d="M3 9.5L12 4l9 5.5" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 21h18" /></>,
  send: <><path d="M20.5 3.5L11 13" /><path d="M20.5 3.5l-6.2 17-3.3-7.5-7.5-3.3 17-6.2z" /></>,
  swap: <><path d="M7 4v13" /><path d="M3.5 13.5L7 17l3.5-3.5" /><path d="M17 20V7" /><path d="M20.5 10.5L17 7l-3.5 3.5" /></>,
  block: <><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0115 0" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v4.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10" /></>,
};

export default function Icon({ name, size = 18, title, className = '', strokeWidth = 1.7 }) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {path}
    </svg>
  );
}
