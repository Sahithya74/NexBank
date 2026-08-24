import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { InlineAlert, QueryState } from '../../components/States';
import { useApiQuery } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { humanise } from '../../utils/format';

/**
 * Permissions live in the database, so changing them here takes effect on the very
 * next API request - no redeploy, no re-login.
 */
export default function Roles() {
  const { can, refresh } = useAuth();
  const toast = useToast();
  const roles = useApiQuery('/admin/roles');

  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [selection, setSelection] = useState(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const canManage = can('role.manage');
  const roleList = roles.data?.roles ?? [];
  const permissions = roles.data?.permissions ?? [];

  const activeRole = roleList.find((role) => role.id === selectedRoleId) ?? roleList[0];

  useEffect(() => {
    if (activeRole) {
      setSelectedRoleId(activeRole.id);
      setSelection(new Set(activeRole.permissionIds));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole?.id, roles.data]);

  const grouped = useMemo(() => {
    const map = new Map();
    permissions.forEach((permission) => {
      if (!map.has(permission.module)) map.set(permission.module, []);
      map.get(permission.module).push(permission);
    });
    return [...map.entries()];
  }, [permissions]);

  const isAdminRole = activeRole?.name === 'admin';
  const dirty =
    activeRole &&
    (selection.size !== activeRole.permissionIds.length ||
      activeRole.permissionIds.some((id) => !selection.has(id)));

  const toggle = (id) => {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleModule = (modulePermissions) => {
    const ids = modulePermissions.map((permission) => permission.id);
    const allSelected = ids.every((id) => selection.has(id));
    setSelection((current) => {
      const next = new Set(current);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const save = async () => {
    setPending(true);
    setError(null);
    try {
      await api.put(`/admin/roles/${activeRole.id}/permissions`, {
        permissionIds: [...selection],
      });
      toast.success('Permissions updated', `${activeRole.label} now has ${selection.size} permissions.`);
      await roles.reload({ quiet: true });
      await refresh();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="page__header">
        <div>
          <h1 className="page__title">Roles & permissions</h1>
          <p className="page__subtitle">
            Control what each role can do. Changes apply on the next API request.
          </p>
        </div>
        {canManage && dirty && !isAdminRole ? (
          <div className="page__actions">
            <Button
              variant="secondary"
              onClick={() => setSelection(new Set(activeRole.permissionIds))}
              disabled={pending}
            >
              Discard changes
            </Button>
            <Button icon="check" onClick={save} loading={pending}>Save permissions</Button>
          </div>
        ) : null}
      </div>

      <QueryState loading={roles.loading} error={roles.error} onRetry={roles.reload} rows={4}>
        <div className="grid grid--sidebar">
          <Card
            title={activeRole ? `${activeRole.label} permissions` : 'Permissions'}
            subtitle={
              activeRole
                ? `${selection.size} of ${permissions.length} permissions granted`
                : undefined
            }
            flush
          >
            <div className="card__body">
              {error ? (
                <div style={{ marginBottom: 14 }}>
                  <InlineAlert variant="danger">{error}</InlineAlert>
                </div>
              ) : null}

              {isAdminRole ? (
                <div style={{ marginBottom: 14 }}>
                  <InlineAlert variant="info">
                    The administrator role always holds every permission and cannot be edited.
                  </InlineAlert>
                </div>
              ) : !canManage ? (
                <div style={{ marginBottom: 14 }}>
                  <InlineAlert variant="info">
                    You can view role permissions but only an administrator can change them.
                  </InlineAlert>
                </div>
              ) : null}

              <div className="stack" style={{ gap: 20 }}>
                {grouped.map(([module, modulePermissions]) => {
                  const granted = modulePermissions.filter((permission) => selection.has(permission.id)).length;
                  return (
                    <div key={module}>
                      <div className="row row--between" style={{ marginBottom: 6 }}>
                        <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
                          {humanise(module)}
                        </h3>
                        <span className="row" style={{ gap: 10 }}>
                          <span className="chip chip--muted">{granted}/{modulePermissions.length}</span>
                          {canManage && !isAdminRole ? (
                            <Button size="sm" variant="ghost" onClick={() => toggleModule(modulePermissions)}>
                              {granted === modulePermissions.length ? 'Clear all' : 'Select all'}
                            </Button>
                          ) : null}
                        </span>
                      </div>

                      <div className="card" style={{ boxShadow: 'none' }}>
                        <div className="card__body" style={{ padding: '4px 14px' }}>
                          {modulePermissions.map((permission) => (
                            <label className="checkbox-row" key={permission.id}>
                              <input
                                type="checkbox"
                                checked={isAdminRole || selection.has(permission.id)}
                                disabled={!canManage || isAdminRole}
                                onChange={() => toggle(permission.id)}
                              />
                              <span>
                                <span className="checkbox-row__label mono" style={{ fontSize: 12.5 }}>
                                  {permission.code}
                                </span>
                                <br />
                                <span className="checkbox-row__hint">{permission.description}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {canManage && !isAdminRole ? (
              <div className="card__footer">
                <div className="row row--between">
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                    {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
                  </span>
                  <Button icon="check" onClick={save} loading={pending} disabled={!dirty}>
                    Save permissions
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          <Card title="Roles" subtitle="Select a role to review its access" flush>
            <div>
              {roleList.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={`notification-item ${role.id === activeRole?.id ? 'is-unread' : ''}`}
                  style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => setSelectedRoleId(role.id)}
                  aria-pressed={role.id === activeRole?.id}
                >
                  <span className="stat__icon stat__icon--navy" style={{ width: 32, height: 32 }} aria-hidden="true">
                    <Icon name="roles" size={15} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="notification-item__title">{role.label}</span>
                    <span className="notification-item__text">{role.description}</span>
                    <span className="notification-item__time">
                      {role.permissionIds.length} permissions · {role.userCount} user
                      {role.userCount === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </QueryState>
    </>
  );
}
