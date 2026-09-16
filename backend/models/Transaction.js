const mongoose = require('mongoose');

// Individual transaction schema
const TransactionSchema = new mongoose.Schema({
  // Upload reference
  upload_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Upload', required: true },
  user_id: { type: String, required: true },

  // Original IBM AML fields
  timestamp: { type: Date },
  from_bank: { type: String, index: true },
  from_account: { type: String, index: true },
  to_bank: { type: String, index: true },
  to_account: { type: String, index: true },
  amount_received: { type: Number },
  receiving_currency: { type: String },
  amount_paid: { type: Number },
  payment_currency: { type: String },
  payment_format: { type: String },

  // AI Results
  risk_score: { type: Number, default: 0 },
  isolation_forest_score: { type: Number, default: 0 },
  autoencoder_score: { type: Number, default: 0 },
  reconstruction_error: { type: Number, default: 0 },
  risk_level: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW'
  },
  is_flagged: { type: Boolean, default: false },
  fraud_category: { type: String, default: 'Normal' },

  // SHAP
  shap_values: { type: Map, of: Number },
  shap_chart: { type: String }, // base64 PNG

  // Row index in original file
  row_index: { type: Number },

  // Timestamps
  created_at: { type: Date, default: Date.now }
}, {
  // Compound indexes for graph traversal
  indexes: [
    { from_account: 1, to_account: 1 },
    { upload_id: 1, is_flagged: 1 },
    { upload_id: 1, risk_score: -1 }
  ]
});

// Upload batch schema
const UploadSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  filename: { type: String, required: true },
  original_filename: { type: String },
  file_size_bytes: { type: Number },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  total_transactions: { type: Number, default: 0 },
  flagged_count: { type: Number, default: 0 },
  legitimate_count: { type: Number, default: 0 },
  critical_count: { type: Number, default: 0 },
  high_count: { type: Number, default: 0 },
  medium_count: { type: Number, default: 0 },
  low_count: { type: Number, default: 0 },
  avg_risk_score: { type: Number, default: 0 },
  max_risk_score: { type: Number, default: 0 },
  processing_time_ms: { type: Number },
  error_message: { type: String },
  created_at: { type: Date, default: Date.now },
  completed_at: { type: Date }
});

// Financial entity schema for graph analysis
const FinancialEntitySchema = new mongoose.Schema({
  account_id: { type: String, required: true, index: true },
  bank_id: { type: String },
  upload_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Upload' },
  user_id: { type: String },
  total_sent: { type: Number, default: 0 },
  total_received: { type: Number, default: 0 },
  transaction_count: { type: Number, default: 0 },
  flagged_count: { type: Number, default: 0 },
  max_risk_score: { type: Number, default: 0 },
  // For $graphLookup — array of connected accounts
  connections: [{ type: String }],
  created_at: { type: Date, default: Date.now }
});

module.exports = {
  Transaction: mongoose.model('Transaction', TransactionSchema),
  Upload: mongoose.model('Upload', UploadSchema),
  FinancialEntity: mongoose.model('FinancialEntity', FinancialEntitySchema)
};
