import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { EmptyState, QueryState } from '../components/States';
import { Pagination } from '../components/DataTable';
import { useApiQuery } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { formatDate, formatRelative, humanise } from '../utils/format';

const TYPES = ['transaction', 'transfer', 'security', 'payment', 'system'];

const TYPE_ICON = {
  transaction: 'transactions',
  transfer: 'transfer',
  security: 'shield',
  payment: 'bills',
  system: 'info',
};

const TYPE_TONE = {
  transaction: 'info',
  transfer: 'info',
  security: 'danger',
  payment: 'warning',
  system: 'navy',
};

export default function Notifications() {
  const toast = useToast();
  const outlet = useOutletContext();
  const [filters, setFilters] = useState({ status: '', type: '' });
  const [page, setPage] = useState(1);

  const notifications = useApiQuery('/notifications', {
    params: {
      page,
      limit: 12,
      status: filters.status || undefined,
      type: filters.type || undefined,
    },
  });

  const refreshAll = async () => {
    await notifications.reload({ quiet: true });
    outlet?.reloadNotifications?.();
  };

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      await refreshAll();
    } catch (error) {
      toast.error('Could not update notification', error.message);
    }
  };

  const markAllRead = async () => {
    try {
      const result = await api.patch('/notifications/read-all');
      toast.success('All caught up', `${result.updated} notification${result.updated === 1 ? '' : 's'} marked as read.`);
      await refreshAll();
    } catch (error) {
      toast.error('Could not update notifications', error.message);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      await refreshAll();
    } catch (error) {
      toast.error('Could not remove notification', error.message);
    }
  };

  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Notifications</h1>
          <p className="page__subtitle">
            {unread > 0 ? `You have ${unread} unread notification${unread === 1 ? '' : 's'}.` : 'You are all caught up.'}
          </p>
        </div>
        <div className="page__actions">
          <Button variant="secondary" icon="refresh" onClick={() => notifications.reload()}>Refresh</Button>
          <Button icon="check" onClick={markAllRead} disabled={unread === 0}>Mark all as read</Button>
        </div>
      </div>

      <Card flush>
        <div className="filter-bar">
          <div className="row" style={{ gap: 6 }}>
            {[
              { value: '', label: 'All' },
              { value: 'unread', label: `Unread${unread > 0 ? ` (${unread})` : ''}` },
              { value: 'read', label: 'Read' },
            ].map((option) => (
              <Button
                key={option.value || 'all'}
                size="sm"
                variant={filters.status === option.value ? 'primary' : 'secondary'}
                onClick={() => {
                  setFilters((current) => ({ ...current, status: option.value }));
                  setPage(1);
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="spacer" />

          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant={filters.type === '' ? 'primary' : 'secondary'}
              onClick={() => {
                setFilters((current) => ({ ...current, type: '' }));
                setPage(1);
              }}
            >
              All types
            </Button>
            {TYPES.map((type) => (
              <Button
                key={type}
                size="sm"
                variant={filters.type === type ? 'primary' : 'secondary'}
                onClick={() => {
                  setFilters((current) => ({ ...current, type }));
                  setPage(1);
                }}
              >
                {humanise(type)}
              </Button>
            ))}
          </div>
        </div>

        <QueryState
          loading={notifications.loading}
          error={notifications.error}
          onRetry={notifications.reload}
          isEmpty={notifications.data?.items?.length === 0}
          rows={5}
          empty={
            <EmptyState
              icon="notifications"
              title={filters.status || filters.type ? 'Nothing matches these filters' : 'No notifications yet'}
              text={
                filters.status || filters.type
                  ? 'Try a different filter.'
                  : 'Alerts about transfers, payments and security will appear here.'
              }
            />
          }
        >
          <div>
            {(notifications.data?.items ?? []).map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${notification.is_read ? '' : 'is-unread'}`}
              >
                <span
                  className={`stat__icon stat__icon--${TYPE_TONE[notification.type] || 'info'}`}
                  style={{ width: 34, height: 34 }}
                  aria-hidden="true"
                >
                  <Icon name={TYPE_ICON[notification.type] || 'info'} size={16} />
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row row--between" style={{ gap: 12 }}>
                    <span className="notification-item__title">{notification.title}</span>
                    <span className={`badge badge--${notification.is_read ? 'neutral' : 'info'} badge--plain`}>
                      {humanise(notification.type)}
                    </span>
                  </div>
                  <div className="notification-item__text">{notification.message}</div>
                  <div className="notification-item__time" title={formatDate(notification.created_at, { withTime: true })}>
                    {formatRelative(notification.created_at)}
                  </div>
                </div>

                <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  {!notification.is_read ? (
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ width: 30, height: 30 }}
                      onClick={() => markRead(notification.id)}
                      aria-label={`Mark "${notification.title}" as read`}
                    >
                      <Icon name="check" size={14} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 30, height: 30 }}
                    onClick={() => remove(notification.id)}
                    aria-label={`Delete "${notification.title}"`}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </QueryState>

        {notifications.data?.pagination?.total > 0 ? (
          <Pagination pagination={notifications.data.pagination} onPageChange={setPage} />
        ) : null}
      </Card>
    </>
  );
}
