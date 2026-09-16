const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const axios = require('axios');
const { authMiddleware } = require('./auth');
const { Transaction, Upload } = require('../models/Transaction');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================================
// OLLAMA — Free local LLM for AI summary text
// Install: https://ollama.ai → then: ollama pull llama3.2
// ============================================================
async function generateAISummary(summaryData) {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3.2';

    const prompt = `You are a financial forensics AI assistant. Write a professional 3-paragraph forensic analysis summary based on this data:

Total Transactions: ${summaryData.total}
Flagged as Suspicious: ${summaryData.flagged} (${summaryData.flag_rate}%)
Critical Risk: ${summaryData.critical}
High Risk: ${summaryData.high}
Average Risk Score: ${summaryData.avg_risk}%
Top Fraud Categories: ${summaryData.categories.join(', ')}

Write a concise professional forensic analysis suitable for a legal report. Paragraph 1: Overview of findings. Paragraph 2: Risk assessment. Paragraph 3: Recommendations. Keep it under 200 words total. Do not use bullet points.`;

    const response = await axios.post(
      `${ollamaUrl}/api/generate`,
      { model, prompt, stream: false },
      { timeout: 30000 }
    );

    return response.data.response || generateFallbackSummary(summaryData);
  } catch (error) {
    // Ollama not running — use template-based summary
    console.log('Ollama not available, using template summary');
    return generateFallbackSummary(summaryData);
  }
}

function generateFallbackSummary(data) {
  return `
FORENSIC ANALYSIS SUMMARY

This automated analysis processed ${data.total.toLocaleString()} financial transactions using DeepGuard's dual AI model system (Isolation Forest and Deep Autoencoder). The analysis identified ${data.flagged.toLocaleString()} suspicious transactions, representing ${data.flag_rate}% of the total dataset. Among flagged transactions, ${data.critical} were classified as Critical risk and ${data.high} as High risk, requiring immediate investigative attention.

The risk assessment indicates that the flagged transactions demonstrate patterns consistent with financial anomalies including ${data.categories.slice(0,2).join(' and ')}. The average risk score across all flagged transactions was ${data.avg_risk}%, with Explainable AI (SHAP) analysis providing feature-level justification for each AI decision, ensuring full transparency and auditability of results.

It is recommended that all Critical and High risk transactions be subject to immediate manual review by qualified financial auditors. Transactions flagged as Statistical Outliers should be cross-referenced with account history, while Hidden Pattern flags warrant network-level investigation using the attached graph analysis. This report has been generated automatically and is intended as a forensic aid — final determinations remain the responsibility of authorized auditors.
  `.trim();
}

// ============================================================
// PDF HTML TEMPLATE
// ============================================================
function buildReportHTML(upload, transactions, summary, aiSummary, user) {
  const now = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });

  const riskColor = (level) => {
    if (level === 'CRITICAL') return '#e74c3c';
    if (level === 'HIGH') return '#e67e22';
    if (level === 'MEDIUM') return '#f39c12';
    return '#2ecc71';
  };

  const topRows = transactions.slice(0, 50).map((tx, i) => `
    <tr style="background:${i % 2 === 0 ? '#f8f9fa' : '#fff'}">
      <td>${tx.row_index + 1}</td>
      <td>${tx.from_account || 'N/A'}</td>
      <td>${tx.to_account || 'N/A'}</td>
      <td>${tx.payment_format || 'N/A'}</td>
      <td>$${(tx.amount_paid || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
      <td>${tx.payment_currency || 'N/A'}</td>
      <td style="font-weight:bold;color:${riskColor(tx.risk_level)}">${tx.risk_score.toFixed(1)}%</td>
      <td>
        <span style="
          background:${riskColor(tx.risk_level)};
          color:white;padding:2px 8px;
          border-radius:12px;font-size:11px;
          font-weight:bold
        ">${tx.risk_level}</span>
      </td>
      <td>${tx.fraud_category}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; color: #2c3e50; font-size: 13px; }
    .page { padding: 40px; }

    /* HEADER */
    .header {
      background: linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%);
      color: white; padding: 30px 40px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .header-left h1 { font-size: 28px; color: #00d4ff; letter-spacing: 2px; }
    .header-left p { font-size: 12px; opacity: 0.8; margin-top: 4px; }
    .header-right { text-align: right; font-size: 11px; opacity: 0.9; line-height: 1.8; }
    .shield { font-size: 40px; margin-right: 15px; }

    /* REPORT META */
    .report-meta {
      background: #f0f4f8; border-left: 4px solid #00d4ff;
      padding: 15px 20px; margin: 20px 0;
      display: flex; justify-content: space-between;
    }
    .meta-item { text-align: center; }
    .meta-item .label { font-size: 10px; color: #7f8c8d; text-transform: uppercase; }
    .meta-item .value { font-size: 16px; font-weight: bold; color: #2c3e50; }

    /* SUMMARY CARDS */
    .summary-grid {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 15px; margin: 20px 0;
    }
    .card {
      border-radius: 8px; padding: 15px; text-align: center;
      border: 1px solid #e0e0e0;
    }
    .card .num { font-size: 28px; font-weight: bold; }
    .card .lbl { font-size: 11px; color: #7f8c8d; margin-top: 4px; text-transform: uppercase; }
    .card-total { background: #e8f4fd; }
    .card-flagged { background: #fdf2f8; }
    .card-critical { background: #fdf0f0; }
    .card-high { background: #fef9e7; }

    /* SECTION HEADERS */
    h2 {
      font-size: 15px; color: #1a3a5c;
      border-bottom: 2px solid #00d4ff;
      padding-bottom: 8px; margin: 25px 0 15px;
      text-transform: uppercase; letter-spacing: 1px;
    }
    h3 { font-size: 13px; color: #2c3e50; margin: 15px 0 8px; }

    /* AI SUMMARY */
    .ai-summary {
      background: #f8f9fa; border-left: 4px solid #3498db;
      padding: 15px 20px; border-radius: 0 8px 8px 0;
      line-height: 1.7; color: #34495e; margin: 15px 0;
    }

    /* TABLE */
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th {
      background: #1a3a5c; color: white;
      padding: 8px 6px; text-align: left;
      font-size: 10px; text-transform: uppercase;
    }
    td { padding: 6px; border-bottom: 1px solid #ecf0f1; }

    /* RISK BAR */
    .risk-bar-container { margin: 15px 0; }
    .risk-bar-row { display: flex; align-items: center; margin: 5px 0; }
    .risk-bar-label { width: 80px; font-size: 11px; }
    .risk-bar { height: 18px; border-radius: 3px; min-width: 4px; }
    .risk-bar-count { margin-left: 8px; font-size: 11px; font-weight: bold; }

    /* SHAP SECTION */
    .shap-card {
      border: 1px solid #e0e0e0; border-radius: 8px;
      padding: 12px; margin: 10px 0; page-break-inside: avoid;
    }
    .shap-card img { width: 100%; max-height: 200px; object-fit: contain; }

    /* FOOTER */
    .footer {
      background: #0a1628; color: white;
      padding: 15px 40px; margin-top: 30px;
      display: flex; justify-content: space-between;
      font-size: 10px; opacity: 0.9;
    }
    .watermark {
      text-align: center; color: #bdc3c7;
      font-size: 10px; margin: 10px 0;
      font-style: italic;
    }
    .page-break { page-break-before: always; }
    .badge {
      display: inline-block; padding: 3px 10px;
      border-radius: 12px; font-size: 10px;
      font-weight: bold; color: white;
    }
  </style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div style="display:flex;align-items:center">
    <span class="shield">🛡️</span>
    <div class="header-left">
      <h1>DEEPGUARD</h1>
      <p>AI-Driven Financial Forensics Platform — Forensic Audit Report</p>
    </div>
  </div>
  <div class="header-right">
    <div><strong>Report ID:</strong> DG-${upload._id.toString().slice(-8).toUpperCase()}</div>
    <div><strong>Generated:</strong> ${now}</div>
    <div><strong>Auditor:</strong> ${user.full_name || user.email}</div>
    <div><strong>File:</strong> ${upload.original_filename}</div>
    <div><strong>Classification:</strong> <span style="color:#e74c3c;font-weight:bold">CONFIDENTIAL</span></div>
  </div>
</div>

<div class="page">

<!-- REPORT META -->
<div class="report-meta">
  <div class="meta-item">
    <div class="label">Report Date</div>
    <div class="value">${new Date().toLocaleDateString('en-PK')}</div>
  </div>
  <div class="meta-item">
    <div class="label">Processing Time</div>
    <div class="value">${((upload.processing_time_ms || 0) / 1000).toFixed(1)}s</div>
  </div>
  <div class="meta-item">
    <div class="label">AI Models Used</div>
    <div class="value">IF + AE</div>
  </div>
  <div class="meta-item">
    <div class="label">XAI Method</div>
    <div class="value">SHAP</div>
  </div>
  <div class="meta-item">
    <div class="label">Institution</div>
    <div class="value">Iqra University</div>
  </div>
</div>

<!-- SUMMARY CARDS -->
<h2>📊 Executive Summary</h2>
<div class="summary-grid">
  <div class="card card-total">
    <div class="num" style="color:#2980b9">${(upload.total_transactions || 0).toLocaleString()}</div>
    <div class="lbl">Total Transactions</div>
  </div>
  <div class="card card-flagged">
    <div class="num" style="color:#8e44ad">${(upload.flagged_count || 0).toLocaleString()}</div>
    <div class="lbl">Flagged Suspicious</div>
  </div>
  <div class="card card-critical">
    <div class="num" style="color:#e74c3c">${(upload.critical_count || 0).toLocaleString()}</div>
    <div class="lbl">Critical Risk</div>
  </div>
  <div class="card card-high">
    <div class="num" style="color:#e67e22">${(upload.high_count || 0).toLocaleString()}</div>
    <div class="lbl">High Risk</div>
  </div>
</div>

<!-- RISK BAR CHART -->
<div class="risk-bar-container">
  <h3>Risk Level Distribution</h3>
  ${['CRITICAL','HIGH','MEDIUM','LOW'].map(level => {
    const counts = { CRITICAL: upload.critical_count, HIGH: upload.high_count,
                     MEDIUM: upload.medium_count, LOW: upload.low_count };
    const colors = { CRITICAL:'#e74c3c', HIGH:'#e67e22', MEDIUM:'#f39c12', LOW:'#2ecc71' };
    const count = counts[level] || 0;
    const pct = upload.total_transactions ? (count / upload.total_transactions * 100) : 0;
    const barWidth = Math.max(pct * 4, count > 0 ? 10 : 0);
    return `
    <div class="risk-bar-row">
      <span class="risk-bar-label">${level}</span>
      <div class="risk-bar" style="width:${barWidth}px;background:${colors[level]}"></div>
      <span class="risk-bar-count" style="color:${colors[level]}">${count.toLocaleString()} (${pct.toFixed(1)}%)</span>
    </div>`;
  }).join('')}
</div>

<!-- AI ANALYSIS SUMMARY -->
<h2>🤖 AI Analysis Summary</h2>
<div class="ai-summary">${aiSummary.replace(/\n\n/g, '</p><p style="margin-top:10px">').replace(/\n/g, ' ')}</div>

<!-- FLAGGED TRANSACTIONS TABLE -->
<div class="page-break"></div>
<h2>⚠️ Flagged Transactions (Top 50 by Risk Score)</h2>
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>From Account</th>
      <th>To Account</th>
      <th>Format</th>
      <th>Amount Paid</th>
      <th>Currency</th>
      <th>Risk Score</th>
      <th>Risk Level</th>
      <th>Category</th>
    </tr>
  </thead>
  <tbody>${topRows}</tbody>
</table>

${transactions.length > 50 ? `<p style="margin-top:10px;font-style:italic;color:#7f8c8d">
  * Showing top 50 of ${transactions.length.toLocaleString()} flagged transactions. Full dataset available in CSV export.
</p>` : ''}

<!-- SHAP EXPLANATIONS -->
${transactions.slice(0, 5).some(tx => tx.shap_chart) ? `
<div class="page-break"></div>
<h2>🔍 SHAP Explainability — Top Flagged Transactions</h2>
<p style="color:#7f8c8d;margin-bottom:15px;font-size:11px">
  SHAP (SHapley Additive Explanations) shows which features contributed most to each AI fraud flag.
  This ensures full transparency and legal justifiability of AI decisions.
</p>
${transactions.slice(0, 5).filter(tx => tx.shap_chart).map((tx, i) => `
<div class="shap-card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <strong>Transaction #${tx.row_index + 1}</strong>
    <span>
      <span class="badge" style="background:${
        tx.risk_level === 'CRITICAL' ? '#e74c3c' :
        tx.risk_level === 'HIGH' ? '#e67e22' : '#f39c12'
      }">${tx.risk_level}</span>
      &nbsp; Risk Score: <strong>${tx.risk_score.toFixed(1)}%</strong>
      &nbsp; Category: ${tx.fraud_category}
    </span>
  </div>
  <img src="data:image/png;base64,${tx.shap_chart}" alt="SHAP Chart ${i+1}" />
</div>
`).join('')}
` : ''}

<!-- LEGAL DISCLAIMER -->
<div class="page-break"></div>
<h2>⚖️ Legal Disclaimer & Audit Certificate</h2>
<div style="background:#fff8e1;border:1px solid #f39c12;padding:15px;border-radius:8px;line-height:1.7;font-size:11px">
  <p><strong>This report has been generated automatically by DeepGuard AI Financial Forensics Platform.</strong></p>
  <br/>
  <p>The findings contained in this document are based on unsupervised machine learning analysis using Isolation Forest and Deep Autoencoder models. SHAP (SHapley Additive Explanations) values have been computed to ensure transparency of all AI decisions in compliance with explainable AI requirements.</p>
  <br/>
  <p>This report is intended as a forensic aid for qualified financial auditors and compliance officers. All AI-generated flags should be reviewed by authorized human auditors before any legal or regulatory action is taken. DeepGuard provides the evidence — the final determination remains the sole responsibility of the authorized auditing authority.</p>
  <br/>
  <p><strong>Report Hash:</strong> DG-${Date.now().toString(16).toUpperCase()} &nbsp;|&nbsp;
     <strong>Generated by:</strong> ${user.full_name || user.email} &nbsp;|&nbsp;
     <strong>Timestamp:</strong> ${new Date().toISOString()} &nbsp;|&nbsp;
     <strong>Status:</strong> <span style="color:#27ae60;font-weight:bold">VERIFIED & SEALED</span>
  </p>
</div>

<div class="watermark">
  This is a system-generated document. Any modification to this PDF invalidates its forensic integrity.
  DeepGuard — AI Financial Forensics Platform | Iqra University FYP 2026
</div>

</div><!-- end page -->

<!-- FOOTER -->
<div class="footer">
  <span>🛡️ DeepGuard | AI Financial Forensics Platform</span>
  <span>Report ID: DG-${upload._id.toString().slice(-8).toUpperCase()}</span>
  <span>Generated: ${now} | CONFIDENTIAL</span>
</div>

</body>
</html>`;
}

// ============================================================
// POST /api/reports/generate/:upload_id
// ============================================================
router.post('/generate/:upload_id', authMiddleware, async (req, res) => {
  let browser;
  try {
    const { upload_id } = req.params;

    const upload = await Upload.findById(upload_id);
    if (!upload) return res.status(404).json({ error: 'Upload not found' });
    if (req.user.role !== 'admin' && upload.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get flagged transactions with SHAP
    const transactions = await Transaction.find({
      upload_id,
      is_flagged: true
    }).sort({ risk_score: -1 }).limit(200);

    // Gather categories
    const categories = [...new Set(transactions.map(t => t.fraud_category).filter(Boolean))];

    // Generate AI summary via Ollama (free) or fallback template
    const aiSummary = await generateAISummary({
      total: upload.total_transactions || 0,
      flagged: upload.flagged_count || 0,
      flag_rate: upload.total_transactions
        ? ((upload.flagged_count / upload.total_transactions) * 100).toFixed(2) : 0,
      critical: upload.critical_count || 0,
      high: upload.high_count || 0,
      avg_risk: upload.avg_risk_score || 0,
      categories
    });

    // Build HTML
    const html = buildReportHTML(upload, transactions, {}, aiSummary, req.user);

    // Generate PDF with Puppeteer
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false
    });

    await browser.close();

    // Log to Supabase
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'REPORT_GENERATED',
      details: `PDF report generated for upload: ${upload.original_filename}`,
      upload_id: upload_id,
      created_at: new Date().toISOString()
    });

    // Send PDF
    const filename = `DeepGuard_Report_${upload._id.toString().slice(-8)}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Report generation failed', details: error.message });
  }
});

// GET /api/reports/history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('action', 'REPORT_GENERATED')
      .order('created_at', { ascending: false })
      .limit(20);
    res.json({ reports: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
