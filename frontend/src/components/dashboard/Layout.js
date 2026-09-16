import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Shield, LayoutDashboard, Upload, BarChart3,
  Network, FileText, Settings, LogOut, Bell, User, ChevronRight
} from 'lucide-react';
import { logout } from '../../store';
import { authAPI } from '../../services/api';

const NavItem = ({ to, icon: Icon, label, end = false }) => (
  <NavLink
    to={to}
    end={end}
    style={({ isActive }) => ({
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 16px', borderRadius: '8px',
      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
      background: isActive ? 'rgba(0,212,255,0.1)' : 'transparent',
      border: isActive ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent',
      textDecoration: 'none', fontSize: '14px', fontWeight: '500',
      transition: 'all 0.2s', marginBottom: '4px'
    })}
  >
    <Icon size={18} />
    <span>{label}</span>
    {({ isActive }) => isActive && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
  </NavLink>
);

export default function Layout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(state => state.auth);

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch (e) {}
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* SIDEBAR */}
      <aside style={{
        width: 'var(--sidebar-width)', minHeight: '100vh',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 16px',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #0a1628, #1a3a5c)',
              border: '1px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Shield size={20} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--accent)', letterSpacing: '2px' }}>
                DEEPGUARD
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Financial Forensics AI
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', paddingLeft: '4px', letterSpacing: '1px' }}>
            MAIN
          </div>
          <NavLink to="/dashboard" end style={({ isActive }) => navStyle(isActive)}>
            <LayoutDashboard size={18} /><span>Dashboard</span>
          </NavLink>
          <NavLink to="/upload" style={({ isActive }) => navStyle(isActive)}>
            <Upload size={18} /><span>Upload & Analyze</span>
          </NavLink>

          <div style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '16px 0 8px', paddingLeft: '4px', letterSpacing: '1px' }}>
            FORENSICS
          </div>
          <NavLink to="/reports" style={({ isActive }) => navStyle(isActive)}>
            <FileText size={18} /><span>Reports</span>
          </NavLink>

          {user?.role === 'admin' && (
            <>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '16px 0 8px', paddingLeft: '4px', letterSpacing: '1px' }}>
                ADMIN
              </div>
              <NavLink to="/admin" style={({ isActive }) => navStyle(isActive)}>
                <Settings size={18} /><span>Admin Panel</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* User info */}
        <div style={{
          padding: '16px', borderTop: '1px solid var(--border)'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px', borderRadius: '8px',
            background: 'var(--bg-card)', marginBottom: '8px'
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <User size={16} color="var(--bg-primary)" />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.full_name || user?.email}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-secondary w-full"
            style={{ justifyContent: 'center', fontSize: '13px', padding: '8px' }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{
        marginLeft: 'var(--sidebar-width)',
        flex: 1, minHeight: '100vh',
        background: 'var(--bg-primary)'
      }}>
        {/* Top bar */}
        <header style={{
          height: '60px', background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px', position: 'sticky',
          top: 0, zIndex: 50
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="pulse" style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--low)'
            }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              AI Engine Active
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Bell size={18} color="var(--text-secondary)" style={{ cursor: 'pointer' }} />
            <span style={{
              background: 'rgba(0,212,255,0.1)', border: '1px solid var(--accent)',
              color: 'var(--accent)', padding: '4px 12px',
              borderRadius: '20px', fontSize: '11px', fontWeight: '600'
            }}>
              {user?.role?.toUpperCase()}
            </span>
          </div>
        </header>

        {/* Page content */}
        <div style={{ padding: '24px' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const navStyle = (isActive) => ({
  display: 'flex', alignItems: 'center', gap: '12px',
  padding: '10px 12px', borderRadius: '8px',
  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
  background: isActive ? 'rgba(0,212,255,0.1)' : 'transparent',
  border: isActive ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent',
  textDecoration: 'none', fontSize: '14px', fontWeight: '500',
  transition: 'all 0.2s', marginBottom: '4px'
});
