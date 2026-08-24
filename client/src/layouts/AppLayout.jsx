import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Watermark from '../components/Watermark';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Signed-in shell: navigation, top bar and the notification state shared between
 * the bell dropdown and the sidebar badge.
 */
export default function AppLayout() {
  const { can } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const canSeeNotifications = can('notification.view');

  const loadNotifications = useCallback(async () => {
    if (!canSeeNotifications) return;
    setLoading(true);
    try {
      const result = await api.get('/notifications', { params: { limit: 8 } });
      setNotifications(result.items);
      setUnreadCount(result.unreadCount);
    } catch {
      /* the bell is non-critical - failures stay silent rather than blocking the app */
    } finally {
      setLoading(false);
    }
  }, [canSeeNotifications]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      /* ignore */
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} unreadCount={unreadCount} />
      {sidebarOpen ? (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          role="presentation"
        />
      ) : null}

      <div className="main">
        <Navbar
          onMenuToggle={() => setSidebarOpen((open) => !open)}
          notifications={notifications}
          notificationsLoading={loading}
          unreadCount={unreadCount}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onReloadNotifications={loadNotifications}
        />

        <main id="main-content" className="page" tabIndex={-1}>
          <Outlet context={{ reloadNotifications: loadNotifications }} />
        </main>

        <footer style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--border)' }}>
          <div className="row row--between" style={{ gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              © {new Date().getFullYear()} NexBank. All rights reserved.
            </span>
            <Watermark />
          </div>
        </footer>
      </div>
    </div>
  );
}
