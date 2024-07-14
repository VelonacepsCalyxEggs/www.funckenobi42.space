const { Pool } = require('pg');
const dbConfig = require('../../config/config'); // Adjust the path to your database connection

const pool = new Pool(dbConfig); // Use the configuration to create the pool

exports.getProfile = async (username) =>  {
    const client = await pool.connect();
    const resultUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    client.release();
    if (resultUser.rows[0]) {
      return resultUser.rows[0];
    } else {
      return false;
    }
}