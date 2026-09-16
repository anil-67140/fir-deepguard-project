import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Filter, Download, Network,
  ChevronLeft, ChevronRight, Search, Eye, X
} from 'lucide-react';
import { analysisAPI, reportsAPI } from '../services/api';

const RiskBadge = ({ level }) => (
  <span className={`badge badge-${level?.toLowerCase()}`}>{level}</span>
);

function SHAPModal({ tx, onClose }) {
  if (!tx) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      zIndex: 1000, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '20px'
    }} onClick={onClose}>
      <div
        className="card fade-in"
        style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>🔍 SHAP Explanation</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
              Transaction #{tx.row_index + 1} — Risk Score: <strong style={{ color: 'var(--critical)' }}>{tx.risk_score?.toFixed(1)}%</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Transaction Details */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '10px', marginBottom: '20px'
        }}>
          {[
            ['From Account', tx.from_account || 'N/A'],
            ['To Account', tx.to_account || 'N/A'],
            ['Amount Paid', `$${(tx.amount_paid || 0).toLocaleString()}`],
            ['Payment Format', tx.payment_format || 'N/A'],
            ['IF Score', `${tx.isolation_forest_score?.toFixed(1)}%`],
            ['AE Score', `${tx.autoencoder_score?.toFixed(1)}%`],
            ['Category', tx.fraud_category || 'N/A'],
            ['Risk Level', tx.risk_level]
          ].map(([k, v], i) => (
            <div key={i} style={{
              background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px'
            }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{k}</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>{v}</div>
            </div>
          ))}
        </div>

        {/* SHAP Chart */}
        {tx.shap_chart ? (
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>
              Feature Importance (SHAP Values)
            </h4>
            <img
              src={`data:image/png;base64,${tx.shap_chart}`}
              alt="SHAP Chart"
              style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border)' }}
            />
          </div>
        ) : tx.shap_values && Object.keys(tx.shap_values).length > 0 ? (
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>
              Top Contributing Features
            </h4>
            {Object.entries(tx.shap_values).slice(0, 8).map(([feat, val], i) => {
              const maxVal = Math.max(...Object.values(tx.shap_values));
              const pct = (val / maxVal * 100).toFixed(0);
              return (
                <div key={i} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {feat.substring(0, 30)}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)' }}>
                      {parseFloat(val).toFixed(4)}
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: `linear-gradient(90deg, var(--accent), var(--high))`,
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-center" style={{ height: '100px', color: 'var(--text-muted)', fontSize: '13px' }}>
            SHAP data not available for this transaction
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [flaggedOnly, setFlaggedOnly] = useState(true);
  const [riskLevel, setRiskLevel] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (flaggedOnly) params.flagged_only = 'true';
      if (riskLevel) params.risk_level = riskLevel;
      const res = await analysisAPI.getResults(uploadId, params);
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [uploadId, page, flaggedOnly, riskLevel]);

  const handleGeneratePDF = async () => {
    setGeneratingPDF(true);
    try {
      await reportsAPI.generate(uploadId);
    } catch (e) {
      alert('PDF generation failed: ' + (e.message || 'Unknown error'));
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleViewTx = async (tx) => {
    if (tx.shap_chart || (tx.shap_values && Object.keys(tx.shap_values || {}).length > 0)) {
      setSelectedTx(tx);
    } else {
      try {
        const res = await analysisAPI.getTransaction(uploadId, tx._id);
        setSelectedTx(res.data.transaction);
      } catch (e) {
        setSelectedTx(tx);
      }
    }
  };

  const filteredTx = (data?.transactions || []).filter(tx => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (tx.from_account || '').toLowerCase().includes(s) ||
           (tx.to_account || '').toLowerCase().includes(s) ||
           (tx.fraud_category || '').toLowerCase().includes(s);
  });

  return (
    <div className="fade-in">
      {selectedTx && <SHAPModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                     fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <h1 style={{ fontSize: '22px', fontWeight: '700' }}>⚠️ Analysis Results</h1>
          {data?.upload && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              {data.upload.original_filename} — {data.upload.total_transactions?.toLocaleString()} transactions
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/graph/${uploadId}`)}
          >
            <Network size={16} /> Network Graph
          </button>
          <button
            className="btn btn-primary"
            onClick={handleGeneratePDF}
            disabled={generatingPDF}
          >
            {generatingPDF ? (
              <><div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> Generating...</>
            ) : (
              <><Download size={16} /> PDF Report</>
            )}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {data?.upload && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total', value: data.upload.total_transactions?.toLocaleString(), color: 'var(--accent)' },
            { label: 'Flagged', value: data.upload.flagged_count?.toLocaleString(), color: 'var(--critical)' },
            { label: 'Critical', value: data.upload.critical_count?.toLocaleString(), color: 'var(--critical)' },
            { label: 'High', value: data.upload.high_count?.toLocaleString(), color: 'var(--high)' },
            { label: 'Avg Risk', value: `${data.upload.avg_risk_score?.toFixed(1)}%`, color: 'var(--medium)' }
          ].map((s, i) => (
            <div key={i} className="card" style={{ textAlign: 'center', padding: '14px' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px', padding: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              placeholder="Search accounts, categories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '36px', padding: '8px 12px 8px 36px', fontSize: '13px' }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={e => { setFlaggedOnly(e.target.checked); setPage(1); }}
              style={{ width: 'auto', accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Flagged only</span>
          </label>
          <select
            value={riskLevel}
            onChange={e => { setRiskLevel(e.target.value); setPage(1); }}
            style={{ width: 'auto', padding: '8px 12px', fontSize: '13px' }}
          >
            <option value="">All Risk Levels</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="flex-center" style={{ height: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading transactions...</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>From Account</th>
                    <th>To Account</th>
                    <th>Format</th>
                    <th>Amount Paid</th>
                    <th>Risk Score</th>
                    <th>IF Score</th>
                    <th>AE Score</th>
                    <th>Level</th>
                    <th>Category</th>
                    <th>SHAP</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No transactions match your filters
                      </td>
                    </tr>
                  ) : filteredTx.map((tx, i) => (
                    <tr key={tx._id || i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{tx.row_index + 1}</td>
                      <td className="mono">{(tx.from_account || 'N/A').substring(0, 14)}</td>
                      <td className="mono">{(tx.to_account || 'N/A').substring(0, 14)}</td>
                      <td style={{ fontSize: '12px' }}>{tx.payment_format || 'N/A'}</td>
                      <td style={{ fontWeight: '500' }}>${(tx.amount_paid || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '50px', height: '5px', background: 'var(--border)', borderRadius: '3px' }}>
                            <div style={{
                              height: '100%', width: `${tx.risk_score}%`,
                              background: tx.risk_score >= 75 ? 'var(--critical)' :
                                         tx.risk_score >= 50 ? 'var(--high)' : 'var(--medium)',
                              borderRadius: '3px'
                            }} />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: '600' }}>{tx.risk_score?.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{tx.isolation_forest_score?.toFixed(0)}%</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{tx.autoencoder_score?.toFixed(0)}%</td>
                      <td><RiskBadge level={tx.risk_level} /></td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{tx.fraud_category}</td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewTx(tx)}
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data?.pagination && data.pagination.pages > 1 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderTop: '1px solid var(--border)'
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Page {data.pagination.page} of {data.pagination.pages} — {data.pagination.total?.toLocaleString()} records
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft size={14} />
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
