import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import Button from '../components/Button';
import Watermark from '../components/Watermark';
import { InlineAlert } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const errors = {};
    if (form.fullName.trim().length < 3) errors.fullName = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) errors.email = 'Enter a valid email address.';
    if (form.password.length < 8) errors.password = 'Use at least 8 characters.';
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      errors.password = 'Include both letters and numbers.';
    }
    if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setPending(true);
    try {
      const user = await register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        password: form.password,
      });
      toast.success('Account created', `Welcome to NexBank, ${user.fullName.split(' ')[0]}.`);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error.details) setFieldErrors(error.details);
      setFormError(error.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-panel" style={{ maxWidth: 440 }}>
      <div className="row" style={{ gap: 10, marginBottom: 22 }}>
        <span className="brand-mark" style={{ background: 'var(--navy-800)' }} aria-hidden="true">N</span>
        <span className="brand-name" style={{ color: 'var(--text)', fontSize: 17 }}>NexBank</span>
      </div>

      <h1 className="auth-panel__title">Open your NexBank account</h1>
      <p className="auth-panel__subtitle">
        A savings account and multi-currency wallet are created for you automatically.
      </p>

      {formError ? (
        <div style={{ marginTop: 16 }}>
          <InlineAlert variant="danger">{formError}</InlineAlert>
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate style={{ marginTop: 20, display: 'grid', gap: 14 }}>
        <FormField
          label="Full name"
          name="fullName"
          autoComplete="name"
          placeholder="Meera Krishnan"
          value={form.fullName}
          onChange={update('fullName')}
          error={fieldErrors.fullName}
          required
        />
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
        <div className="form-grid">
          <FormField
            label="Phone"
            name="phone"
            autoComplete="tel"
            placeholder="+91 98400 00000"
            value={form.phone}
            onChange={update('phone')}
            error={fieldErrors.phone}
          />
          <FormField
            label="City / address"
            name="address"
            autoComplete="address-level2"
            placeholder="Chennai"
            value={form.address}
            onChange={update('address')}
            error={fieldErrors.address}
          />
        </div>
        <FormField
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={form.password}
          onChange={update('password')}
          error={fieldErrors.password}
          hint="At least 8 characters, including letters and numbers."
          required
        />
        <FormField
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
          error={fieldErrors.confirmPassword}
          required
        />
        <Button type="submit" loading={pending} block>
          {pending ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>

      <p style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>

      <div style={{ marginTop: 24 }}>
        <Watermark />
      </div>
    </div>
  );
}
