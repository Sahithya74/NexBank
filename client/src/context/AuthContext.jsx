import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { tokenStore, setSessionExpiredHandler } from '../services/api';

const AuthContext = createContext(null);

/**
 * Holds the session. Permissions come from the server on every sign-in and on
 * every page load, so the UI mirrors what the API will actually allow - it is
 * never the authority on access itself.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [sessionMessage, setSessionMessage] = useState(null);

  useEffect(() => {
    setSessionExpiredHandler((expired) => {
      setUser(null);
      if (expired) setSessionMessage('Your session expired. Please sign in again.');
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!tokenStore.get()) {
        setBootstrapping(false);
        return;
      }
      try {
        const profile = await api.get('/auth/me');
        if (!cancelled) setUser(profile);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const result = await api.post('/auth/login', credentials);
    tokenStore.set(result.token);
    setUser(result.user);
    setSessionMessage(null);
    return result.user;
  }, []);

  const register = useCallback(async (payload) => {
    const result = await api.post('/auth/register', payload);
    tokenStore.set(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* signing out locally matters more than the audit call succeeding */
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const profile = await api.get('/auth/me');
    setUser(profile);
    return profile;
  }, []);

  const can = useCallback(
    (...codes) => codes.some((code) => user?.permissions?.includes(code)),
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      bootstrapping,
      sessionMessage,
      clearSessionMessage: () => setSessionMessage(null),
      login,
      register,
      logout,
      refresh,
      can,
    }),
    [user, bootstrapping, sessionMessage, login, register, logout, refresh, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
