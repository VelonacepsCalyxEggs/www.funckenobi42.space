const { Pool } = require('pg');
const dbConfig = require('../../config/config'); // Adjust the path to your database connection
const crypto = require('crypto');
const cryptographyController = require('../../controllers/cryptography/cryptographyController');
const mailController = require('../../controllers/mail/mailController');

const pool = new Pool(dbConfig); // Use the configuration to create the pool

exports.handleRegister = async (req, res) => {
    message = '';
    if (req.method === "POST") {
      const client = await pool.connect();
      var { email, username, password, password_retried } = req.body;
      if (email && username && password && password_retried) {
        
        if (username.length <= 16) {
           
          if (password === password_retried) {
            if (password.length >= 8) {
                const queryData1 = await client.query('SELECT * FROM users WHERE email = $1', [email]);
                const queryData2 = await client.query('SELECT * FROM users WHERE username = $1', [username]);
                if (queryData1.rows.length == 0 && queryData2.rows.length == 0) {
                    const token = cryptographyController.generateToken();
                    req.session.token = token; // Store token in session
                    req.session.emailVerified = false; // Set email verification status
                    await mailController.sendVerificationEmail(email, token);
                    const iterations = 100000; // Recommended to be as high as possible
                    const keylen = 64; // Length of the derived key
                    const digest = 'sha512'; // More secure hashing algorithm
                    const salt = crypto.randomBytes(16).toString('hex');
                    password = await cryptographyController.hashPassword(password, salt, iterations, keylen, digest);
                    await client.query('INSERT INTO users(username, email, password, token, salt) VALUES ($1, $2, $3, $4, $5)', [username, email, password, token, salt]);
                    client.release() 
                    req.session.messages = 'Please verify your email. Look in spam btw... I hate my bootleg smtp.';     
                    return res.redirect('/login'); // Redirect to login page
              } else {message = "There is already an account with this username."}
            } else {message = "The password must be equal or more than 8 characters long."}
          } else {message = "Passwords don't match."}
        } else {message = "Username must be equal or less than 16 characters."}
      }else {message = "Invalid password or username."}
        return res.render('register', {messages: message});
    }
      
    res.render('register', {messages: message});
}