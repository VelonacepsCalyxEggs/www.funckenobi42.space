const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
      // Clear the cookie
      res.clearCookie('connect.username'); // 'connect.sid' is the default name for the session ID cookie
      // Redirect to the login page or home page
      res.redirect('/');
    });
  });

module.exports = router;