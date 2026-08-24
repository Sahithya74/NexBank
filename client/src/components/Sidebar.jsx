import { NavLink } from 'react-router-dom';
import Icon from './Icon';
import Watermark from './Watermark';
import { useAuth } from '../context/AuthContext';

/**
 * Navigation is filtered by the permissions the server returned. Hiding a link is
 * a convenience only - the API enforces the same rules independently.
 */
const CUSTOMER_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/accounts', label: 'Accounts', icon: 'accounts', permission: 'account.view.own' },
  { to: '/wallet', label: 'Wallet', icon: 'wallet', permission: 'wallet.view.own' },
  { to: '/transfers', label: 'Transfers', icon: 'transfer', permission: 'transfer.create' },
  { to: '/transactions', label: 'Transactions', icon: 'transactions', permission: 'transaction.view.own' },
  { to: '/bills', label: 'Bills', icon: 'bills', permission: 'bill.pay' },
  { to: '/cards', label: 'Cards', icon: 'cards', permission: 'card.view' },
  { to: '/loans', label: 'Loans', icon: 'loans', permission: 'loan.view.own' },
  { to: '/notifications', label: 'Notifications', icon: 'notifications', permission: 'notification.view', badge: 'unread' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Admin Dashboard', icon: 'dashboard', permission: 'admin.dashboard', end: true },
  { to: '/admin/users', label: 'Users', icon: 'users', permission: 'user.view' },
  { to: '/admin/roles', label: 'Roles & Permissions', icon: 'roles', permission: 'role.view' },
  { to: '/admin/accounts', label: 'Accounts', icon: 'accounts', permission: 'account.view.all', alt: 'account.view.assigned' },
  { to: '/admin/transactions', label: 'Transactions', icon: 'transactions', permission: 'transaction.view.all', alt: 'transaction.view.assigned' },
  { to: '/admin/wallets', label: 'Wallets', icon: 'wallet', permission: 'wallet.view.all' },
  { to: '/admin/loans', label: 'Loans', icon: 'loans', permission: 'loan.view.all' },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: 'audit', permission: 'audit.view' },
  { to: '/admin/reports', label: 'Reports', icon: 'reports', permission: 'report.view' },
];

export default function Sidebar({ open, onClose, unreadCount = 0 }) {
  const { can } = useAuth();

  const visible = (links) =>
    links.filter((link) => !link.permission || can(link.permission) || (link.alt && can(link.alt)));

  const customerLinks = visible(CUSTOMER_LINKS);
  const adminLinks = visible(ADMIN_LINKS);

  const renderLink = (link) => (
    <NavLink
      key={link.to}
      to={link.to}
      end={link.end}
      className={({ isActive }) => `nav__link ${isActive ? 'is-active' : ''}`}
      onClick={onClose}
    >
      <Icon name={link.icon} size={17} />
      {link.label}
      {link.badge === 'unread' && unreadCount > 0 ? (
        <span className="nav__count" aria-label={`${unreadCount} unread`}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </NavLink>
  );

  return (
    <nav className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Main navigation">
      <div className="sidebar__brand">
        <span className="brand-mark" aria-hidden="true">N</span>
        <span className="brand-name">NexBank</span>
        <button type="button" className="sidebar__close" onClick={onClose} aria-label="Close navigation">
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="sidebar__scroll">
        {customerLinks.length > 0 ? (
          <>
            <p className="nav__section">Banking</p>
            {customerLinks.map(renderLink)}
          </>
        ) : null}

        {adminLinks.length > 0 ? (
          <>
            <p className="nav__section">Administration</p>
            {adminLinks.map(renderLink)}
          </>
        ) : null}
      </div>

      <div className="sidebar__footer">
        <div style={{ color: '#9fb0c6', fontWeight: 600, marginBottom: 2 }}>NexBank</div>
        <Watermark variant="aside" />
      </div>
    </nav>
  );
}
