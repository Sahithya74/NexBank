import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import UserAvatar from './UserAvatar';
import NotificationPanel from './NotificationPanel';
import { useAuth } from '../context/AuthContext';

/** Closes a dropdown on outside click or Escape. */
function useDismissable(onDismiss) {
  const ref = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onDismiss();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onDismiss]);

  return ref;
}

export default function Navbar({
  onMenuToggle,
  notifications,
  notificationsLoading,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onReloadNotifications,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [openPanel, setOpenPanel] = useState(null);
  const [search, setSearch] = useState('');

  const containerRef = useDismissable(() => setOpenPanel(null));

  const handleSearch = (event) => {
    event.preventDefault();
    const term = search.trim();
    if (!term) return;
    navigate(`/transactions?q=${encodeURIComponent(term)}`);
    setSearch('');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      <button type="button" className="menu-btn" onClick={onMenuToggle} aria-label="Open navigation">
        <Icon name="menu" size={18} />
      </button>

      <form className="topbar__search" role="search" onSubmit={handleSearch}>
        <Icon name="search" size={15} />
        <label htmlFor="global-search" className="visually-hidden">
          Search transactions
        </label>
        <input
          id="global-search"
          type="search"
          placeholder="Search transactions, references…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </form>

      <div className="topbar__actions" ref={containerRef}>
        <span className="role-chip" title="Your access level">{user?.roleLabel}</span>

        <div className="dropdown">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            aria-expanded={openPanel === 'notifications'}
            onClick={() => {
              setOpenPanel(openPanel === 'notifications' ? null : 'notifications');
              if (openPanel !== 'notifications') onReloadNotifications();
            }}
          >
            <Icon name="notifications" size={17} />
            {unreadCount > 0 ? (
              <span className="icon-btn__dot">{unreadCount > 9 ? '9+' : unreadCount}</span>
            ) : null}
          </button>

          {openPanel === 'notifications' ? (
            <NotificationPanel
              notifications={notifications}
              loading={notificationsLoading}
              unreadCount={unreadCount}
              onMarkRead={onMarkRead}
              onMarkAllRead={onMarkAllRead}
              onClose={() => setOpenPanel(null)}
            />
          ) : null}
        </div>

        <div className="dropdown">
          <button
            type="button"
            className="user-chip"
            aria-expanded={openPanel === 'user'}
            aria-haspopup="menu"
            onClick={() => setOpenPanel(openPanel === 'user' ? null : 'user')}
          >
            <UserAvatar name={user?.fullName} />
            <span className="user-chip__meta">
              <span className="user-chip__name">{user?.fullName}</span>
              <span className="user-chip__role">{user?.email}</span>
            </span>
            <Icon name="chevronDown" size={14} />
          </button>

          {openPanel === 'user' ? (
            <div className="menu" role="menu">
              <div className="menu__header">
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{user?.fullName}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user?.email}</div>
              </div>
              <Link to="/settings" className="menu__item" role="menuitem" onClick={() => setOpenPanel(null)}>
                <Icon name="user" size={15} /> Profile & settings
              </Link>
              <Link to="/notifications" className="menu__item" role="menuitem" onClick={() => setOpenPanel(null)}>
                <Icon name="notifications" size={15} /> Notifications
              </Link>
              <button type="button" className="menu__item menu__item--danger" role="menuitem" onClick={handleLogout}>
                <Icon name="logout" size={15} /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
