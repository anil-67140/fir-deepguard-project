import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, ZoomIn, ZoomOut, Maximize2, Info } from 'lucide-react';
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import { graphAPI } from '../services/api';

cytoscape.use(cola);

export default function GraphPage() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  const cyRef = useRef(null);
  const cyInstance = useRef(null);
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [traceAccount, setTraceAccount] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(true);
  const [tracing, setTracing] = useState(false);

  const loadGraph = async (flagged = true) => {
    setLoading(true);
    try {
      const res = await graphAPI.getGraph(uploadId, { flagged_only: flagged, max_nodes: 300 });
      setGraphData(res.data);
      renderGraph(res.data);
    } catch (e) {
      console.error('Graph load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderGraph = (data) => {
    if (!cyRef.current) return;
    if (cyInstance.current) cyInstance.current.destroy();

    const elements = [
      ...data.nodes.map(n => ({
        data: {
          id: n.data.id,
          label: n.data.label,
          risk_score: n.data.risk_score || 0,
          is_flagged: n.data.is_flagged,
          bank: n.data.bank
        }
      })),
      ...data.edges.map(e => ({
        data: {
          id: e.data.id,
          source: e.data.source,
          target: e.data.target,
          amount: e.data.amount,
          risk_score: e.data.risk_score || 0,
          is_flagged: e.data.is_flagged
        }
      }))
    ];

    const nodeColor = (risk) => {
      if (risk >= 75) return '#e74c3c';
      if (risk >= 50) return '#e67e22';
      if (risk >= 25) return '#f39c12';
      return '#2ecc71';
    };

    cyInstance.current = cytoscape({
      container: cyRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele) => nodeColor(ele.data('risk_score')),
            'border-width': 2,
            'border-color': (ele) => ele.data('is_flagged') ? '#e74c3c' : '#254870',
            'label': 'data(label)',
            'color': '#e8f4fd',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': '4px',
            'width': (ele) => Math.max(20, Math.min(50, 20 + ele.data('risk_score') / 3)),
            'height': (ele) => Math.max(20, Math.min(50, 20 + ele.data('risk_score') / 3)),
            'overlay-padding': '6px'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#00d4ff',
            'box-shadow': '0 0 15px rgba(0,212,255,0.5)'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': (ele) => Math.max(1, Math.min(5, ele.data('risk_score') / 20)),
            'line-color': (ele) => ele.data('is_flagged') ? '#e74c3c' : '#254870',
            'target-arrow-color': (ele) => ele.data('is_flagged') ? '#e74c3c' : '#254870',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.7
          }
        },
        {
          selector: 'edge:selected',
          style: { 'line-color': '#00d4ff', 'target-arrow-color': '#00d4ff', 'opacity': 1 }
        }
      ],
      layout: {
        name: elements.length > 100 ? 'cose' : 'cola',
        animate: elements.length < 150,
        nodeRepulsion: 2048,
        idealEdgeLength: 80,
        maxSimulationTime: 3000
      }
    });

    // Node click — show info
    cyInstance.current.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNode({
        id: node.id(),
        label: node.data('label'),
        risk_score: node.data('risk_score'),
        is_flagged: node.data('is_flagged'),
        bank: node.data('bank'),
        degree: node.degree()
      });
    });

    cyInstance.current.on('tap', (evt) => {
      if (evt.target === cyInstance.current) setSelectedNode(null);
    });
  };

  useEffect(() => {
    loadGraph(flaggedOnly);
    return () => { if (cyInstance.current) cyInstance.current.destroy(); };
  }, [uploadId]);

  const handleTrace = async () => {
    if (!traceAccount.trim()) return;
    setTracing(true);
    try {
      const res = await graphAPI.traceAccount(uploadId, traceAccount.trim(), 5);
      setGraphData(res.data);
      renderGraph(res.data);
    } catch (e) {
      alert('Account not found in graph data');
    } finally {
      setTracing(false);
    }
  };

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 108px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                     fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}
          >
            <ChevronLeft size={16} /> Back to Analysis
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: '700' }}>🕸️ Transaction Network Graph</h1>
        </div>

        {graphData && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {graphData.stats?.total_nodes} nodes · {graphData.stats?.total_edges} edges ·
              <span style={{ color: 'var(--critical)' }}> {graphData.stats?.flagged_nodes} suspicious</span>
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Controls Panel */}
        <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Trace Account */}
          <div className="card" style={{ padding: '14px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>
              🔍 Trace Account (graphLookup)
            </h4>
            <input
              placeholder="Enter account ID..."
              value={traceAccount}
              onChange={e => setTraceAccount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTrace()}
              style={{ fontSize: '12px', padding: '8px', marginBottom: '8px' }}
            />
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Traces money trail up to 5 hops deep using MongoDB $graphLookup
            </p>
            <button
              className="btn btn-primary w-full"
              onClick={handleTrace}
              disabled={tracing || !traceAccount}
              style={{ justifyContent: 'center', padding: '8px', fontSize: '12px' }}
            >
              {tracing ? 'Tracing...' : 'Trace Network'}
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={() => { setTraceAccount(''); loadGraph(flaggedOnly); }}
              style={{ justifyContent: 'center', padding: '8px', fontSize: '12px', marginTop: '6px' }}
            >
              Reset Graph
            </button>
          </div>

          {/* Graph Controls */}
          <div className="card" style={{ padding: '14px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>Controls</h4>
            <button
              className="btn btn-secondary w-full"
              onClick={() => cyInstance.current?.fit()}
              style={{ justifyContent: 'center', padding: '8px', fontSize: '12px', marginBottom: '6px' }}
            >
              <Maximize2 size={14} /> Fit to Screen
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 1.2)}
              style={{ justifyContent: 'center', padding: '8px', fontSize: '12px', marginBottom: '6px' }}
            >
              <ZoomIn size={14} /> Zoom In
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={() => cyInstance.current?.zoom(cyInstance.current.zoom() * 0.8)}
              style={{ justifyContent: 'center', padding: '8px', fontSize: '12px' }}
            >
              <ZoomOut size={14} /> Zoom Out
            </button>
          </div>

          {/* Legend */}
          <div className="card" style={{ padding: '14px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>Node Risk Legend</h4>
            {[
              ['Critical (≥75%)', '#e74c3c'],
              ['High (≥50%)', '#e67e22'],
              ['Medium (≥25%)', '#f39c12'],
              ['Low (<25%)', '#2ecc71']
            ].map(([label, color], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ width: '30px', height: '2px', background: '#e74c3c' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Suspicious edge</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '30px', height: '2px', background: '#254870' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Normal edge</span>
              </div>
            </div>
          </div>

          {/* Selected Node Info */}
          {selectedNode && (
            <div className="card fade-in" style={{ padding: '14px', border: '1px solid var(--accent)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: 'var(--accent)' }}>
                Selected Account
              </h4>
              {[
                ['Account ID', selectedNode.id],
                ['Bank', selectedNode.bank || 'N/A'],
                ['Risk Score', `${selectedNode.risk_score?.toFixed(1) || 0}%`],
                ['Connections', selectedNode.degree],
                ['Flagged', selectedNode.is_flagged ? '⚠️ Yes' : '✅ No']
              ].map(([k, v], i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '5px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none'
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontSize: '11px', fontWeight: '500' }}>{v}</span>
                </div>
              ))}
              <button
                className="btn btn-secondary w-full"
                onClick={() => { setTraceAccount(selectedNode.id); handleTrace(); }}
                style={{ justifyContent: 'center', padding: '6px', fontSize: '11px', marginTop: '8px' }}
              >
                Trace This Account
              </button>
            </div>
          )}
        </div>

        {/* Graph Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          {loading && (
            <div className="flex-center" style={{
              position: 'absolute', inset: 0, zIndex: 10,
              flexDirection: 'column', gap: '12px',
              background: 'var(--bg-card)', borderRadius: '12px'
            }}>
              <div className="spinner" />
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Building network graph...</p>
            </div>
          )}
          <div
            ref={cyRef}
            style={{
              width: '100%', height: '100%',
              background: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border)'
            }}
          />
          {!loading && graphData?.nodes?.length === 0 && (
            <div className="flex-center" style={{
              position: 'absolute', inset: 0,
              flexDirection: 'column', gap: '8px', color: 'var(--text-muted)'
            }}>
              <Info size={32} opacity={0.3} />
              <p style={{ fontSize: '13px' }}>No graph data available. Run an analysis first.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
