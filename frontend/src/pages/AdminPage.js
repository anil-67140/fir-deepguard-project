import React, { useState, useEffect } from 'react';
import { Users, Shield, Trash2, Activity, RefreshCw, UserPlus } from 'lucide-react';
import { adminAPI, authAPI } from '../services/api';

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'auditor' });
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    adminAPI.getSystemStats().then(r => setStats(r.data)).catch(console.error);
    if (tab === 'users') loadUsers();
    if (tab === 'logs') loadLogs();
  }, [tab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getUsers();
      setUsers(res.data.users || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getLogs({ page: 1, limit: 50 });
      setLogs(res.data.logs || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await adminAPI.updateRole(userId, role);
      loadUsers();
    } catch (e) { alert('Failed to update role'); }
  };

  const handleDelete = async (userId, email) => {
    if (!window.confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteUser(userId);
      loadUsers();
    } catch (e) { alert('Failed to delete user'); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await authAPI.register(newUser);
      setNewUser({ email: '', password: '', full_name: '', role: 'auditor' });
      setShowCreateForm(false);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const logActionColor = (action) => {
    if (action.includes('FAIL') || action.includes('ERROR')) return 'var(--critical)';
    if (action.includes('DELETE') || action.includes('REMOVE')) return 'var(--high)';
    if (action.includes('COMPLETE') || action.includes('SUCCESS')) return 'var(--low)';
    return 'var(--accent)';
  };

  const TabBtn = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        background: tab === id ? 'rgba(0,212,255,0.1)' : 'transparent',
        border: tab === id ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
        color: tab === id ? 'var(--accent)' : 'var(--text-secondary)',
        padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '13px', fontWeight: '500'
      }}
    >
      <Icon size={15} />{label}
    </button>
  );

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700' }}>⚙️ Admin Panel</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          System administration — user management, roles and audit logs
        </p>
      </div>

      {/* System Stats */}
      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px', marginBottom: '24px'
        }}>
          {[
            { label: 'Total Users', value: stats.total_users || 0, color: 'var(--accent)' },
            { label: 'Total Uploads', value: stats.total_uploads || 0, color: 'var(--high)' },
            { label: 'Total Transactions', value: (stats.total_transactions || 0).toLocaleString(), color: 'var(--accent)' },
            { label: 'Total Flagged', value: (stats.total_flagged || 0).toLocaleString(), color: 'var(--critical)' }
          ].map((s, i) => (
            <div key={i} className="card" style={{ textAlign: 'center', padding: '14px' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <TabBtn id="users" label="User Management" icon={Users} />
        <TabBtn id="logs" label="Audit Logs" icon={Activity} />
        <button
          onClick={tab === 'users' ? loadUsers : loadLogs}
          className="btn btn-secondary btn-sm"
          style={{ marginLeft: 'auto' }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* USERS TAB */}
      {tab === 'users' && (
        <div>
          {/* Create User Form */}
          {showCreateForm && (
            <div className="card fade-in" style={{ marginBottom: '16px', border: '1px solid var(--accent)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: 'var(--accent)' }}>
                Create New User
              </h3>
              <form onSubmit={handleCreateUser}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label>Full Name</label>
                    <input
                      required
                      value={newUser.full_name}
                      onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label>Email Address</label>
                    <input
                      type="email" required
                      value={newUser.email}
                      onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label>Password</label>
                    <input
                      type="password" required minLength={8}
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="Min 8 characters"
                    />
                  </div>
                  <div>
                    <label>Role</label>
                    <select
                      value={newUser.role}
                      onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="auditor">Auditor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? 'Creating...' : <><UserPlus size={14} /> Create User</>}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600' }}>
                All Users ({users.length})
              </h3>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                <UserPlus size={13} /> Add User
              </button>
            </div>

            {loading ? (
              <div className="flex-center" style={{ height: '150px' }}>
                <div className="spinner" />
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id || i}>
                        <td style={{ fontWeight: '500', fontSize: '13px' }}>
                          {u.full_name || 'N/A'}
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {u.email}
                        </td>
                        <td>
                          <select
                            value={u.role || 'auditor'}
                            onChange={e => handleRoleChange(u.id, e.target.value)}
                            style={{
                              width: 'auto', padding: '4px 8px', fontSize: '12px',
                              background: u.role === 'admin' ? 'rgba(0,212,255,0.1)' : 'var(--bg-secondary)',
                              color: u.role === 'admin' ? 'var(--accent)' : 'var(--text-secondary)'
                            }}
                          >
                            <option value="auditor">Auditor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('en-PK') : 'N/A'}
                        </td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(u.id, u.email)}
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOGS TAB */}
      {tab === 'logs' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600' }}>
              Audit Trail — Last 50 Actions
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Read-only immutable log of all user actions • Retained 90 days
            </p>
          </div>
          {loading ? (
            <div className="flex-center" style={{ height: '150px' }}>
              <div className="spinner" />
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No audit logs yet
                      </td>
                    </tr>
                  ) : logs.map((log, i) => (
                    <tr key={log.id || i}>
                      <td style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString('en-PK') : 'N/A'}
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {log.profiles?.full_name || log.user_id?.substring(0, 8) || 'System'}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px', fontWeight: '600',
                          color: logActionColor(log.action),
                          fontFamily: 'monospace'
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
