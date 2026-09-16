const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');
const { Transaction, Upload } = require('../models/Transaction');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/admin/users
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ users: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'auditor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', req.params.id);

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'USER_ROLE_CHANGED',
      details: `Changed user ${req.params.id} role to ${role}`,
      created_at: new Date().toISOString()
    });

    res.json({ success: true, message: `Role updated to ${role}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { error } = await supabase.auth.admin.deleteUser(req.params.id);
    if (error) throw error;

    await supabase.from('profiles').delete().eq('id', req.params.id);

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/logs
router.get('/logs', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const from = (parseInt(page) - 1) * parseInt(limit);
    const to = from + parseInt(limit) - 1;

    const { data, count, error } = await supabase
      .from('audit_logs')
      .select('*, profiles(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    res.json({
      logs: data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/system-stats
router.get('/system-stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [totalUploads, totalTransactions, totalFlagged] = await Promise.all([
      Upload.countDocuments(),
      Transaction.countDocuments(),
      Transaction.countDocuments({ is_flagged: true })
    ]);

    const { data: userCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    res.json({
      total_uploads: totalUploads,
      total_transactions: totalTransactions,
      total_flagged: totalFlagged,
      total_users: userCount,
      flag_rate: totalTransactions
        ? ((totalFlagged / totalTransactions) * 100).toFixed(2) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
