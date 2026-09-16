import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, AlertTriangle, Shield, TrendingUp,
  Upload, FileText, Network, Activity
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { dashboardAPI } from '../services/api';

const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="card fade-in" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
    <div style={{
      width: '52px', height: '52px', borderRadius: '12px',
      background: `${color}22`, border: `1px solid ${color}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>
      <Icon size={24} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '26px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  </div>
);

const RISK_COLORS = {
  CRITICAL: '#e74c3c', HIGH: '#e67e22', MEDIUM: '#f39c12', LOW: '#2ecc71'
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.getSummary()
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex-center" style={{ height: '60vh', flexDirection: 'column', gap: '16px' }}>
      <div className="spinner" />
      <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
    </div>
  );

  const stats = data?.stats || {};
  const riskDist = data?.risk_distribution || {};
  const recentUploads = data?.recent_uploads || [];
  const recentFlagged = data?.recent_flagged || [];

  const pieData = Object.entries(riskDist)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const barData = recentUploads.map(u => ({
    name: u.original_filename?.substring(0, 15) || 'Unknown',
    flagged: u.flagged_count || 0,
    total: u.total_transactions || 0
  }));

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700' }}>
          🛡️ Overview — System Health
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '14px' }}>
          Real-time forensic monitoring dashboard
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px', marginBottom: '24px'
      }}>
        <StatCard icon={Activity} label="Total Transactions Analyzed"
          value={(stats.total_transactions || 0).toLocaleString()}
          color="var(--accent)" sub="All time" />
        <StatCard icon={AlertTriangle} label="High-Risk Alerts Detected"
          value={(stats.total_flagged || 0).toLocaleString()}
          color="var(--critical)" sub={`${stats.flag_rate || 0}% flag rate`} />
        <StatCard icon={TrendingUp} label="AI Performance Accuracy"
          value={`${stats.ai_accuracy || 99.8}%`}
          color="var(--low)" sub="ROC-AUC based" />
        <StatCard icon={Upload} label="Total File Uploads"
          value={stats.total_uploads || 0}
          color="var(--high)" sub="Processed batches" />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

        {/* Bar Chart */}
        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
            📊 Recent Upload Analysis
          </h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Bar dataKey="flagged" fill="var(--critical)" name="Flagged" radius={[4,4,0,0]} />
                <Bar dataKey="total" fill="var(--accent)" name="Total" radius={[4,4,0,0]} opacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-center" style={{ height: '200px', color: 'var(--text-muted)', flexDirection: 'column', gap: '8px' }}>
              <Upload size={32} opacity={0.3} />
              <p style={{ fontSize: '13px' }}>No uploads yet. Upload a file to start analysis.</p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/upload')}>
                Upload Now
              </button>
            </div>
          )}
        </div>

        {/* Pie Chart */}
        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
            🎯 Risk Level Distribution
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                  dataKey="value" paddingAngle={4}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={RISK_COLORS[entry.name] || '#8884d8'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                <Legend formatter={(v) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-center" style={{ height: '200px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '13px' }}>No analysis data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Model Status + Recent Alerts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>

        {/* Model Status */}
        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
            🤖 Model Status
          </h3>
          {[
            { name: 'Isolation Forest', status: 'Active', color: 'var(--low)' },
            { name: 'Deep Autoencoder', status: 'Active', color: 'var(--low)' },
            { name: 'SHAP Explainer', status: 'Active', color: 'var(--low)' },
            { name: 'Graph Engine', status: 'Active', color: 'var(--low)' },
            { name: 'PDF Generator', status: 'Ready', color: 'var(--accent)' }
          ].map((m, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none'
            }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{m.name}</span>
              <span className="badge" style={{
                background: `${m.color}22`, color: m.color,
                border: `1px solid ${m.color}44`, fontSize: '10px'
              }}>
                ● {m.status}
              </span>
            </div>
          ))}
        </div>

        {/* Recent Flagged Transactions */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600' }}>
              ⚠️ Latest High-Risk Alerts
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/upload')}>
              View All
            </button>
          </div>
          {recentFlagged.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>From Account</th>
                    <th>To Account</th>
                    <th>Amount</th>
                    <th>Risk Score</th>
                    <th>Level</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFlagged.map((tx, i) => (
                    <tr key={i}>
                      <td className="mono">{tx.from_account?.substring(0, 12) || 'N/A'}</td>
                      <td className="mono">{tx.to_account?.substring(0, 12) || 'N/A'}</td>
                      <td>${(tx.amount_paid || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '60px', height: '6px', borderRadius: '3px',
                            background: 'var(--border)', overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%', width: `${tx.risk_score}%`,
                              background: tx.risk_score >= 75 ? 'var(--critical)' :
                                         tx.risk_score >= 50 ? 'var(--high)' : 'var(--medium)',
                              borderRadius: '3px'
                            }} />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: '600' }}>
                            {tx.risk_score?.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${tx.risk_level?.toLowerCase()}`}>
                          {tx.risk_level}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {tx.fraud_category}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-center" style={{ height: '150px', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)' }}>
              <Shield size={32} opacity={0.3} />
              <p style={{ fontSize: '13px' }}>No alerts yet. Upload transaction data to begin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
