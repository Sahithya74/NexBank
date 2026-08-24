import { useState } from 'react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import Modal, { ConfirmationDialog } from '../../components/Modal';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import UserAvatar from '../../components/UserAvatar';
import Icon from '../../components/Icon';
import { EmptyState, InlineAlert, QueryState } from '../../components/States';
import { useApiQuery, useDebounced } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { formatDate, formatMoney, humanise } from '../../utils/format';

const EMPTY_USER = {
  fullName: '', email: '', password: '', roleId: '', phone: '', address: '', managedBy: '',
};

export default function Users() {
  const { can, user: currentUser } = useAuth();
  const toast = useToast();

  const [filters, setFilters] = useState({ q: '', role: '', status: '' });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: 'created_at', sortDir: 'desc' });
  const debouncedQuery = useDebounced(filters.q, 350);

  const roles = useApiQuery('/admin/roles', { enabled: can('role.view', 'user.manage') });
  const staff = useApiQuery('/admin/staff');
  const users = useApiQuery('/admin/users', {
    params: {
      page,
      limit: 10,
      q: debouncedQuery || undefined,
      role: filters.role || undefined,
      status: filters.status || undefined,
      sortBy: sort.sortBy,
      sortDir: sort.sortDir,
    },
  });

  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const canManage = can('user.manage');

  const openCreate = () => {
    setForm({ ...EMPTY_USER, roleId: roles.data?.roles?.find((role) => role.name === 'customer')?.id ?? '' });
    setError(null);
    setCreating(true);
  };

  const openEdit = (row) => {
    setForm({
      fullName: row.fullName,
      email: row.email,
      password: '',
      roleId: row.roleId,
      phone: '',
      address: '',
      managedBy: row.managedBy ?? '',
    });
    setError(null);
    setEditing(row);
  };

  const saveUser = async (event) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (editing) {
        await api.put(`/admin/users/${editing.id}`, {
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          roleId: form.roleId ? Number(form.roleId) : undefined,
          managedBy: form.managedBy ? Number(form.managedBy) : undefined,
        });
        toast.success('User updated', `${form.fullName} has been saved.`);
        setEditing(null);
      } else {
        await api.post('/admin/users', {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          roleId: Number(form.roleId),
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          managedBy: form.managedBy ? Number(form.managedBy) : undefined,
        });
        toast.success('User created', `${form.fullName} can now sign in.`);
        setCreating(false);
      }
      await users.reload({ quiet: true });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPending(false);
    }
  };

  const changeStatus = async () => {
    setPending(true);
    try {
      const nextStatus = statusTarget.status === 'suspended' ? 'active' : 'suspended';
      await api.patch(`/admin/users/${statusTarget.id}/status`, { status: nextStatus });
      toast.success(
        nextStatus === 'suspended' ? 'User suspended' : 'User reactivated',
        `${statusTarget.fullName} is now ${nextStatus}.`,
      );
      setStatusTarget(null);
      await users.reload({ quiet: true });
    } catch (caught) {
      toast.error('Could not update user', caught.message);
    } finally {
      setPending(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api.post(`/admin/users/${resetTarget.id}/password`, { password: newPassword });
      toast.success('Password reset', `${resetTarget.fullName} can sign in with the new password.`);
      setResetTarget(null);
      setNewPassword('');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPending(false);
    }
  };

  const openDetail = async (row) => {
    try {
      setDetail(await api.get(`/admin/users/${row.id}`));
    } catch (caught) {
      toast.error('Could not load user', caught.message);
    }
  };

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Users</h1>
          <p className="page__subtitle">Manage platform users, their roles and their access.</p>
        </div>
        {canManage ? (
          <div className="page__actions">
            <Button icon="plus" onClick={openCreate}>Create user</Button>
          </div>
        ) : null}
      </div>

      <Card flush>
        <div className="filter-bar">
          <FormField
            label="Search"
            className="field--grow"
            type="search"
            placeholder="Name or email address"
            value={filters.q}
            onChange={(event) => {
              setFilters((current) => ({ ...current, q: event.target.value }));
              setPage(1);
            }}
          />
          <FormField
            label="Role"
            as="select"
            value={filters.role}
            onChange={(event) => {
              setFilters((current) => ({ ...current, role: event.target.value }));
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            {(roles.data?.roles ?? []).map((role) => (
              <option key={role.id} value={role.name}>{role.label}</option>
            ))}
          </FormField>
          <FormField
            label="Status"
            as="select"
            value={filters.status}
            onChange={(event) => {
              setFilters((current) => ({ ...current, status: event.target.value }));
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </FormField>
        </div>

        <DataTable
          columns={[
            {
              key: 'fullName',
              header: 'User',
              sortKey: 'full_name',
              render: (row) => (
                <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                  <UserAvatar name={row.fullName} size="sm" />
                  <span style={{ minWidth: 0 }}>
                    <div className="cell-title">{row.fullName}</div>
                    <div className="cell-sub">{row.email}</div>
                  </span>
                </div>
              ),
            },
            { key: 'roleLabel', header: 'Role', render: (row) => <span className="role-chip">{row.roleLabel}</span> },
            { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
            { key: 'accounts', header: 'Accounts', align: 'right', render: (row) => row.accounts ?? 0 },
            {
              key: 'managerName',
              header: 'Assigned to',
              render: (row) => row.managerName || <span style={{ color: 'var(--faint)' }}>—</span>,
            },
            {
              key: 'lastLoginAt',
              header: 'Last sign-in',
              sortKey: 'created_at',
              render: (row) => formatDate(row.lastLoginAt, { withTime: true }),
            },
            { key: 'status', header: 'Status', sortKey: 'status', render: (row) => <StatusBadge status={row.status} /> },
            {
              key: 'actions',
              header: 'Actions',
              render: (row) => (
                <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <Button size="sm" variant="secondary" onClick={() => openDetail(row)}>View</Button>
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 30, height: 30 }}
                        onClick={() => openEdit(row)}
                        aria-label={`Edit ${row.fullName}`}
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 30, height: 30 }}
                        onClick={() => {
                          setResetTarget(row);
                          setNewPassword('');
                          setError(null);
                        }}
                        aria-label={`Reset password for ${row.fullName}`}
                      >
                        <Icon name="lock" size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 30, height: 30 }}
                        onClick={() => setStatusTarget(row)}
                        disabled={String(row.id) === String(currentUser?.id)}
                        aria-label={`${row.status === 'suspended' ? 'Reactivate' : 'Suspend'} ${row.fullName}`}
                      >
                        <Icon name={row.status === 'suspended' ? 'check' : 'block'} size={14} />
                      </button>
                    </>
                  ) : null}
                </div>
              ),
            },
          ]}
          rows={users.data?.items}
          loading={users.loading}
          error={users.error}
          onRetry={users.reload}
          pagination={users.data?.pagination}
          onPageChange={setPage}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
          caption="Platform users"
          empty={<EmptyState icon="users" title="No users match these filters" text="Try a different search or filter." />}
        />
      </Card>

      {/* Create / edit */}
      <Modal
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? 'Edit user' : 'Create user'}
        subtitle={editing ? editing.email : 'A customer also gets a wallet and a savings account.'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={saveUser} loading={pending}>{editing ? 'Save changes' : 'Create user'}</Button>
          </>
        }
      >
        <form onSubmit={saveUser} className="stack" style={{ gap: 14 }}>
          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

          <FormField
            label="Full name"
            value={form.fullName}
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            required
          />

          {!editing ? (
            <>
              <FormField
                label="Email address"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
              <FormField
                label="Temporary password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                hint="At least 8 characters, with letters and numbers."
                required
              />
            </>
          ) : null}

          <div className="form-grid">
            <FormField
              label="Role"
              as="select"
              value={form.roleId}
              onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))}
              required
            >
              <option value="">Select a role</option>
              {(roles.data?.roles ?? []).map((role) => (
                <option key={role.id} value={role.id}>{role.label}</option>
              ))}
            </FormField>

            <FormField
              label="Assigned employee"
              as="select"
              value={form.managedBy}
              onChange={(event) => setForm((current) => ({ ...current, managedBy: event.target.value }))}
              hint="Who services this customer"
            >
              <option value="">Unassigned</option>
              {(staff.data ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name} ({humanise(member.role_name)})
                </option>
              ))}
            </FormField>

            <FormField
              label="Phone"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
            <FormField
              label="Address"
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            />
          </div>
        </form>
      </Modal>

      {/* Detail */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.fullName}
        subtitle={detail?.email}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>}
      >
        {detail ? (
          <div className="stack" style={{ gap: 18 }}>
            <div className="row" style={{ gap: 12 }}>
              <UserAvatar name={detail.fullName} size="lg" />
              <div>
                <div style={{ fontWeight: 650, fontSize: 15 }}>{detail.fullName}</div>
                <div className="row" style={{ gap: 8, marginTop: 4 }}>
                  <span className="role-chip">{detail.roleLabel}</span>
                  <StatusBadge status={detail.status} />
                </div>
              </div>
            </div>

            <dl className="dl">
              <dt>Email</dt>
              <dd>{detail.email}</dd>
              <dt>Phone</dt>
              <dd>{detail.phone || '—'}</dd>
              <dt>Assigned to</dt>
              <dd>{detail.managerName || 'Unassigned'}</dd>
              <dt>Member since</dt>
              <dd>{formatDate(detail.createdAt)}</dd>
              <dt>Last sign-in</dt>
              <dd>{formatDate(detail.lastLoginAt, { withTime: true })}</dd>
              <dt>Transactions</dt>
              <dd>{detail.transactionCount}</dd>
              <dt>Loans</dt>
              <dd>{detail.loanCount}</dd>
            </dl>

            <div>
              <h3 className="card__title" style={{ marginBottom: 8 }}>Accounts</h3>
              {detail.accounts.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>This user has no accounts.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table table--stack">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Type</th>
                        <th className="num">Balance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.accounts.map((account) => (
                        <tr key={account.id}>
                          <td data-label="Account" className="mono">{account.accountNumberMasked}</td>
                          <td data-label="Type">{humanise(account.accountType)}</td>
                          <td data-label="Balance" className="num">
                            {formatMoney(account.balance, account.currency)}
                          </td>
                          <td data-label="Status"><StatusBadge status={account.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Reset password */}
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title="Reset password"
        subtitle={resetTarget ? `${resetTarget.fullName} · ${resetTarget.email}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)} disabled={pending}>Cancel</Button>
            <Button variant="navy" onClick={resetPassword} loading={pending}>Reset password</Button>
          </>
        }
      >
        <form onSubmit={resetPassword} className="stack" style={{ gap: 14 }}>
          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
          <InlineAlert variant="warning">
            Share the new password with the user through a secure channel. This action is recorded in the audit log.
          </InlineAlert>
          <FormField
            label="New password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            hint="At least 8 characters, with letters and numbers."
            required
          />
        </form>
      </Modal>

      <ConfirmationDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={changeStatus}
        pending={pending}
        title={statusTarget?.status === 'suspended' ? 'Reactivate this user?' : 'Suspend this user?'}
        message={
          statusTarget?.status === 'suspended'
            ? `${statusTarget?.fullName} will be able to sign in again.`
            : `${statusTarget?.fullName} will be signed out and blocked from signing in until reactivated.`
        }
        confirmLabel={statusTarget?.status === 'suspended' ? 'Reactivate' : 'Suspend'}
        variant={statusTarget?.status === 'suspended' ? 'primary' : 'danger'}
      />
    </>
  );
}
