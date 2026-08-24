import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import Button from '../components/Button';
import Watermark from '../components/Watermark';
import { InlineAlert } from '../components/States';
import UserAvatar from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DEMO_ACCOUNTS = [
  { role: 'Administrator', email: 'admin@nexbank.com' },
  { role: 'Manager', email: 'manager@nexbank.com' },
  { role: 'Bank employee', email: 'employee@nexbank.com' },
  { role: 'Customer', email: 'meera@nexbank.com' },
];

export default function Login() {
  const { login, isAuthenticated, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const errors = {};
    if (!form.email.trim()) errors.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) errors.email = 'Enter a valid email address.';
    if (!form.password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    clearSessionMessage();
    if (!validate()) return;

    setPending(true);
    try {
      const user = await login({ email: form.email.trim(), password: form.password });
      toast.success(`Welcome back, ${user.fullName.split(' ')[0]}`, `Signed in as ${user.roleLabel}.`);
      const target = location.state?.from
        || (user.permissions.includes('admin.dashboard') && !user.permissions.includes('account.view.own')
          ? '/admin'
          : '/dashboard');
      navigate(target, { replace: true });
    } catch (error) {
      if (error.details) setFieldErrors(error.details);
      setFormError(error.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-panel">
      <div className="row" style={{ gap: 10, marginBottom: 26 }}>
        <span className="brand-mark" style={{ background: 'var(--navy-800)' }} aria-hidden="true">N</span>
        <span className="brand-name" style={{ color: 'var(--text)', fontSize: 17 }}>NexBank</span>
      </div>

      <h1 className="auth-panel__title">Sign in to your account</h1>
      <p className="auth-panel__subtitle">Enter your credentials to access your banking dashboard.</p>

      {sessionMessage ? (
        <div style={{ marginTop: 16 }}>
          <InlineAlert variant="warning">{sessionMessage}</InlineAlert>
        </div>
      ) : null}

      {formError ? (
        <div style={{ marginTop: 16 }}>
          <InlineAlert variant="danger">{formError}</InlineAlert>
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate style={{ marginTop: 20, display: 'grid', gap: 14 }}>
        <FormField
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={update('email')}
          error={fieldErrors.email}
          required
        />
        <FormField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={form.password}
          onChange={update('password')}
          error={fieldErrors.password}
          required
        />
        <Button type="submit" loading={pending} block>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
        New to NexBank? <Link to="/register">Open an account</Link>
      </p>

      <div className="demo-accounts">
        <p className="demo-accounts__title">Demo accounts · password Password@123</p>
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            className="demo-account"
            onClick={() => setForm({ email: account.email, password: 'Password@123' })}
          >
            <UserAvatar name={account.role} size="sm" />
            <span>
              <span className="demo-account__role">{account.role}</span>
              <br />
              <span className="demo-account__email">{account.email}</span>
            </span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 26 }}>
        <Watermark />
      </div>
    </div>
  );
}
