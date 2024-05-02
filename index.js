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
const multer = require('multer');
const { body, validationResult } = require('express-validator');

app.set('view engine', 'ejs');

const pool = new Pool(config); // Use the configuration to create the pool
const pool_radio = new Pool(config_radio);
const transporter = nodemailer.createTransport(config_nodemailer); // Use the configuration to create the transporter

app.use(express.static('public'));

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, `C:/Server/nodeJSweb/public/files/user/${req.session.username}`); // Specify the directory where files will be saved
  },
  filename: async (req, file, cb) => {
    // Access the uploaded file using req.file
    const avatarFile = req.file;
    console.log('Uploaded file:', avatarFile);

    // Rest of your code...
    // Save the file path to your database or perform other actions
    const uniqueSuffix = req.session.username;
    const client = await pool.connect();
    await client.query('UPDATE users SET picture = $1 WHERE token = $2', [`files/user/${req.session.username}/${file.fieldname + '-' + uniqueSuffix + '.jpg'}`, req.session.token]);
    client.release();

    cb(null, file.fieldname + '-' + uniqueSuffix + '.jpg'); // Customize the file name
  }});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, callback) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.gif' && ext !== '.jpeg') {
      return callback(null, false);
    }
    fs.mkdir(`C:/Server/nodeJSweb/public/files/user/${req.session.username}`, { recursive: true }, (err) => {
      if (err) {
        return callback(null, false)
      }
      console.log('Folder created successfully!');
    });
    callback(null, true);
  },
  limits: {
    fileSize: 10000000 // Limit file size if needed
  }
}).single('avatar')

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
              res.render('index', {
                username: req.session.username,
                editOptions: `
                <form action="/uploadAvatar" method="POST" enctype="multipart/form-data">
                <input type="file" name="avatar">
                <button type="submit">Upload Avatar</button>
                </form>
              `,
                navbar: `
              <li class="nav-item">
                <a class="nav-link" aria-current="page" href="/">Home</a>
              </li>
              <li class="nav-item" style="font-weight: 300;">
                <a class="nav-link" href="/radio">Radio</a>
              </li>
                `
            });
          }
        else {
          res.send('invalid token')
        }
      } else {
        res.render('index', {
          username: 'Stranger',
          navbar: `
          <li class="nav-item">
          <a class="nav-link" aria-current="page" href="/">Home</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="/radio">Radio</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="/login">Login</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="/register">Register</a>
          </li>
          `
        });
      }
    });


async function getProfile(username) {
  const client = await pool.connect();
  const resultUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);
  client.release();
  if (resultUser.rows[0]) {
    return resultUser.rows[0];
  } else {
    return false;
  }
}

const validateFile = async (req, res, next) => {
  var referrer = req.get('Referer') || 'Unknown';
  console.log(`Referrer: ${referrer}`);
  referrer = String(referrer).split('/')
  const profile = await getProfile(referrer[referrer.length - 1]);
  if (req.session.token === profile["token"]) {
    
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
  const fileExtension = req.file.filename.slice(-4).toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    return res.status(409).send({ message: 'Provide a valid extension [.jpg, .jpeg, .png, .gif.]' });
  }
  const dir = `C:/Server/nodeJSweb/public/files/user/${req.session.username}`
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    console.log(`Created directory: ${dir}`);
  } else {
    console.log(`Directory already exists: ${dir}`);
  }
  const contentLength = req.get('Content-Length');
  const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
  if (contentLength > maxSizeInBytes) {
    return res.status(409).send({ message: 'Your mama too big, max 10 mb.' });
  }
}


  // Validation passed, proceed to the next middleware (Multer)
  next();
};

app.post(
  '/uploadAvatar',
  upload, // Handle the file upload
  async (req, res) => {
  // Handle the uploaded file here
  if (req.file) {
    // File successfully uploaded
    res.status(200).send('File uploaded successfully.');
  } else {
    // No file uploaded or an error occurred
    res.status(400).send('Error uploading file. Please try again.');
  }
});


app.get('/profile/:userProfile', async (req, res) => { // Add 'async' here
const userProfile = req.params.userProfile;
if (userProfile) {
  try {
    const profile = await getProfile(userProfile); // Await the result
    if (profile) {
      console.log(req.session.token)
      console.log(profile["token"])
      if (req.session.token === profile["token"]) {
        res.render('profile', {
          username: req.session.username,
          profileUsername: profile["username"],
          avatar: profile["picture"],
          editOptions: `
          <form action="/uploadAvatar" method="POST" enctype="multipart/form-data">
          <input type="file" name="avatar">
          <button type="submit">Upload Avatar</button>
          </form>
        `,
          navbar: `
        <li class="nav-item">
          <a class="nav-link" aria-current="page" href="/">Home</a>
        </li>
        <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="/radio">Radio</a>
        </li>
        <li class="nav-item" style="font-weight: 300;">
        <a class="nav-link" href="${req.get('Referer')}">Back</a>
        </li>
          
          `
        });
      } else if(req.session.token) {
        res.render('profile', {
          username: req.session.username,
          profileUsername: profile["username"],
          avatar: profile["picture"],
          editOptions: 'This account is not yours',
          navbar: `
          <li class="nav-item">
          <a class="nav-link" aria-current="page" href="/">Home</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="/radio">Radio</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="${req.get('Referer')}">Back</a>
          </li>
          `
        });
      } else {
        res.render('profile', {
          username: 'Stranger',
          profileUsername: profile["username"],
          avatar: profile["picture"],
          editOptions: 'This account is not yours, or is it?',
          navbar: `
          <li class="nav-item">
          <a class="nav-link" aria-current="page" href="/">Home</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="/radio">Radio</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="/login">Radio</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="/register">Radio</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="${req.get('Referer')}">Back</a>
          </li>
          `
        });
      }
    } else {
      res.send('This profile does not exist.');
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).send('Internal server error');
  }
} else {
  res.send('No profile specified.');
}
});



app.get('/about', (req, res) => {
  if (req.session.token) {
      if(handleAuth(req)) {
        res.render('about', {
          username: req.session.username,
          navbar: `
          <li class="nav-item">
          <a class="nav-link" aria-current="page" href="/">Home</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="/radio">Radio</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="${req.get('Referer')}">Back</a>
          </li>
          `
        });
        console.log('42')
      }
      else {
        res.send('invalid token')
      }
    } else {
      res.render('about', {
        username: 'Stranger',
        navbar: `
        <li class="nav-item">
        <a class="nav-link" aria-current="page" href="/">Home</a>
        </li>
        <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="/radio">Radio</a>
        </li>
        <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="/login">Login</a>
        </li>
        <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="/register">Register</a>
        </li>
        <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="${req.get('Referer')}">Back</a>
        </li>
        `
      });
    }
});

app.get('/tos', (req, res) => {
  if (req.session.token) {
      if(handleAuth(req)) {
        res.render('tos', {
          username: req.session.username,
          navbar: `
          <li class="nav-item">
          <a class="nav-link" aria-current="page" href="/">Home</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="/radio">Radio</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="${req.get('Referer')}">Back</a>
          </li>
          `
        });
      }
      else {
        res.send('invalid token')
      }
    } else {
      res.render('tos', {
        username: 'Stranger',
        navbar: `
        <li class="nav-item">
        <a class="nav-link" aria-current="page" href="/">Home</a>
        </li>
        <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="/radio">Radio</a>
        </li>
        <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="/login">Login</a>
        </li>
        <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="/register">Register</a>
        </li>
        <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="${req.get('Referer')}">Back</a>
        </li>
        `
      });
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
                console.log(req.session.token);
                console.log(token)
                await client.query('UPDATE users SET token = $1 WHERE id = $2;', [token, user["id"]]);
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
  

//radio related stuff
const wss = new WebSocket.Server({ server });

async function getSong(id) {
      const client = await pool_radio.connect();

      const resultSong = await client.query('SELECT * FROM music WHERE id = $1', [id]);
      const song = resultSong.rows[0];
      client.release(); // Release the client back to the pool

      return song;
    }
async function addSongToPlaylist(id, req) {
      if(handleAuth(req)) {
        const client = await pool_radio.connect();
        const resultSong = await client.query('SELECT * FROM music WHERE id = $1', [id]);
        const songID = resultSong.rows[0]["id"];
        await client.query('INSERT INTO playlist(song_id, added_by_user) VALUES($1, $2)', [id, req.session.username]);
        client.release(); // Release the client back to the pool
        updateQueueClient(); // update the queue for all clients
        return true;
      } else {
        return false
      }
    }
async function updateQueueClient() {
  const client = await pool_radio.connect();
  const resultSongs = await client.query('SELECT * FROM playlist ORDER BY id ASC');
  let htmlString42 = '';
  let i = 1;
  
  for (const song of resultSongs.rows) {
    const playlistSong = await client.query('SELECT * FROM music WHERE id = $1', [parseInt(song['song_id'])]);
    if (playlistSong.rows.length > 0) {
      const songData = playlistSong.rows[0];
      htmlString42 += `
      <tr>
        <th scope="row">${i}</th> 
        <td>${songData.name}</td>
        <td>${songData.author}</td>
        <td>${songData.album}</td>
      </tr>
      `;
      i++;
    }
  }
  
  global.queue = htmlString42;
  client.release();
  
  wss.clients.forEach((client) => {
    client.send(htmlString42);
  });
}

worker.on('message', async (message) => {
  try {
    console.log('Received data from worker:', message);
    const song = await getSong(message);
    console.log(song);
    global.currentSong = song;
    global.currentSong['base64_album'] = Buffer.from(global.currentSong["album"],'utf-8').toString('base64');
    global.currentSong = JSON.stringify(global.currentSong)
    // Broadcast the updated song data to all connected clients
    wss.clients.forEach((client) => {
      client.send(global.currentSong);
    });
    await updateQueueClient()
  } catch (error) {
    console.error('Error fetching song:', error);
  }
});


wss.on('connection', async (ws) => {
  console.log('Client connected via WebSocket');

  // Send initial data (optional)
  ws.send(global.currentSong);
  await updateQueueClient();
  console.log(global.currentSong + ' was sent to client')
  console.log(global.queue + ' was sent to client')

  // Simulate sending data periodically (replace with your logic)

  // Handle incoming messages from the client
  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
  });
});

server.listen(55064, () => {
  console.log('Express server with WebSocket listening on port 55064');
});

app.get('/api/addToPlaylist/:songID', async function(req, res) {
  const songID = req.params.songID;
  await addSongToPlaylist(songID, req)
  await updateQueueClient;
  res.send('Song added to queue.');
});

app.get('/radio', (req, res) => {
  if (req.session.username) {
    // Assuming 'userId' is the user's name stored in the session
    res.render('radio', {
      username: req.session.username,
      navbar: `
      <li class="nav-item">
      <a class="nav-link" aria-current="page" href="/">Home</a>
      </li>
      <li class="nav-item" style="font-weight: 300;">
        <a class="nav-link" href="/radio">Radio</a>
      </li>
      <li class="nav-item" style="font-weight: 300;">
      <a class="nav-link" href="/radio/music">Music</a>
    </li>
      <li class="nav-item" style="font-weight: 300;">
        <a class="nav-link" href="${req.get('Referer')}">Back</a>
      </li>
      `
    });
  } else {
    res.render('radio', {
      username: 'Stranger',
      navbar: `
      <li class="nav-item">
      <a class="nav-link" aria-current="page" href="/">Home</a>
      </li>
      <li class="nav-item" style="font-weight: 300;">
        <a class="nav-link" href="/radio">Radio</a>
      </li>
      <li class="nav-item" style="font-weight: 300;">
        <a class="nav-link" href="/login">Login</a>
      </li>
      <li class="nav-item" style="font-weight: 300;">
        <a class="nav-link" href="/register">Register</a>
      </li>
      <li class="nav-item" style="font-weight: 300;">
        <a class="nav-link" href="${req.get('Referer')}">Back</a>
      </li>
      `
    });
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
        queryData1 = await radioSql.query(`SELECT * FROM music ORDER BY id ASC LIMIT ${pageSize} OFFSET ${offset}`);
      } else {
        if (filter == 'album') {
          console.log('Album filter')
          queryData1 = await radioSql.query(`SELECT DISTINCT album FROM music`);
          maxPages = 1;
        }
        else if (filter == 'id') {
          console.log('Id filter')
          console.log(offset)
          queryData1 = await radioSql.query(`SELECT * FROM music ORDER BY id ASC LIMIT ${pageSize} OFFSET ${offset}`);
        }
        else {
          console.log('what?')
          queryData1 = await radioSql.query(`SELECT * FROM music ORDER BY id ASC LIMIT ${pageSize} OFFSET ${offset}`);
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
      console.log(queryData1)
      queryData1.rows.forEach((song) => {
        console.log(`adding song with id ${song.id}`)
        htmlString += `
          <div>
            <a class="nav-link" href="music/${song.id}">${song.name}</a><button onclick="addToQueue(${song.id})">+</button>
            <p>Author: ${song.author}</p>
            <p>Album: ${song.album}</p>
            <!-- Add other relevant properties here -->
          </div>
        `;
      });
    }
      // Render the 'music' template with username and music data
      res.render('music', { username: req.session.username, 
        music: htmlString, 
        forward: parseInt(currentPage) + 1, 
        back: parseInt(currentPage) - 1, 
        filter: filterQuery, 
        pages: `${currentPage} out of ${maxPages}`,
        navbar: `
          <li class="nav-item">
          <a class="nav-link" aria-current="page" href="/">Home</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="/radio">Radio</a>
          </li>
          <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="/radio/music">Music</a>
        </li>
          <li class="nav-item" style="font-weight: 300;">
            <a class="nav-link" href="${req.get('Referer')}">Back</a>
          </li>
          `
      });
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
      console.log(decodedQuery)
      queryAlbum = await radioSql.query(`SELECT * FROM music WHERE album = $1`, [decodedQuery]);
      if (queryAlbum.rows[0]) {
      var htmlString = '';
      queryAlbum.rows.forEach((song) => {

        htmlString += `
          <div>
            <a class="nav-link" href="${song.id}">${song.name}</a><button onclick="addToQueue(${song.id})">+</button>
            <p>Author: ${song.author}</p>
            <!-- Add other relevant properties here -->
          </div>
        `;
      });
      res.render('albumDisplay', {username: req.session.username, 
        albumList: htmlString, 
        albumImg: queryAlbum.rows[0]["path_to_cover"], 
        albumName: queryAlbum.rows[0]["album"],
        navbar: `
        <li class="nav-item">
        <a class="nav-link" aria-current="page" href="/">Home</a>
        </li>
        <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="/radio">Radio</a>
        </li>
        <li class="nav-item" style="font-weight: 300;">
          <a class="nav-link" href="${req.get('Referer')}">Back</a>
        </li>
        `})
      } else {
        res.send(`No such album as: ${decodedQuery}`)
      }
  } else {
    if (typeof(userQuery) == 'string') { 
    querySong = await radioSql.query(`SELECT * FROM music WHERE id = $1`, [userQuery]);
    } else {
      res.send('invalid argument, if you think this is an error, contact webmaster at contact@funckenobi42.space or func_kenobi in discord. ')
    }
    radioSql.release();
    if (querySong.rows[0]) {
        res.render('songDisplay', {username: req.session.username,
           songCover: querySong.rows[0]["path_to_cover"],
            songName: querySong.rows[0]["name"],
             songAuthor: querySong.rows[0]["author"],
              songAlbum: querySong.rows[0]["album"],
               songGenre: querySong.rows[0]["genre"],
                songMd5: querySong.rows[0]["md5"],
                 songDate: querySong.rows[0]["date_added"],
                 navbar: `
                 <li class="nav-item">
                 <a class="nav-link" aria-current="page" href="/">Home</a>
                 </li>
                 <li class="nav-item" style="font-weight: 300;">
                   <a class="nav-link" href="/radio">Radio</a>
                 </li>
                 <li class="nav-item" style="font-weight: 300;">
                   <a class="nav-link" href="${req.get('Referer')}">Back</a>
                 </li>
                 ` 
                })
    } else {
      res.send('No such song, if this is an error, contact webmaster at contact@funckenobi42.space or func_kenobi in discord.')
    }

  }
});

const PORT = process.env.PORT || 42125;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
