// ================================================================
//  routes/posts.js — Garbage posts CRUD + driver actions
// ================================================================
'use strict';

const express = require('express');
const db      = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();
// All routes require a valid token
router.use(verifyToken);

// ================================================================
//  CLIENT — POST /api/posts       Create a garbage request
// ================================================================
router.post('/', requireRole('client'), async (req, res) => {
  try {
    const {
      waste_type, weight_range, location,
      description, pickup_date, time_slot, urgency
    } = req.body;

    if (!waste_type || !weight_range || !location || !description || !pickup_date || !time_slot) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO garbage_posts
         (client_id, waste_type, weight_range, location,
          description, pickup_date, time_slot, urgency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, waste_type, weight_range,
        location, description, pickup_date,
        time_slot, urgency || 'Medium'
      ]
    );

    const [rows] = await db.query('SELECT * FROM garbage_posts WHERE id = ?', [result.insertId]);
    return res.status(201).json({ success: true, message: 'Post created.', post: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ================================================================
//  CLIENT — GET /api/posts/mine   My own posts
// ================================================================
router.get('/mine', requireRole('client'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT gp.*,
              u.full_name AS driver_name, u.phone AS driver_phone
       FROM garbage_posts gp
       LEFT JOIN users u ON gp.driver_id = u.id
       WHERE gp.client_id = ?
       ORDER BY gp.created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, posts: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ================================================================
//  CLIENT — DELETE /api/posts/:id   Cancel a pending post
// ================================================================
router.delete('/:id', requireRole('client'), async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM garbage_posts WHERE id = ? AND client_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }
    if (rows[0].status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only Pending posts can be cancelled.' });
    }
    await db.query('DELETE FROM garbage_posts WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Post cancelled.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ================================================================
//  DRIVER — GET /api/posts/available   All pending jobs
// ================================================================
router.get('/available', requireRole('driver'), async (req, res) => {
  try {
    const { type, urgency } = req.query;
    let sql = `
      SELECT gp.*, u.full_name AS client_name, u.phone AS client_phone
      FROM garbage_posts gp
      JOIN users u ON gp.client_id = u.id
      WHERE gp.status = 'Pending'`;
    const params = [];

    if (type && type !== 'all') {
      sql += ' AND gp.waste_type = ?';
      params.push(type);
    }
    if (urgency && urgency !== 'all') {
      sql += ' AND gp.urgency = ?';
      params.push(urgency);
    }
    sql += ' ORDER BY FIELD(gp.urgency,"High","Medium","Low"), gp.created_at DESC';

    const [rows] = await db.query(sql, params);
    return res.json({ success: true, posts: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ================================================================
//  DRIVER — GET /api/posts/myjobs   Jobs accepted by this driver
// ================================================================
router.get('/myjobs', requireRole('driver'), async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT gp.*, u.full_name AS client_name, u.phone AS client_phone
      FROM garbage_posts gp
      JOIN users u ON gp.client_id = u.id
      WHERE gp.driver_id = ?`;
    const params = [req.user.id];

    if (status && status !== 'all') {
      sql += ' AND gp.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY gp.created_at DESC';

    const [rows] = await db.query(sql, params);
    return res.json({ success: true, posts: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ================================================================
//  DRIVER — PATCH /api/posts/:id/accept
// ================================================================
router.patch('/:id/accept', requireRole('driver'), async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM garbage_posts WHERE id = ? AND status = "Pending"',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(409).json({ success: false, message: 'Job not available (already taken or does not exist).' });
    }
    await db.query(
      `UPDATE garbage_posts
       SET status='Accepted', driver_id=?, accepted_at=NOW()
       WHERE id=? AND status='Pending'`,
      [req.user.id, req.params.id]
    );
    return res.json({ success: true, message: 'Job accepted.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ================================================================
//  DRIVER — PATCH /api/posts/:id/collect
// ================================================================
router.patch('/:id/collect', requireRole('driver'), async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM garbage_posts WHERE id = ? AND driver_id = ? AND status = "Accepted"',
      [req.params.id, req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Job not found or not in Accepted state.' });
    }
    await db.query(
      `UPDATE garbage_posts SET status='Collected', collected_at=NOW() WHERE id=?`,
      [req.params.id]
    );
    return res.json({ success: true, message: 'Marked as collected.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ================================================================
//  DRIVER — PATCH /api/posts/:id/send-to-facility
// ================================================================
router.patch('/:id/send-to-facility', requireRole('driver'), async (req, res) => {
  try {
    const { facility_name, driver_notes, starting_bid } = req.body;
    if (!facility_name || !starting_bid) {
      return res.status(400).json({ success: false, message: 'Facility name and starting bid are required.' });
    }

    const [rows] = await db.query(
      'SELECT * FROM garbage_posts WHERE id = ? AND driver_id = ? AND status = "Collected"',
      [req.params.id, req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Job not found or not yet collected.' });
    }

    await db.query(
      `UPDATE garbage_posts
       SET status='At Facility', facility_name=?, driver_notes=?,
           starting_bid=?, sent_at=NOW()
       WHERE id=?`,
      [facility_name, driver_notes || null, starting_bid, req.params.id]
    );
    return res.json({ success: true, message: 'Sent to facility.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ================================================================
//  FACILITY — GET /api/posts/facility  All posts At Facility
// ================================================================
router.get('/facility', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT gp.*,
              c.full_name AS client_name,
              d.full_name AS driver_name, d.vehicle AS driver_vehicle
       FROM garbage_posts gp
       JOIN users c ON gp.client_id = c.id
       LEFT JOIN users d ON gp.driver_id = d.id
       WHERE gp.status IN ('At Facility','Completed')
         OR gp.bid_winner IS NOT NULL
       ORDER BY gp.sent_at DESC`
    );
    return res.json({ success: true, posts: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ================================================================
//  FACILITY — PATCH /api/posts/:id/bid   Place winning bid
// ================================================================
router.patch('/:id/bid', async (req, res) => {
  try {
    const { bid_winner, winning_bid } = req.body;
    if (!bid_winner || !winning_bid) {
      return res.status(400).json({ success: false, message: 'Bid winner and amount are required.' });
    }

    const [rows] = await db.query(
      'SELECT * FROM garbage_posts WHERE id = ? AND status = "At Facility" AND bid_winner IS NULL',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Post not available for bidding.' });
    }

    await db.query(
      `UPDATE garbage_posts
       SET status='Completed', bid_winner=?, winning_bid=?, completed_at=NOW()
       WHERE id=?`,
      [bid_winner, winning_bid, req.params.id]
    );
    return res.json({ success: true, message: 'Bid placed successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
