// ================================================================
//  index.js — Safisha API Server
// ================================================================
'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: '*',            // tighten in production
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve static front-end files ─────────────────────────────
// The HTML/CSS/JS files sit one level up from /server
app.use(express.static(path.join(__dirname, '..')));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  // If the request is for an API route return JSON, else serve index.html
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Route not found.' });
  }
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Global error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀  Safisha server running → http://localhost:${PORT}`);
});
