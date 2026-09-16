const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { authMiddleware } = require('./auth');
const { Transaction, Upload, FinancialEntity } = require('../models/Transaction');
const connectDB = require('../config/db');
const { createClient } = require('@supabase/supabase-js');

connectDB();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV and Excel files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 100) * 1024 * 1024
  }
});

// POST /api/upload
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  const startTime = Date.now();

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Create upload record
  let uploadRecord;
  try {
    uploadRecord = await Upload.create({
      user_id: req.user.id,
      filename: req.file.filename,
      original_filename: req.file.originalname,
      file_size_bytes: req.file.size,
      status: 'processing'
    });

    // Log to Supabase
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'FILE_UPLOAD',
      details: `Uploaded: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`,
      upload_id: uploadRecord._id.toString(),
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('DB error:', e);
    return res.status(500).json({ error: 'Database error creating upload record' });
  }

  // Send to FastAPI
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const fastapiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
    const response = await axios.post(`${fastapiUrl}/analyze`, formData, {
      headers: formData.getHeaders(),
      timeout: 10 * 60 * 1000, // 10 minutes timeout for large files
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const aiResults = response.data;

    // Store transactions in MongoDB
    const transactions = aiResults.results.map((r) => ({
      upload_id: uploadRecord._id,
      user_id: req.user.id,
      timestamp: r.transaction_data.Timestamp
        ? new Date(r.transaction_data.Timestamp) : new Date(),
      from_bank: r.transaction_data['From Bank'] || r.transaction_data.from_bank || '',
      from_account: r.transaction_data['Account'] || r.transaction_data.from_account || '',
      to_bank: r.transaction_data['To Bank'] || r.transaction_data.to_bank || '',
      to_account: r.transaction_data['Account.1'] || r.transaction_data.to_account || '',
      amount_received: parseFloat(r.transaction_data['Amount Received']) || 0,
      receiving_currency: r.transaction_data['Receiving Currency'] || '',
      amount_paid: parseFloat(r.transaction_data['Amount Paid']) || 0,
      payment_currency: r.transaction_data['Payment Currency'] || '',
      payment_format: r.transaction_data['Payment Format'] || '',
      risk_score: r.risk_score,
      isolation_forest_score: r.isolation_forest_score,
      autoencoder_score: r.autoencoder_score,
      reconstruction_error: r.reconstruction_error,
      risk_level: r.risk_level,
      is_flagged: r.is_flagged,
      fraud_category: r.fraud_category,
      shap_values: r.shap_values || {},
      shap_chart: r.shap_chart || '',
      row_index: r.index
    }));

    // Bulk insert (in batches of 1000)
    const BATCH_SIZE = 1000;
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      await Transaction.insertMany(transactions.slice(i, i + BATCH_SIZE), { ordered: false });
    }

    // Build financial entities for graph analysis
    const entityMap = {};
    for (const t of transactions) {
      if (t.from_account) {
        if (!entityMap[t.from_account]) {
          entityMap[t.from_account] = {
            account_id: t.from_account,
            bank_id: t.from_bank,
            upload_id: uploadRecord._id,
            user_id: req.user.id,
            total_sent: 0,
            total_received: 0,
            transaction_count: 0,
            flagged_count: 0,
            max_risk_score: 0,
            connections: []
          };
        }
        entityMap[t.from_account].total_sent += t.amount_paid;
        entityMap[t.from_account].transaction_count++;
        if (t.is_flagged) entityMap[t.from_account].flagged_count++;
        if (t.risk_score > entityMap[t.from_account].max_risk_score) {
          entityMap[t.from_account].max_risk_score = t.risk_score;
        }
        if (t.to_account && !entityMap[t.from_account].connections.includes(t.to_account)) {
          entityMap[t.from_account].connections.push(t.to_account);
        }
      }
    }

    const entities = Object.values(entityMap);
    if (entities.length > 0) {
      await FinancialEntity.insertMany(entities, { ordered: false });
    }

    // Update upload record
    const summary = aiResults.summary;
    await Upload.findByIdAndUpdate(uploadRecord._id, {
      status: 'completed',
      total_transactions: summary.total_transactions,
      flagged_count: summary.flagged,
      legitimate_count: summary.legitimate,
      critical_count: summary.critical_count,
      high_count: summary.high_count,
      medium_count: summary.medium_count,
      low_count: summary.low_count,
      avg_risk_score: summary.avg_risk_score,
      max_risk_score: summary.max_risk_score,
      processing_time_ms: Date.now() - startTime,
      completed_at: new Date()
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'ANALYSIS_COMPLETE',
      details: `Analysis complete: ${summary.flagged} flagged / ${summary.total_transactions} total`,
      upload_id: uploadRecord._id.toString(),
      created_at: new Date().toISOString()
    });

    // Clean up temp file
    try { fs.unlinkSync(req.file.path); } catch (e) {}

    res.json({
      success: true,
      upload_id: uploadRecord._id,
      summary,
      processing_time_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('Analysis error:', error.message);

    await Upload.findByIdAndUpdate(uploadRecord._id, {
      status: 'failed',
      error_message: error.message
    });

    try { fs.unlinkSync(req.file.path); } catch (e) {}

    res.status(500).json({
      error: 'AI analysis failed',
      details: error.message,
      upload_id: uploadRecord._id
    });
  }
});

// GET /api/upload/history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { user_id: req.user.id };
    const uploads = await Upload.find(query).sort({ created_at: -1 }).limit(50);
    res.json({ uploads });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
