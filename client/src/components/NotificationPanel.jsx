import { Link } from 'react-router-dom';
import Icon from './Icon';
import Button from './Button';
import { LoadingState, EmptyState } from './States';
import { formatRelative } from '../utils/format';

const TYPE_ICON = {
  transaction: 'transactions',
  transfer: 'transfer',
  security: 'shield',
  payment: 'bills',
  system: 'info',
};

/** Dropdown list of recent notifications, opened from the top bar bell. */
export default function NotificationPanel({
  notifications,
  loading,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClose,
}) {
  return (
    <div className="notification-panel" role="dialog" aria-label="Notifications">
      <div className="notification-panel__head">
        <div>
          <strong style={{ fontSize: 14 }}>Notifications</strong>
          {unreadCount > 0 ? (
            <span className="chip" style={{ marginLeft: 8 }}>{unreadCount} unread</span>
          ) : null}
        </div>
        {unreadCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
            Mark all read
          </Button>
        ) : null}
      </div>

      <div className="notification-panel__list">
        {loading ? (
          <LoadingState label="Loading notifications…" />
        ) : notifications.length === 0 ? (
          <EmptyState icon="notifications" title="You're all caught up" text="New alerts will appear here." />
        ) : (
          notifications.slice(0, 6).map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${notification.is_read ? '' : 'is-unread'}`}
            >
              <span className="notification-item__icon" aria-hidden="true">
                <Icon name={TYPE_ICON[notification.type] || 'info'} size={15} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="notification-item__title">{notification.title}</div>
                <div className="notification-item__text">{notification.message}</div>
                <div className="notification-item__time">{formatRelative(notification.created_at)}</div>
              </div>
              {!notification.is_read ? (
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 28, height: 28 }}
                  onClick={() => onMarkRead(notification.id)}
                  aria-label={`Mark "${notification.title}" as read`}
                >
                  <Icon name="check" size={13} />
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="notification-panel__foot">
        <Link to="/notifications" onClick={onClose} style={{ fontSize: 13, fontWeight: 600 }}>
          View all notifications
        </Link>
      </div>
    </div>
  );
}
