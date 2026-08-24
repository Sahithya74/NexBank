import { useEffect, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import FormField from '../components/FormField';
import UserAvatar from '../components/UserAvatar';
import Watermark from '../components/Watermark';
import { InlineAlert } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { formatDate } from '../utils/format';

export default function Settings() {
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState({ fullName: '', phone: '', address: '' });
  const [profileErrors, setProfileErrors] = useState({});
  const [profileError, setProfileError] = useState(null);
  const [profilePending, setProfilePending] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordError, setPasswordError] = useState(null);
  const [passwordPending, setPasswordPending] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({
        fullName: user.fullName || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError(null);
    setProfileErrors({});

    if (profile.fullName.trim().length < 3) {
      setProfileErrors({ fullName: 'Enter your full name.' });
      return;
    }

    setProfilePending(true);
    try {
      await api.put('/auth/me', {
        fullName: profile.fullName.trim(),
        phone: profile.phone.trim() || undefined,
        address: profile.address.trim() || undefined,
      });
      await refresh();
      toast.success('Profile updated', 'Your details have been saved.');
    } catch (error) {
      if (error.details) setProfileErrors(error.details);
      setProfileError(error.message);
    } finally {
      setProfilePending(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordErrors({});

    const errors = {};
    if (!passwords.currentPassword) errors.currentPassword = 'Enter your current password.';
    if (passwords.newPassword.length < 8) errors.newPassword = 'Use at least 8 characters.';
    else if (!/[A-Za-z]/.test(passwords.newPassword) || !/\d/.test(passwords.newPassword)) {
      errors.newPassword = 'Include both letters and numbers.';
    }
    if (passwords.confirmPassword !== passwords.newPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setPasswordPending(true);
    try {
      await api.put('/auth/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed', 'Use your new password the next time you sign in.');
    } catch (error) {
      if (error.details) setPasswordErrors(error.details);
      setPasswordError(error.message);
    } finally {
      setPasswordPending(false);
    }
  };

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Settings</h1>
          <p className="page__subtitle">Manage your profile, security and account information.</p>
        </div>
      </div>

      <div className="grid grid--sidebar">
        <div className="stack">
          <Card title="Profile" subtitle="These details appear on your statements and receipts.">
            <form onSubmit={saveProfile} className="stack" style={{ gap: 14 }}>
              {profileError ? <InlineAlert variant="danger">{profileError}</InlineAlert> : null}

              <FormField
                label="Full name"
                value={profile.fullName}
                onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))}
                error={profileErrors.fullName}
                required
              />
              <FormField label="Email address" value={user?.email ?? ''} disabled hint="Contact support to change your email address." />
              <div className="form-grid">
                <FormField
                  label="Phone"
                  value={profile.phone}
                  onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                  error={profileErrors.phone}
                />
                <FormField
                  label="Address"
                  value={profile.address}
                  onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))}
                  error={profileErrors.address}
                />
              </div>

              <div>
                <Button type="submit" loading={profilePending}>Save changes</Button>
              </div>
            </form>
          </Card>

          <Card title="Security" subtitle="Change the password you use to sign in.">
            <form onSubmit={changePassword} className="stack" style={{ gap: 14 }}>
              {passwordError ? <InlineAlert variant="danger">{passwordError}</InlineAlert> : null}

              <FormField
                label="Current password"
                type="password"
                autoComplete="current-password"
                value={passwords.currentPassword}
                onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))}
                error={passwordErrors.currentPassword}
                required
              />
              <div className="form-grid">
                <FormField
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.newPassword}
                  onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))}
                  error={passwordErrors.newPassword}
                  hint="At least 8 characters, with letters and numbers."
                  required
                />
                <FormField
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.confirmPassword}
                  onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))}
                  error={passwordErrors.confirmPassword}
                  required
                />
              </div>

              <div>
                <Button type="submit" variant="navy" icon="lock" loading={passwordPending}>
                  Update password
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="stack">
          <Card title="Your account">
            <div className="row" style={{ gap: 12, marginBottom: 16 }}>
              <UserAvatar name={user?.fullName} size="lg" />
              <div>
                <div style={{ fontWeight: 650, fontSize: 15 }}>{user?.fullName}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{user?.email}</div>
              </div>
            </div>

            <dl className="dl">
              <dt>Role</dt>
              <dd><span className="role-chip">{user?.roleLabel}</span></dd>
              <dt>Status</dt>
              <dd style={{ textTransform: 'capitalize' }}>{user?.status}</dd>
              <dt>Member since</dt>
              <dd>{formatDate(user?.memberSince)}</dd>
              <dt>Last sign-in</dt>
              <dd>{formatDate(user?.lastLoginAt, { withTime: true })}</dd>
            </dl>
          </Card>

          <Card title="Your permissions" subtitle="What your role allows on this platform">
            <div className="row" style={{ gap: 6 }}>
              {(user?.permissions ?? []).map((permission) => (
                <span className="chip chip--muted" key={permission} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {permission}
                </span>
              ))}
            </div>
            <p className="field__hint" style={{ marginTop: 12 }}>
              These are enforced by the NexBank API on every request, not just in this interface.
            </p>
          </Card>

          <Card title="About NexBank">
            <dl className="dl">
              <dt>Product</dt>
              <dd>NexBank Online Banking</dd>
              <dt>Version</dt>
              <dd>1.0.0</dd>
              <dt>Stack</dt>
              <dd>React · Node.js / Express · MySQL</dd>
            </dl>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <Watermark />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
