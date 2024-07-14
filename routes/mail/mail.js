
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const dbConfig = require('../../config/config'); // Adjust the path to your database connection

const pool = new Pool(dbConfig); // Use the configuration to create the pool

router.get('/verify', async (req, res) => {
    const client = await pool.connect();
    const { token } = req.query;
    // Assuming you store the token in the session when the user registers
    if (req.session.token && req.session.token === token) {
      req.session.emailVerified = true;
      await client.query('UPDATE users SET confirmed = true WHERE token = $1', [req.session.token]);
      res.send('Email verified successfully!');
    } else {
      res.send('Invalid token or token expired');
    }
    client.release();
});