const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware to verify JWT
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    // Get user role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', data.user.id)
      .single();

    const role = profile?.role || 'auditor';

    // Create our JWT
    const token = jwt.sign(
      {
        id: data.user.id,
        email: data.user.email,
        role: role,
        full_name: profile?.full_name || email
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Log to Supabase audit table
    await supabase.from('audit_logs').insert({
      user_id: data.user.id,
      action: 'LOGIN',
      details: `User logged in from ${req.ip}`,
      created_at: new Date().toISOString()
    });

    res.json({
      success: true,
      token,
      user: {
        id: data.user.id,
        email: data.user.email,
        role,
        full_name: profile?.full_name || email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/register (Admin creates auditors)
router.post('/register', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create accounts' });
    }

    const { email, password, full_name, role = 'auditor' } = req.body;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });

    if (error) return res.status(400).json({ error: error.message });

    // Create profile
    await supabase.from('profiles').insert({
      id: data.user.id,
      email,
      full_name,
      role
    });

    res.json({ success: true, message: `User ${email} created with role ${role}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'LOGOUT',
      details: 'User logged out',
      created_at: new Date().toISOString()
    });
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    res.json({ success: true });
  }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
