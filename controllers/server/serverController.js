const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);
const session = require('../../config/sessionConfig'); // Import the configuration
const rateLimit = require('express-rate-limit');
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Define the rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 256 // limit each IP to 100 requests per windowMs
});
app.set('trust proxy', 1);
app.use(apiLimiter);
// logging
const logUserActivity = (req, res, next) => {
  res.on('finish', () => { // this will be called after the response is sent
    try {
      const logEntryInitial = `Time: ${new Date().toISOString()}, Method: ${req.method}, URL: ${req.originalUrl}, Status: ${res.statusCode}, User-Agent: ${req.get('User-Agent')}`;
      const logEntryEnd = `Username: ${req.session.username}, Status: ${req.session.emailVerified}, Hostname: ${req.hostname}, Path: ${req.path}, IP: ${req.ip}`
      console.log(logEntryInitial + '\n' + logEntryEnd);
    }
    catch {
      console.log(`Time: ${new Date().toISOString()}, An error occured while logging IP: ${req.ip}`)
    }
  });
  next();
}; 

app.use(logUserActivity)

app.use(session); // Use the session middleware

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));

// Parse JSON bodies (as sent by API clients)
app.use(express.json());

module.exports = { app, server };