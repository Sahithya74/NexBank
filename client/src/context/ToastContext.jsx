import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const ICONS = {
  success: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 6v5M10 13.6v.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 3l7.5 13.5h-15L10 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 8.2v3M10 13.6v.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 9v5M10 6.2v.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

const COLOURS = {
  success: 'var(--success)',
  error: 'var(--danger)',
  warning: 'var(--warning)',
  info: 'var(--blue-600)',
};

/** App-wide feedback. Toasts are announced politely for screen readers. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (variant, title, text = '') => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current, { id, variant, title, text }]);
      setTimeout(() => dismiss(id), variant === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (title, text) => push('success', title, text),
      error: (title, text) => push('error', title, text),
      warning: (title, text) => push('warning', title, text),
      info: (title, text) => push('info', title, text),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.variant}`}>
            <span style={{ color: COLOURS[toast.variant], marginTop: 1 }}>{ICONS[toast.variant]}</span>
            <div style={{ minWidth: 0 }}>
              <div className="toast__title">{toast.title}</div>
              {toast.text ? <div className="toast__text">{toast.text}</div> : null}
            </div>
            <button
              type="button"
              className="toast__close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
