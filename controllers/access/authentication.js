const { Pool } = require('pg');
const dbConfig = require('../../config/config'); // Adjust the path to your database connection

const pool = new Pool(dbConfig); // Use the configuration to create the pool

exports.handleAuth = async (req) => {
    const client = await pool.connect();
    if (req.session === undefined) {
        return false;
    }
    const resultUser = await client.query('SELECT * FROM users WHERE token = $1', [req.session.token]);
    client.release();
    if (resultUser.rows[0]) {
        return true;
    } else {
        return false;
    }
};