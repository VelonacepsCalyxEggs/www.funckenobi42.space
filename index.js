const express = require('express');
const app = express();
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { error } = require('console');
const { Worker, parentPort } = require('worker_threads');
const http = require('http');
const server = http.createServer(app);
const WebSocket = require('ws');
const fs = require('fs');
const { user } = require('pg/lib/defaults');
const config = require('./config/config'); // Import the configuration
const config_radio = require('./config/configRadio'); // Import the configuration
const config_nodemailer = require('./config/nodemailerConfig'); // Import the configuration
const session = require('./config/sessionConfig'); // Import the configuration

app.set('view engine', 'ejs');

const pool = new Pool(config); // Use the configuration to create the pool
const pool_radio = new Pool(config_radio);
const transporter = nodemailer.createTransport(config_nodemailer); // Use the configuration to create the transporter

app.use(express.static('public'));

app.use(session); // Use the session middleware

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));

// Parse JSON bodies (as sent by API clients)
app.use(express.json());

const worker = new Worker('./radio_api.js')
radioCheck = 0;
worker.postMessage({ action: 'connect' });

// this function verifies if the user is actually who he is.
async function handleAuth(req) {
    const client = await pool.connect();
    const resultUser = await client.query('SELECT * FROM users WHERE token = $1', [req.session.token]);
    client.release();
    if (resultUser.rows[0]) {
      return true
    } else {
      return false
    }
}

app.get('/', (req, res) => {
    if (req.session.token) {
        if(handleAuth(req)) {
          res.render('index', { username: req.session.username });
          console.log('42')
        }
        else {
          res.send('invalid token')
        }
      } else {
        res.render('index', { username: 'Stranger' });
      }
});

app.get('/about', (req, res) => {
  if (req.session.token) {
      if(handleAuth(req)) {
        res.render('about', { username: req.session.username });
        console.log('42')
      }
      else {
        res.send('invalid token')
      }
    } else {
      res.render('about', { username: 'Stranger' });
    }
});

app.get('/tos', (req, res) => {
  if (req.session.token) {
      if(handleAuth(req)) {
        res.render('tos', { username: req.session.username });
        console.log('42')
      }
      else {
        res.send('invalid token')
      }
    } else {
      res.render('tos', { username: 'Stranger' });
    }
});

async function hashPassword(password) {
    const hash = crypto.createHash('sha256');
    hash.update(password);
    return hash.digest('hex');
  }
function encodeName(name) {
    const encodedName = Buffer.from(name, 'utf-8').toString('base64');
    return encodedName;
  }

function generateToken() {
return crypto.randomBytes(20).toString('hex');
}

// Login handler
async function handleLogin(req, res) {
    console.log(`Received request with method: ${req.method}`); // Log the request method
    message = '';
    if (req.method === "POST") {
        var { email, password } = req.body;
        password = await hashPassword(password);
        const client = await pool.connect();
        try {
        // Query user from the database
        const resultUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = resultUser.rows[0];
  
        // Compare submitted password with the stored hash
        console.log(user)
        if (user) {
          if (user["confirmed"] == true) {
            if (user["password"] === password) {

                console.log(user["username"]);
                req.session.username = user["username"]; // Set user session
                console.log('logged in')
                const token = generateToken();
                req.session.token = token;
                await client.query('UPDATE users SET token = $1 WHERE id = $2;', [token, user[0]]);
                return res.redirect('/'); // Redirect to user dashboard
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

  
// Login route
  app.get('/login', handleLogin);
  app.post('/login', handleLogin);

  app.get('/logout', (req, res) => {
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

  async function sendVerificationEmail(email, token) {
    const verificationUrl = `http://www.funckenobi42.space/verify?token=${token}`;
  
    const mailOptions = {
      from: 'support@funckenobi42.space',
      to: email,
      subject: 'Please confirm your email',
      text: `Verify your account here: ${verificationUrl}`
    };
  
    try {
      await transporter.sendMail(mailOptions);
      console.log('Verification email sent');
    } catch (error) {
      console.error('Error sending verification email', error);
    }
  }
  
  // Route to handle email verification
  app.get('/verify', async (req, res) => {
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
  
  app.get('/register', handleRegister);
  app.post('/register', handleRegister);

  async function handleRegister(req, res) {
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
                    const token = generateToken();
                    req.session.token = token; // Store token in session
                    req.session.emailVerified = false; // Set email verification status
                    await sendVerificationEmail(email, token);
                    password = await hashPassword(password); // Await the hashed password
                    await client.query('INSERT INTO users(username, email, password, token) VALUES ($1, $2, $3, $4)', [username, email, password, token]);
                    console.log('registered successfully');
                    client.release()                 
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

app.get('/anyaupload', (req, res) => {
  return res.render('upload')
  });
app.route('/anyaupload').post((req, res) => {
  req.pipe(req.busboy); // Pipe it through busboy
  req.busboy.on('file', (fieldname, file, filename) => {
    console.log(`Upload of '${filename}' started '${fieldname}'`);
    // Create a write stream of the new file
    const fstream = fs.createWriteStream('C:/Server/nodeJSweb/public/files/42.mkv');
    // Pipe it through
    file.pipe(fstream);
    // On finish of the upload
    fstream.on('close', () => {
      console.log(`Upload of '${filename}' finished`);
      res.redirect('back');
    });
  });
});
  

//radio related stuff
const wss = new WebSocket.Server({ server });

async function getSong(id) {
      const client = await pool_radio.connect();

      const resultSong = await client.query('SELECT * FROM music WHERE id = $1', [id]);
      const song = resultSong.rows;

      client.release(); // Release the client back to the pool

      return song;
    }

worker.on('message', async (message) => {
  try {
    console.log('Received data from worker:', message);
    const song = await getSong(message);
    console.log(song);
    global.currentSong = song;

    // Broadcast the updated song data to all connected clients
    wss.clients.forEach((client) => {
      client.send(JSON.stringify(global.currentSong));
    });
  } catch (error) {
    console.error('Error fetching song:', error);
  }
});

worker.postMessage('Request data from TCP socket');

wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket');

  // Send initial data (optional)
  ws.send(JSON.stringify(global.currentSong));
  console.log(global.currentSong + ' was sent to client')

  // Simulate sending data periodically (replace with your logic)

  // Handle incoming messages from the client
  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
  });
});

server.listen(55064, () => {
  console.log('Express server with WebSocket listening on port 55064');
});

app.get('/radio', (req, res) => {
  if (req.session.username) {
    // Assuming 'userId' is the user's name stored in the session
    res.render('radio', { username: req.session.username });
  } else {
    res.render('radio', { username: 'Stranger' });
  }
});

app.get('/radio/music', async (req, res) => {
  if (req.session.username) {
    try {
      var currentPage = req.query.p;
      var SessionFilter = req.query.f;
      req.session.musicFilter = SessionFilter;
      filter = req.session.musicFilter
      filterQuery = filter;
      console.log(filter)
      if (currentPage == undefined || currentPage <= 0) {
        currentPage = 1;
      }
      const pageSize = 6; // Number of records per page
      const offset = (currentPage - 1) * pageSize;
      
      const radioSql = await pool_radio.connect();
      const queryDataLength = await radioSql.query(`SELECT max(id) FROM music`);
      console.log(queryDataLength.rows[0])
      var maxPages = (queryDataLength.rows[0]["max"]) / 6;
      if (filter == undefined) {
        console.log('No filter')
        queryData1 = await radioSql.query(`SELECT * FROM music LIMIT ${pageSize} OFFSET ${offset}`);
      } else {
        if (filter == 'album') {
          console.log('Album filter')
          queryData1 = await radioSql.query(`SELECT DISTINCT album FROM music`);
          maxPages = 1;
        }
        else if (filter == 'id') {
          console.log('Id filter')
          queryData1 = await radioSql.query(`SELECT * FROM music LIMIT ${pageSize} OFFSET ${offset}`);
        }
        else {
          console.log('what?')
          queryData1 = await radioSql.query(`SELECT * FROM music LIMIT ${pageSize} OFFSET ${offset}`);
        }
        filterQuery = `&f=${filter}`
      }     
      radioSql.release();

      let htmlString = ''; // Initialize an empty string

      // Iterate through each song in the music list
      if (filter == 'album') {
        queryData1.rows.forEach((song) => {
          href = encodeName(String(song.album));
          htmlString += `
            <div>
              <a class="nav-link" href="music/${href}">${song.album}</a>
            </div>
          `;
        });
      }
      else {
      queryData1.rows.forEach((song) => {

        htmlString += `
          <div>
            <a class="nav-link" href="music/${song.id}">${song.name}<button>+</button></a>
            <p>Author: ${song.author}</p>
            <p>Album: ${song.album}</p>
            <!-- Add other relevant properties here -->
          </div>
        `;
      });
    }
      // Render the 'music' template with username and music data
      res.render('music', { username: req.session.username, music: htmlString, forward: parseInt(currentPage) + 1, back: parseInt(currentPage) - 1, filter: filterQuery, pages: `${currentPage} out of ${maxPages}`});
    } catch (error) {
      console.error('Error fetching music data:', error);
      res.status(500).send('Internal server error');
    }
  } else {
    // Redirect if user is not logged in
    return res.redirect('back');
  }
});

app.get('/radio/music/:userQuery', async (req, res) => {
  const userQuery = req.params.userQuery;
  const radioSql = await pool_radio.connect();
  if (String(userQuery.length) > 4) {
      const decodedQuery = Buffer.from(userQuery, 'base64').toString('utf-8');
      queryAlbum = await radioSql.query(`SELECT * FROM music WHERE album = $1`, [decodedQuery]);
      var htmlString = '';
      queryAlbum.rows.forEach((song) => {

        htmlString += `
          <div>
            <a class="nav-link" href="${song.id}">${song.name}<button>+</button></a>
            <p>Author: ${song.author}</p>
            <!-- Add other relevant properties here -->
          </div>
        `;
      });
      res.render('albumDisplay', {username: req.session.username, albumList: htmlString, albumImg: queryAlbum.rows[0]["path_to_cover"], albumName: queryAlbum.rows[0]["album"]})
  } else {
    if (typeof(userQuery) == 'string') { 
    querySong = await radioSql.query(`SELECT * FROM music WHERE id = $1`, [userQuery]);
    } else {
      res.send('invalid argument, if you think this is an error, contact webmaster at contact@funckenobi42.space or func_kenobi in discord. ')
    }
    radioSql.release();
    if (querySong.rows[0]) {
        res.render('songDisplay', {username: req.session.username, songCover: querySong.rows[0]["path_to_cover"], songName: querySong.rows[0]["name"], songAuthor: querySong.rows[0]["author"], songAlbum: querySong.rows[0]["album"], songGenre: querySong.rows[0]["genre"], songMd5: querySong.rows[0]["md5"], songDate: querySong.rows[0]["date_added"] })
    } else {
      res.send('No such song, if this is an error, contact webmaster at contact@funckenobi42.space or func_kenobi in discord.')
    }

  }
});
 
worker.on('message', (currentSong) => {
  console.log('Received data from worker thread in main thread:', currentSong);
  global.currentSong = currentSong // Update the global variable
})


const PORT = process.env.PORT || 42125;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
