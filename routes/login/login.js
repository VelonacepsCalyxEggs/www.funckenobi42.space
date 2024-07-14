const express = require('express');
const router = express.Router();
const loginHandlers = require('../../controllers/access/loginHandler')
// Login route
router.get('/', loginHandlers.handleLogin);
router.post('/', loginHandlers.handleLogin);

module.exports = router;