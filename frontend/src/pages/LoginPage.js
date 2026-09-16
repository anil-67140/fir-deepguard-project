import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, AlertCircle, Loader } from 'lucide-react';
import { setCredentials, setAuthError } from '../store';
import { authAPI } from '../services/api';

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(form.email, form.password);
      dispatch(setCredentials(res.data));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #0a1628, #1a3a5c)',
            border: '1px solid var(--accent)', marginBottom: '16px',
            boxShadow: '0 0 30px rgba(0,212,255,0.2)'
          }}>
            <Shield size={36} color="var(--accent)" />
          </div>
          <h1 style={{
            fontSize: '28px', fontWeight: '800',
            color: 'var(--accent)', letterSpacing: '3px'
          }}>DEEPGUARD</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
            AI Financial Forensics Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="card" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
            Sign in to your account
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
            Enter your credentials to access the platform
          </p>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(231,76,60,0.1)', border: '1px solid var(--critical)',
              borderRadius: '8px', padding: '12px', marginBottom: '20px', color: 'var(--critical)'
            }}>
              <AlertCircle size={16} />
              <span style={{ fontSize: '13px' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{
                  position: 'absolute', left: '14px', top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)'
                }} />
                <input
                  type="email"
                  placeholder="auditor@example.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={{ paddingLeft: '42px' }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute', left: '14px', top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)'
                }} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  style={{ paddingLeft: '42px' }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
              style={{ justifyContent: 'center', padding: '12px' }}
            >
              {loading ? (
                <><div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                  Authenticating...</>
              ) : (
                <><Shield size={16} /> Sign In Securely</>
              )}
            </button>
          </form>

          <p style={{
            textAlign: 'center', marginTop: '20px',
            color: 'var(--text-muted)', fontSize: '12px'
          }}>
            🔒 Secured with JWT + bcrypt encryption
          </p>
        </div>

        {/* University badge */}
        <div style={{
          textAlign: 'center', marginTop: '24px',
          color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.6'
        }}>
          <p>Iqra University — Department of Computer Science</p>
          <p>FYP 2026 — Supervised by Dr. Dure e Jabeen</p>
        </div>
      </div>
    </div>
  );
}
