import { Outlet } from 'react-router-dom';
import Icon from '../components/Icon';
import Watermark from '../components/Watermark';

const FEATURES = [
  {
    icon: 'wallet',
    title: 'Multi-currency wallet',
    text: 'Hold INR, USD, EUR, GBP, JPY and AED side by side and convert at live rates.',
  },
  {
    icon: 'shield',
    title: 'Role-based access control',
    text: 'Every action is checked against your role on the server, not just in the interface.',
  },
  {
    icon: 'audit',
    title: 'Full audit trail',
    text: 'Sign-ins, transfers, conversions and administrative changes are all recorded.',
  },
];

/** Split layout for sign-in and registration. */
export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="row" style={{ gap: 10 }}>
          <span className="brand-mark" aria-hidden="true">N</span>
          <span className="brand-name" style={{ fontSize: 17 }}>NexBank</span>
        </div>

        <div>
          <h1 className="auth-aside__headline">Banking built for how money actually moves.</h1>
          <p className="auth-aside__text">
            Accounts, multi-currency wallets, transfers, cards and loans in one secure platform.
          </p>

          <div style={{ marginTop: 26 }}>
            {FEATURES.map((feature) => (
              <div className="auth-feature" key={feature.title}>
                <span className="auth-feature__icon" aria-hidden="true">
                  <Icon name={feature.icon} size={17} />
                </span>
                <div>
                  <div className="auth-feature__title">{feature.title}</div>
                  <div className="auth-feature__text">{feature.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Watermark variant="aside" />
      </aside>

      <main className="auth-main">
        <Outlet />
      </main>
    </div>
  );
}
