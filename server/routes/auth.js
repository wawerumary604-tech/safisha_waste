// ================================================================
//  routes/auth.js — Registration & Login
// ================================================================
'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../db');

const router = express.Router();
const SALT_ROUNDS = 10;

// ----------------------------------------------------------------
// Helper — sign a JWT
// ----------------------------------------------------------------
function signToken(user) {
  return jwt.sign(
    {
      id:    user.id,
      role:  user.role,
      email: user.email,
      name:  user.full_name
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ----------------------------------------------------------------
// Helper — safe user object (no password)
// ----------------------------------------------------------------
function safeUser(row) {
  const { password, ...rest } = row;
  return rest;
}

// ================================================================
//  POST /api/auth/register
// ================================================================
router.post('/register', async (req, res) => {
  try {
    const {
      role, full_name, email, phone,
      location, password,
      vehicle, license
    } = req.body;

    // ---- Validation ----
    if (!role || !['client', 'driver'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be "client" or "driver".' });
    }
    if (!full_name || !email || !phone || !location || !password) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (role === 'driver' && (!vehicle || !license)) {
      return res.status(400).json({ success: false, message: 'Drivers must provide vehicle type and license plate.' });
    }

    // ---- Check duplicate email ----
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email is already registered.' });
    }

    // ---- Hash password ----
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // ---- Insert user ----
    const [result] = await db.query(
      `INSERT INTO users
         (role, full_name, email, phone, location, password, vehicle, license)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        role,
        full_name.trim(),
        email.trim().toLowerCase(),
        phone.trim(),
        location.trim(),
        hashedPassword,
        role === 'driver' ? vehicle.trim() : null,
        role === 'driver' ? license.trim() : null
      ]
    );

    // ---- Fetch back the new user ----
    const [rows] = await db.query(
      'SELECT * FROM users WHERE id = ?',
      [result.insertId]
    );
    const user  = rows[0];
    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: safeUser(user)
    });

  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ================================================================
//  POST /api/auth/login
// ================================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Email, password and role are required.' });
    }

    // ---- Find user ----
    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ? AND role = ? AND is_active = 1',
      [email.trim().toLowerCase(), role]
    );

    if (rows.length === 0) {
      // Generic message — don't reveal whether email or role is wrong
      return res.status(401).json({ success: false, message: 'Invalid email, password, or role.' });
    }

    const user = rows[0];

    // ---- Compare password ----
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email, password, or role.' });
    }

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.full_name}!`,
      token,
      user: safeUser(user)
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ================================================================
//  GET /api/auth/me  — verify token & return current user
// ================================================================
const { verifyToken } = require('../middleware/auth');

router.get('/me', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE id = ? AND is_active = 1',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, user: safeUser(rows[0]) });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
