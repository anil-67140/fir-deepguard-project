import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Download, Clock, CheckCircle,
  AlertTriangle, RefreshCw, Eye
} from 'lucide-react';
import { uploadAPI, reportsAPI } from '../services/api';

export default function ReportsPage() {
  const navigate = useNavigate();
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);

  useEffect(() => {
    uploadAPI.getHistory()
      .then(res => setUploads(res.data.uploads || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async (uploadId) => {
    setGenerating(uploadId);
    try {
      await reportsAPI.generate(uploadId);
    } catch (e) {
      alert('PDF generation failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setGenerating(null);
    }
  };

  const statusColor = (s) => {
    if (s === 'completed') return 'var(--low)';
    if (s === 'processing') return 'var(--accent)';
    if (s === 'failed') return 'var(--critical)';
    return 'var(--text-muted)';
  };

  const statusIcon = (s) => {
    if (s === 'completed') return <CheckCircle size={14} />;
    if (s === 'processing') return <RefreshCw size={14} className="pulse" />;
    if (s === 'failed') return <AlertTriangle size={14} />;
    return <Clock size={14} />;
  };

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700' }}>📄 Forensic Reports</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          Generate and download automated PDF forensic reports for completed analyses
        </p>
      </div>

      {/* How it works */}
      <div className="card" style={{
        marginBottom: '24px', padding: '16px',
        background: 'rgba(0,212,255,0.05)',
        border: '1px solid rgba(0,212,255,0.2)'
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: 'var(--accent)' }}>
          How PDF Reports Work
        </h3>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {[
            ['1. Select Upload', 'Choose a completed analysis from the list below'],
            ['2. AI Summary', 'Ollama LLM generates forensic analysis text (free, runs locally)'],
            ['3. Build Report', 'Puppeteer compiles SHAP charts, transaction data and AI summary'],
            ['4. Download PDF', 'Non-editable, court-admissible PDF with digital timestamp']
          ].map(([step, desc], i) => (
            <div key={i} style={{ flex: 1, minWidth: '180px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)', marginBottom: '4px' }}>
                {step}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{desc}</div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: '12px', padding: '8px 12px',
          background: 'rgba(243,156,18,0.1)', border: '1px solid var(--medium)',
          borderRadius: '6px', fontSize: '11px', color: 'var(--medium)'
        }}>
          ⚠️ <strong>Ollama Setup:</strong> Install from https://ollama.ai → run{' '}
          <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: '4px' }}>
            ollama pull llama3.2
          </code>
          {' '}— If Ollama is not running, reports still generate using template summaries.
        </div>
      </div>

      {/* Upload History */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600' }}>Upload History</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {uploads.length} total uploads
          </span>
        </div>

        {loading ? (
          <div className="flex-center" style={{ height: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading uploads...</p>
          </div>
        ) : uploads.length === 0 ? (
          <div className="flex-center" style={{ height: '200px', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)' }}>
            <FileText size={36} opacity={0.3} />
            <p style={{ fontSize: '13px' }}>No uploads yet. Upload a transaction file to get started.</p>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/upload')}>
              Upload File
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Flagged</th>
                  <th>Critical</th>
                  <th>Avg Risk</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u, i) => (
                  <tr key={u._id || i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={14} color="var(--accent)" />
                        <span style={{ fontSize: '13px', fontWeight: '500' }}>
                          {u.original_filename || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        color: statusColor(u.status), fontSize: '12px', fontWeight: '500'
                      }}>
                        {statusIcon(u.status)}
                        {u.status?.charAt(0).toUpperCase() + u.status?.slice(1)}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px' }}>{(u.total_transactions || 0).toLocaleString()}</td>
                    <td>
                      <span style={{ color: 'var(--critical)', fontWeight: '600', fontSize: '13px' }}>
                        {(u.flagged_count || 0).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--critical)', fontSize: '13px' }}>
                        {(u.critical_count || 0).toLocaleString()}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px' }}>
                      {u.avg_risk_score ? `${u.avg_risk_score.toFixed(1)}%` : 'N/A'}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-PK') : 'N/A'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {u.status === 'completed' && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => navigate(`/analysis/${u._id}`)}
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleGenerate(u._id)}
                              disabled={generating === u._id}
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                            >
                              {generating === u._id ? (
                                <><div className="spinner" style={{ width: '10px', height: '10px', borderWidth: '2px' }} /> PDF...</>
                              ) : (
                                <><Download size={12} /> PDF</>
                              )}
                            </button>
                          </>
                        )}
                        {u.status === 'failed' && (
                          <span style={{ fontSize: '11px', color: 'var(--critical)' }}>
                            {u.error_message?.substring(0, 30) || 'Failed'}
                          </span>
                        )}
                        {u.status === 'processing' && (
                          <span style={{ fontSize: '11px', color: 'var(--accent)' }}>Processing...</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
