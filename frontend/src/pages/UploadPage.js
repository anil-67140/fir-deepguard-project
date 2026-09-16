import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Upload, FileSpreadsheet, CheckCircle,
  AlertCircle, X, BarChart3, Clock
} from 'lucide-react';
import { uploadAPI } from '../services/api';
import { addNotification } from '../store';

export default function UploadPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const fileInputRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const STAGES = [
    'Validating file...',
    'Uploading to server...',
    'Parsing CSV/Excel data...',
    'Running Isolation Forest...',
    'Running Deep Autoencoder...',
    'Computing SHAP values...',
    'Building network graph...',
    'Saving results to database...',
    'Finalizing analysis...'
  ];

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSet(dropped);
  }, []);

  const validateAndSet = (f) => {
    setError('');
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setError('Only CSV and Excel (.xlsx, .xls) files are supported.');
      return;
    }
    const maxMB = 100;
    if (f.size > maxMB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${maxMB}MB.`);
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError('');
    setResult(null);

    // Simulate stage progression
    let stageIdx = 0;
    setStage(STAGES[0]);
    const stageTimer = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, STAGES.length - 1);
      setStage(STAGES[stageIdx]);
    }, 8000);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await uploadAPI.uploadFile(formData, (pct) => {
        setProgress(Math.min(pct, 30)); // Upload is first 30%
      });

      clearInterval(stageTimer);
      setProgress(100);
      setStage('Analysis complete! ✅');
      setResult(res.data);

      dispatch(addNotification({
        type: 'success',
        message: `Analysis complete: ${res.data.summary.flagged} transactions flagged`
      }));

    } catch (err) {
      clearInterval(stageTimer);
      setError(err.response?.data?.error || 'Upload failed. Check if AI engine is running.');
      setStage('');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const riskColor = (level) => {
    const m = { CRITICAL: 'var(--critical)', HIGH: 'var(--high)', MEDIUM: 'var(--medium)', LOW: 'var(--low)' };
    return m[level] || 'var(--accent)';
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700' }}>
          📤 Upload & Analyze Transactions
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '14px' }}>
          Upload bulk CSV or Excel transaction files for AI-powered fraud detection
        </p>
      </div>

      {/* Drop Zone */}
      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
          className="card"
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent)' : file ? 'var(--low)' : 'var(--border)'}`,
            borderRadius: '16px', padding: '48px',
            textAlign: 'center', cursor: file ? 'default' : 'pointer',
            background: dragOver ? 'rgba(0,212,255,0.05)' : 'var(--bg-card)',
            transition: 'all 0.2s', marginBottom: '16px'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => validateAndSet(e.target.files[0])}
          />

          {!file ? (
            <>
              <div style={{
                width: '72px', height: '72px', borderRadius: '20px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <Upload size={32} color="var(--accent)" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                Drop your transaction file here
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                or click to browse
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {['.CSV', '.XLSX', '.XLS'].map(ext => (
                  <span key={ext} style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    padding: '4px 12px', borderRadius: '6px', fontSize: '12px',
                    color: 'var(--text-secondary)'
                  }}>{ext}</span>
                ))}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '12px' }}>
                Maximum file size: 100MB | IBM AML format supported
              </p>
            </>
          ) : (
            <div>
              <CheckCircle size={48} color="var(--low)" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                File Ready
              </h3>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '10px', margin: '12px 0'
              }}>
                <FileSpreadsheet size={20} color="var(--accent)" />
                <span style={{ fontWeight: '500' }}>{file.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          background: 'rgba(231,76,60,0.1)', border: '1px solid var(--critical)',
          borderRadius: '10px', padding: '14px', marginBottom: '16px', color: 'var(--critical)'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <strong style={{ fontSize: '13px' }}>Error</strong>
            <p style={{ fontSize: '12px', marginTop: '2px', opacity: 0.9 }}>{error}</p>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>{stage}</span>
            <span style={{ fontSize: '13px', color: 'var(--accent)' }}>{progress}%</span>
          </div>
          <div style={{
            height: '8px', background: 'var(--bg-secondary)',
            borderRadius: '4px', overflow: 'hidden'
          }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--accent), var(--low))',
              borderRadius: '4px', transition: 'width 0.5s ease'
            }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '8px' }}>
            ⏱️ Large files may take up to 3 minutes. Do not close this tab.
          </p>
        </div>
      )}

      {/* Upload Button */}
      {file && !uploading && !result && (
        <button
          className="btn btn-primary w-full"
          onClick={handleUpload}
          style={{ justifyContent: 'center', padding: '14px', fontSize: '15px' }}
        >
          <BarChart3 size={18} />
          Run AI Analysis
        </button>
      )}

      {/* RESULTS */}
      {result && (
        <div className="fade-in">
          <div style={{
            background: 'rgba(39,174,96,0.1)', border: '1px solid var(--low)',
            borderRadius: '12px', padding: '20px', marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <CheckCircle size={28} color="var(--low)" />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--low)' }}>
                Analysis Complete!
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Processed {result.summary.total_transactions?.toLocaleString()} transactions
                in {((result.processing_time_ms || 0) / 1000).toFixed(1)}s
              </p>
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px', marginBottom: '20px'
          }}>
            {[
              { label: 'Total', value: result.summary.total_transactions?.toLocaleString(), color: 'var(--accent)' },
              { label: 'Flagged', value: result.summary.flagged?.toLocaleString(), color: 'var(--critical)' },
              { label: 'Critical', value: result.summary.critical_count?.toLocaleString(), color: 'var(--critical)' },
              { label: 'High Risk', value: result.summary.high_count?.toLocaleString(), color: 'var(--high)' }
            ].map((s, i) => (
              <div key={i} className="card" style={{ textAlign: 'center', padding: '16px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/analysis/${result.upload_id}`)}
              style={{ flex: 1 }}
            >
              <BarChart3 size={16} /> View Full Analysis
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/graph/${result.upload_id}`)}
              style={{ flex: 1 }}
            >
              View Network Graph
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setFile(null); setResult(null); }}
            >
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* Info boxes */}
      {!result && !uploading && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: '12px', marginTop: '20px'
        }}>
          {[
            { icon: '🌲', title: 'Isolation Forest', desc: 'Detects obvious statistical outliers in transaction amounts and patterns' },
            { icon: '🧠', title: 'Deep Autoencoder', desc: 'Catches hidden slow-moving fraud patterns invisible to manual review' },
            { icon: '🔍', title: 'SHAP Explainability', desc: 'Generates feature importance charts explaining every AI decision' }
          ].map((info, i) => (
            <div key={i} className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{info.icon}</div>
              <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>{info.title}</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{info.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
