const express = require('express');
const router = express.Router();
const registerHandlers = require('../../controllers/access/registerHandler')
// Register route
router.get('/', registerHandlers.handleRegister);
router.post('/', registerHandlers.handleRegister);

module.exports = router;