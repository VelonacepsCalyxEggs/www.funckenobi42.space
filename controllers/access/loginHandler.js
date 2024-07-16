const { Pool } = require('pg');
const dbConfig = require('../../config/config'); // Adjust the path to your database connection
const cryptographyController = require('../../controllers/cryptography/cryptographyController');

const pool = new Pool(dbConfig); // Use the configuration to create the pool

exports.handleLogin = async (req, res) => {
    var message = req.session.messages;
    delete req.session.messages; // Clear the message so it doesn't persist
    if (req.method === "POST") {
        var { email, password } = req.body;
        const client = await pool.connect();
        const iterations = 100000; // Recommended to be as high as possible
        const keylen = 64; // Length of the derived key
        const digest = 'sha512'; // More secure hashing algorithm
        let salt = await client.query('SELECT salt FROM users WHERE email = $1', [email]);
        salt = salt.rows[0];
        try {
        salt = salt["salt"]
        }
        catch(error) {
          console.log('Man with no salt.')
        }

        try {
        // Query user from the database
        const resultUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = resultUser.rows[0];
  
        // Compare submitted password with the stored hash
        if (user) {
          if (user["confirmed"] == true) {
            if (salt != undefined) {
              password = await cryptographyController.hashPassword(password, salt, iterations, keylen, digest);
              if (user["password"] === password) {
                

                  req.session.username = user["username"]; // Set user session
                  const token = await cryptographyController.generateToken();
                  console.log(token)
                  req.session.token = token;
                  req.session.userId = user['id']
                  console.log(user['id'])
                  await client.query('UPDATE users SET token = $1 WHERE id = $2;', [token, user["id"]]);
                  console.log(req.session.token)
                  return res.redirect('/'); // Redirect to user dashboard
                } else {message = "Invalid email or password"}
              } else {message = "Invalid email or password"}
            } else {message = "Please verify your account."}
          } else {message = "Invalid email or password";}
          res.render('login', {messages: message});
        } finally {
        client.release(); // Release the client back to the pool
        }
    } else {
        res.render('login', {messages: message});
      }
}