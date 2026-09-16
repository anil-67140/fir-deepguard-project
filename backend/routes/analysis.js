const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');
const { Transaction, Upload } = require('../models/Transaction');

// GET /api/analysis/:upload_id — get all transactions for an upload
router.get('/:upload_id', authMiddleware, async (req, res) => {
  try {
    const { upload_id } = req.params;
    const { page = 1, limit = 50, flagged_only, risk_level, sort = 'risk_score' } = req.query;

    const upload = await Upload.findById(upload_id);
    if (!upload) return res.status(404).json({ error: 'Upload not found' });
    if (req.user.role !== 'admin' && upload.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filter = { upload_id };
    if (flagged_only === 'true') filter.is_flagged = true;
    if (risk_level) filter.risk_level = risk_level;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = sort === 'risk_score' ? { risk_score: -1 } : { created_at: -1 };

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-shap_chart'), // Exclude heavy base64 from list view
      Transaction.countDocuments(filter)
    ]);

    res.json({
      upload,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/analysis/:upload_id/transaction/:tx_id — single transaction with SHAP
router.get('/:upload_id/transaction/:tx_id', authMiddleware, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.tx_id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ transaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/analysis/:upload_id/stats — summary statistics
router.get('/:upload_id/stats', authMiddleware, async (req, res) => {
  try {
    const { upload_id } = req.params;

    const [upload, riskDist, paymentFormats, topFlagged] = await Promise.all([
      Upload.findById(upload_id),

      // Risk level distribution
      Transaction.aggregate([
        { $match: { upload_id: require('mongoose').Types.ObjectId(upload_id) } },
        { $group: { _id: '$risk_level', count: { $sum: 1 } } }
      ]),

      // Payment format distribution for flagged
      Transaction.aggregate([
        { $match: { upload_id: require('mongoose').Types.ObjectId(upload_id), is_flagged: true } },
        { $group: { _id: '$payment_format', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Top 10 highest risk transactions
      Transaction.find({ upload_id, is_flagged: true })
        .sort({ risk_score: -1 })
        .limit(10)
        .select('row_index risk_score risk_level fraud_category from_account to_account amount_paid')
    ]);

    res.json({
      upload,
      risk_distribution: riskDist,
      payment_formats: paymentFormats,
      top_flagged: topFlagged
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
