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
const fs = require('fs'); // For createReadStream
const fsp = require('fs').promises; // For promise-based operations
const { user } = require('pg/lib/defaults');
const config = require('./config/config'); // Import the configuration
const config_radio = require('./config/configRadio'); // Import the configuration
const config_mcRcon = require('./config/configMcRcon');
const config_nodemailer = require('./config/nodemailerConfig'); // Import the configuration
const session = require('./config/sessionConfig'); // Import the configuration
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { Rcon } = require("rcon-client");
const rateLimit = require('express-rate-limit');
const validator = require('validator');

app.set('view engine', 'ejs');

const pool = new Pool(config); // Use the configuration to create the pool
const pool_radio = new Pool(config_radio);
const transporter = nodemailer.createTransport(config_nodemailer); // Use the configuration to create the transporter

app.use(express.static('public'));

// Define the rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 256 // limit each IP to 100 requests per windowMs
});
app.set('trust proxy', 1);
app.use(apiLimiter);

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, `C:/Server/nodeJSweb/public/files/user/${req.session.username}`); // Specify the directory where files will be saved
  },
  filename: async (req, file, cb) => {
    // Access the uploaded file using req.file
    const avatarFile = req.file;

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
    fsp.mkdir(`C:/Server/nodeJSweb/public/files/user/${req.session.username}`, { recursive: true }, (err) => {
      if (err) {
        return callback(null, false)
      }
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
    if (req.session === undefined) {
      return false
    }
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
                <span style="height: inherit">
                    <a class="nav-link" href="/radio">Radio</a>
                </span>
              </li>
              <li class="nav-item" style="font-weight: 300;">
                    <a class="nav-link" href="/files">Files</a>
              </li>
              <li class="nav-item" style="font-weight: 300;">
                <a class="nav-link" style="font-weight: 300;" href="/profile/${req.session.username}">Profile</a>
              </li>
              <li class="nav-item" style="font-weight: 300;">
                  <a class="nav-link" style="font-weight: 200;" href="/logout">Logout</a>
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
            <a class="nav-link" href="/files">Files</a>
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

//file stuff


async function generateUserFolders() {
  const client = await pool.connect();
  try {
    let users = await client.query('SELECT * FROM users WHERE confirmed = true');
    for (let user of users.rows) {
      // Generate a unique folder name, e.g., using the user ID
      const folderName = `${user.username}`;
      const folderPath = path.join('G:/website', folderName);

      // Create the folder if it doesn't exist
      await fsp.mkdir(folderPath, { recursive: true }); // No callback needed here
      console.log(`Folder created for user ${user.id}: ${folderPath}`);
    }
  } catch (error) {
    console.error('Error generating user folders:', error);
  } finally {
    client.release();
  }
}
generateUserFolders()

app.get('/files', async (req, res) => {
  if (req.session.token) {
      if(handleAuth(req)) {
            await generateUserFolders()
            // Define the path to the directory where the folders are located
            const directoryPath = 'G:/website';

            // Read the contents of the directory
            const folders = await fsp.readdir(directoryPath);
    
            // Filter out files, keep only directories
            const folderLinks = (await Promise.all(folders.map(async (folder) => {
              const folderPath = path.join(directoryPath, folder);
              const isDirectory = (await fsp.stat(folderPath)).isDirectory();
              return isDirectory ? `<a href="/files/${folder}">${folder}</a>` : '';
            }))).filter(link => link);

            let folderLinkString = ''
            for (let folder of folderLinks) {
              folderLinkString += `${folder}`
            }
            res.render('files', {
              username: req.session.username,
              navbar: `
            <li class="nav-item">
              <a class="nav-link" aria-current="page" href="/">Home</a>
            </li>
            <li class="nav-item" style="font-weight: 300;">
              <span style="height: inherit">
                  <a class="nav-link" href="/radio">Radio</a>
              </span>
            </li>
            <li class="nav-item" style="font-weight: 300;">
              <span style="height: inherit">
                  <a class="nav-link" href="/files">Files</a>
              </span>
            </li>
            <li class="nav-item" style="font-weight: 300;">
              <a class="nav-link" style="font-weight: 300;" href="/profile/${req.session.username}">Profile</a>
            </li>
            <li class="nav-item" style="font-weight: 300;">
                <a class="nav-link" style="font-weight: 200;" href="/logout">Logout</a>
            </li>
              `,
              folders: folderLinkString
          });
        } 
        else {
          res.send('invalid token')
        }
    } else {
      res.redirect('/')
    }
  });

const getUserStorageUsage = async (directoryPath) => {
  const files = await fsp.readdir(directoryPath);
  let totalSize = 0;

  for (const file of files) {
      const filePath = path.join(directoryPath, file);
      const stats = await fsp.stat(filePath);
      totalSize += stats.size;
  }

  // Convert bytes to gigabytes
  const totalSizeGB = totalSize / (1024 * 1024 * 1024);
  return totalSizeGB;
};

// Set up storage engine for multer
const websiteStorage = multer.diskStorage({
  destination: function (req, file, cb) {
      const fileUser = req.params.username;
      if (fileUser) {
        // Sanitize the user input
        fileUser = validator.escape(userQuery);
      }
      const directoryPath = `G:/website/${fileUser}`;
      cb(null, directoryPath);
  },
  filename: function (req, file, cb) {
      cb(null, file.originalname);
  }
});

const userUpload = multer({ storage: websiteStorage });

app.post('/upload/:username', userUpload.array('files'), async (req, res) => {
  if (req.session.token && handleAuth(req)) {
      if (req.params.username === req.session.username) {
          // File uploaded successfully
          res.redirect(`/files/${req.session.username}`);
      } else {
          res.status(403).send('You do not have permission to upload files to this folder.');
      }
  } else {
      res.send('invalid token');
  }
});

// Delete route
app.get('/delete/:username/:filename', async (req, res) => {
  if (req.session.token && handleAuth(req)) {
      if (req.params.username === req.session.username) {
          const fileUser = req.params.username;
          if (fileUser) {
            // Sanitize the user input
            fileUser = validator.escape(userQuery);
          }
          const filename = req.params.filename;
          if (filename) {
            // Sanitize the user input
            filename = validator.escape(userQuery);
          }
          const filePath = path.join(`G:/website/${fileUser}`, filename);

          try {
              await fsp.unlink(filePath);
              res.redirect(`/files/${req.session.username}`);
          } catch (error) {
              res.status(500).send('Error deleting file.');
          }
      } else {
          res.status(403).send('You do not have permission to delete files from this folder.');
      }
  } else {
      res.send('invalid token');
  }
});

// Upload route with multiple file support and storage check
app.post('/upload/:username', userUpload.array('files'), async (req, res) => {
  if (req.session.token && handleAuth(req)) {
      if (req.params.username === req.session.username) {
          const fileUser = req.params.username;
          if (fileUser) {
            // Sanitize the user input
            fileUser = validator.escape(userQuery);
          }
          const directoryPath = `G:/website/${fileUser}`;
          const storageUsedGB = await getUserStorageUsage(directoryPath);
          const storageLimitGB = 20; // 20 GB storage limit
          let totalUploadSizeGB = 0;

          // Calculate the total upload size in GB
          req.files.forEach(file => {
              totalUploadSizeGB += file.size / (1024 * 1024 * 1024);
          });

          if (storageUsedGB + totalUploadSizeGB <= storageLimitGB) {
              // Total file size is within the limit, proceed with upload
              res.redirect(`/files/${req.session.username}`);
          } else {
              // Total file size exceeds the limit, do not upload and inform the user
              res.status(400).send('Total file size exceeds the available storage space.');
          }
      } else {
          res.status(403).send('You do not have permission to upload files to this folder.');
      }
  } else {
      res.send('invalid token');
  }
});



app.get('/files/:username', async (req, res) => {
  if (req.session.token) {
      if(handleAuth(req)) {
          const fileUser = req.params.username;
          if (fileUser) {
            // Sanitize the user input
            fileUser = validator.escape(userQuery);
          }
          const directoryPath = `G:/website/${fileUser}`;
          const items = await fsp.readdir(directoryPath);

          const storageUsedGB = await getUserStorageUsage(directoryPath);
          const storageLimitGB = 20; // 20 GB storage limit
          const storageLeftGB = storageLimitGB - storageUsedGB;

          const itemsLinks = (await Promise.all(items.map(async (item) => {
              const itemPath = path.join(directoryPath, item);
              const isDirectory = (await fsp.stat(itemPath)).isDirectory();
              if (!isDirectory) {
                  // Add a preview link for images and text files
                  const fileExtension = path.extname(item).toLowerCase();
                  const previewableFileTypes = ['.png', '.jpg', '.jpeg', '.gif', '.txt', '.mp4', '.mp3', '.wav' ];
                  const previewLink = previewableFileTypes.includes(fileExtension) ? `<a href="/files/${fileUser}/preview//${item}" target="_blank">Preview</a>` : '';
                  return `<a href="/download/${fileUser}/${item}">${item}</a>${req.session.username == fileUser ? ` <a href="/delete/${fileUser}/${item}">Delete</a>` : ''} ${previewLink}<br>`;
              } else {
                  return `<a href="/files/${fileUser}/${item}">${item}</a><br>`;
              }
          }))).join('');

          let controls = '';
          if(req.session.username == fileUser) {
              controls = `
              <form action="/upload/${fileUser}" method="post" enctype="multipart/form-data">
                  <input type="file" name="files" multiple />
                  <button type="submit">Upload</button>
              </form>
              `;
          }

          res.render('userFolder', {
              username: req.session.username,
              storageInfo: `Used: ${storageUsedGB.toFixed(2)} GB / Available: ${storageLeftGB.toFixed(2)} GB`,
              navbar: `
                  <li class="nav-item">
                      <a class="nav-link" aria-current="page" href="/">Home</a>
                  </li>
                  <li class="nav-item">
                      <a class="nav-link" href="/radio">Radio</a>
                  </li>
                  <li class="nav-item">
                      <a class="nav-link" href="/files">Files</a>
                  </li>
                  <li class="nav-item">
                      <a class="nav-link" href="/profile/${req.session.username}">Profile</a>
                  </li>
                  <li class="nav-item">
                      <a class="nav-link" href="/logout">Logout</a>
                  </li>
              `,
              foldersAndFiles: itemsLinks,
              controls: controls,
              totalSize: `You have ${storageLeftGB.toFixed(2)} GB out of ${storageLimitGB} GB`
          });
      } else {
          res.send('invalid token');
      }
  } else {
      res.redirect('/');
  }
});

app.get('/files/:username/preview/:filename', async (req, res) => {
  const fileUser = req.params.username;
  const filename = req.params.filename;
  const filePath = path.join(`G:/website/${fileUser}`, filename);

  try {
      // Serve the file directly for the browser to display
      res.sendFile(filePath);
  } catch (error) {
      res.status(500).send('Error previewing file.');
  }
});

//other stuff
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


function hashPassword(password, salt, iterations, keylen, digest) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'), salt);
    });
  });

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
          res.send(error)
        }
        if (!salt) {
          message = "Invalid email or password";
          client.release(); // Release the client back to the pool
          res.render('login', {messages: message});
        }
        password = await hashPassword(password, salt, iterations, keylen, digest);
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
                req.session.userId = user['id']
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
                    const iterations = 100000; // Recommended to be as high as possible
                    const keylen = 64; // Length of the derived key
                    const digest = 'sha512'; // More secure hashing algorithm
                    const salt = crypto.randomBytes(16).toString('hex');
                    password = await hashPassword(password, salt, iterations, keylen, digest);
                    await client.query('INSERT INTO users(username, email, password, token, salt) VALUES ($1, $2, $3, $4, $5)', [username, email, password, token, salt]);
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
        await updateQueueClient(); // update the queue for all clients
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
        <td><button onclick="removeFromQueue(${song.id})">-</button></td>
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


async function getCurrentPlayingSong() {
  const client = await pool_radio.connect();
  try {
    // Get the current time
    const now = new Date();

    // Query the database for the song that is currently playing
    const queryText = 'SELECT id, when_started, duration FROM music_sync ORDER BY when_started DESC LIMIT 1';
    const result = await client.query(queryText);

    if (result.rows.length > 0) {
      const currentSongSync = result.rows[0];
      const whenStarted = new Date(currentSongSync.when_started);
      const duration = currentSongSync.duration;
      const timeElapsed = (now - whenStarted) / 1000; // convert to seconds

      // Check if the current song is still playing
      if (timeElapsed < duration) {
        // The song is still playing, get the full song data from the music table
        const fullSongData = await getSong(currentSongSync.id);
        fullSongData['base64_album'] = Buffer.from(fullSongData["album"],'utf-8').toString('base64');
        global.currentSong = fullSongData
        return fullSongData;
      }
    }

    // If no song is currently playing or the function did not return earlier, return null
    return null;
  } catch (error) {
    console.error('Error in getCurrentPlayingSong:', error);
    throw error;
  } finally {
    client.release();
  }
}


// WebSocket connection event
wss.on('connection', async (ws) => {
  console.log('Client connected via WebSocket');

  // Send the current song to the newly connected client
  const currentSong = await getCurrentPlayingSong();
  await updateQueueClient()
  console.log(currentSong)
  if (currentSong) {
    // Convert album to base64
    ws.send(JSON.stringify(global.currentSong));
  } else {
    ws.send('No song is currently playing.');
  }
  ws.on('error', function(error) {
    console.error('WebSocket error on connection:', error);
  });

  // Add a 'close' event listener to the WebSocket
  ws.on('close', function(code, reason) {
    console.log(`WebSocket connection closed with code: ${code}, reason: ${reason}`);
  });
  // Handle incoming messages from the client
  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
  });
});

worker.on('message', async (message) => {
  try {
    console.log('Received data from worker:', message);

    // Ensure global.currentSong is a string
    await getCurrentPlayingSong();
    const currentSongString = JSON.stringify(global.currentSong);
    wss.clients.forEach((client) => {
      client.send(currentSongString);
    });

    await updateQueueClient();
  } catch (error) {
    console.error('Error fetching song:', error);
  }
});

server.listen(55064, () => {
  console.log('Express server with WebSocket listening on port 55064');
});

app.get('/api/addToPlaylist/:songID', async function(req, res) {
  const songID = req.params.songID;
  await addSongToPlaylist(songID, req)
  updateQueueClient;
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
      if (currentPage) {
        currentPage = validator.escape(currentPage);
      }
      var SessionFilter = req.query.f;
      if (SessionFilter) {
      SessionFilter = validator.escape(SessionFilter);
      }
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
        filterQuery = `&f=id`
        queryData1 = await radioSql.query(`SELECT * FROM music ORDER BY id ASC LIMIT ${pageSize} offset ${offset}`);
      } else {
        if (filter == 'album') {
          console.log('Album filter')
          queryData1 = await radioSql.query(`SELECT DISTINCT album FROM music`);
          maxPages = 1;
        }
        else if (filter == 'id') {
          console.log('Id filter')
          console.log(offset)
          queryData1 = await radioSql.query(`SELECT * FROM music ORDER BY id ASC LIMIT ${pageSize} offset ${offset}`);
        }
        else {
          console.log('what?')
          queryData1 = await radioSql.query(`SELECT * FROM music ORDER BY id ASC LIMIT ${pageSize} offset ${offset}`);
        }
        filterQuery = `&f=${filter}`
      }     

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
      radioSql.release()
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
  let userQuery = req.params.userQuery;
  if (userQuery) {
    // Sanitize the user input
    userQuery = validator.escape(userQuery);
  }
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

async function getLastButtonPress(userId) {
  const { rows } = await pool_radio.query('SELECT * FROM get_last_button_press($1)', [userId]);
  console.log(rows)
  return rows[0];
}

// Function to reset the button press count
async function resetButtonPressCount(userId, currentTime) {
  await pool_radio.query('SELECT reset_button_press_count($1, $2)', [userId, currentTime]);
}

// Function to increment the button press count
async function incrementButtonPressCount(userId) {
  await pool_radio.query('SELECT increment_button_press_count($1)', [userId]);
}

const buttonPressResetTime = 300000; // 5 minutes in milliseconds

app.get('/api/button', async (req, res) => {
  if (!await handleAuth(req)) {
    return res.send('You are not authenticated!');
  }
  console.log(`${req.session.username} has pressed the button!`)
  const userId = req.session.userId; // Assuming you store a persistent user ID in the session

  try {
    // Retrieve the last button press record for the user from the database
    const lastPress = await getLastButtonPress(userId);
    const currentTime = Date.now();

    // If the user does not exist in the database or the reset time has passed
    if (!lastPress || currentTime - lastPress.last_pressed.getTime() > buttonPressResetTime) {
      // Reset the count and timestamp in the database
      await resetButtonPressCount(userId, new Date(currentTime));
      req.session.buttonPresses = 1; // Optional: Update the session for immediate subsequent checks
    } else if (lastPress.count < 1) {
      // If the count is below the limit, increment in the database
      await incrementButtonPressCount(userId);
      req.session.buttonPresses = lastPress.count + 1; // Optional: Update the session for immediate subsequent checks
    } else {
      // Limit reached
      const resetTime = new Date(lastPress.last_pressed.getTime() + buttonPressResetTime);
      return res.send(`Button press limit reached.\nLimit expires at: ${resetTime}`);
    }

    // Call the serverButtonRandom function and send the response
    await serverButtonRandom();
    res.send(global.minecraftresponse);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred.');
  }
});


app.get('/button', async (req, res) => {
  res.render('button', {username: req.session.username,navbar: `
  <li class="nav-item">
  <a class="nav-link" aria-current="page" href="/">Home</a>
  </li>
  `});
});

async function serverButtonRandom() {
  const rcon = await Rcon.connect(config_mcRcon);

  // Commands with their corresponding weights
  const weightedCommands = [
    { command: 'time add 12000', weight: 20 },
    { command: 'weather rain', weight: 20 },
    { command: 'weather thunder', weight: 20 },
    { command: 'weather clear', weight: 20 },
    { command: 'say Did anyone see my pet creeper?', weight: 10 },
    { command: 'summon creeper ~ ~ ~ {CustomName:"\\"Jerry\\""}', weight: 5 },
    { command: 'tellraw @a {"text":"Someone pressed a button with malicious intent!", "color":"red"}', weight: 20 },
    { command: 'particle heart ~ ~1 ~ 0.5 0.5 0.5 0 10 normal @a', weight: 15 },
    { command: 'playsound minecraft:entity.parrot.imitate.ender_dragon ambient @a ~ ~ ~', weight: 8 },
    { command: 'title @a title {"text":"Look out! Flying pig!", "bold":true, "color":"red"}', weight: 5 },
    { command: 'summon pig ~ ~ ~ {NoAI:1b,Passengers:[{id:"minecraft:firework_rocket",LifeTime:20}]}', weight: 5 },
    { command: 'give @r minecraft:elytra{display:{Name:"{\\"text\\":\\"Wings of Destiny\\"}",Lore:["{\\"text\\":\\"Soar above the clouds!\\"}"]}}', weight: 1 },
    { command: 'give @r minecraft:dragon_egg', weight: 0.5 },
    { command: 'give @r minecraft:totem_of_undying{display:{Name:"{\\"text\\":\\"Charm of Life\\"}",Lore:["{\\"text\\":\\"Cheat death, if only once.\\"}"]}}', weight: 1 },
    { command: 'give @r minecraft:beacon{display:{Name:"{\\"text\\":\\"Beacon of Hope\\"}",Lore:["{\\"text\\":\\"Light up your world!\\"}"]}}', weight: 1 },
    { command: 'give @r minecraft:nether_star{display:{Name:"{\\"text\\":\\"Star of the Nether\\"}",Lore:["{\\"text\\":\\"A piece of the abyss.\\"}"]}}', weight: 1 },
    { command: 'give @r minecraft:command_block{display:{Name:"{\\"text\\":\\"Block of Commanding\\"}",Lore:["{\\"text\\":\\"What will you create?\\"}"]}}', weight: 0.05 },
    { command: 'give @r minecraft:heart_of_the_sea{display:{Name:"{\\"text\\":\\"Salt Baller\\"}",Lore:["{\\"text\\":\\"The sea`s balls await.\\"}"]}}', weight: 1 },
    { command: 'say If you find a pool of lava, don’t walk into it. It’s not a hot tub!', weight: 18 },
    { command: 'effect give @r minecraft:slowness 30 1 true', weight: 0.2 },
    { command: 'summon zombie ~ ~ ~ {CustomName:"\\"Mini Boss\\"",ArmorItems:[{},{},{},{id:"minecraft:diamond_helmet",Count:1b}],HandItems:[{id:"minecraft:diamond_sword",Count:1b},{}],Attributes:[{Name:"generic.maxHealth",Base:50.0},{Name:"generic.attackDamage",Base:5.0}],Invulnerable:1b,Silent:0b,NoAI:0b}', weight: 0.1 },
    { command: 'execute at @r run fill ~-2 ~-1 ~-2 ~2 ~-1 ~2 minecraft:lava', weight: 0.1 },
    { command: 'give @r minecraft:written_book{pages:["{\\"text\\":\\"You shouldn\'t have pressed that button...\\",\\"color\\":\\"dark_red\\",\\"bold\\":true}"],title:"Bad Luck",author:"The Server"}', weight: 0.2 },
    { command: 'execute at @r run tp @s ~ ~100 ~', weight: 0.1 },
    { command: 'execute at @r run setblock ~ ~ ~ minecraft:spawner{SpawnData:{id:"Creeper"}}', weight: 0.1 },
    { command: 'give @p minecraft:cookie{display:{Name:"{\\"text\\":\\"Fortune Cookie\\"}"},Lore:["{\\"text\\":\\"Break for a surprise!\\"}"]}', weight: 7 },
    { command: 'give @r minecraft:cake', weight: 15 },
    { command: 'summon chicken ~ ~ ~ {NoAI:1b,CustomName:"\\"Dinnerbone\\""}', weight: 15 },
    { command: 'execute at @r run particle cloud ~ ~ ~ 0.5 0.5 0.5 0.01 100 normal', weight: 15 },
    { command: 'tellraw @a {"text":"It\'s raining cats and dogs! (not really)"}', weight: 15 },
    { command: 'execute at @r run setblock ~ ~ ~ minecraft:jukebox', weight: 15 },
    { command: 'give @r minecraft:pumpkin_pie', weight: 15 },
    { command: 'execute at @r run summon boat ~ ~ ~', weight: 15 },
    { command: 'execute at @r run setblock ~ ~ ~ minecraft:flower_pot{Item:"minecraft:red_flower"}', weight: 15 },
    { command: 'execute at @r run summon armor_stand ~ ~ ~ {CustomName:"\\"Invisible Friend\\"",Invisible:1b,Invulnerable:1b}', weight: 10 },
    { command: 'execute at @r run summon bat ~ ~ ~ {CustomName:"\\"Dracula\\"",Invulnerable:1b}', weight: 10 },
    { command: 'execute at @r run summon rabbit ~ ~ ~ {RabbitType:99,CustomName:"\\"The Killer Bunny\\"",Invulnerable:1b}', weight: 5 },
    { command: 'execute at @r run summon pig ~ ~ ~ {CustomName:"\\"Pigasus\\"",Invulnerable:1b,NoAI:1b,Saddle:1b}', weight: 10 },
    { command: 'execute at @r run summon villager ~ ~ ~ {CustomName:"\\"The Wanderer\\"",Profession:2,Career:1}', weight: 10 },
    { command: 'execute at @r run summon llama ~ ~ ~ {CustomName:"\\"Drama Llama\\"",Tame:1b,DecorItem:{id:"minecraft:carpet",Count:1b,Damage:14s}}', weight: 10 },
    { command: 'execute at @r run summon wolf ~ ~ ~ {CustomName:"\\"Doggo\\"",OwnerUUID:"@p",CollarColor:14}', weight: 10 },
    { command: 'execute at @r run summon cat ~ ~ ~ {CustomName:"\\"Mr. Whiskers\\"",CatType:1,Invulnerable:1b}', weight: 10 },
    { command: 'execute at @r run summon firework_rocket ~ ~ ~ {LifeTime:20,FireworksItem:{id:"minecraft:firework_rocket",Count:1b,tag:{Fireworks:{Explosions:[{Type:4,Colors:[I;16711680],FadeColors:[I;16776960]}]}}}}', weight: 10 },
    { command: 'execute at @r run summon tnt ~ ~ ~ {Fuse:80}', weight: 5 },
    { command: 'execute at @r run summon ender_pearl ~ ~ ~ {owner:@p}', weight: 10 },
    { command: 'execute at @r run summon area_effect_cloud ~ ~ ~ {Particle:"end_rod",Radius:3f,Duration:200}', weight: 10 },
    { command: 'execute at @r run summon falling_block ~ ~ ~ {BlockState:{Name:"minecraft:anvil"},Time:1}', weight: 5 },
    { command: 'execute at @r run summon armor_stand ~ ~ ~ {CustomName:"\\"Stand By Me\\"",NoGravity:1b,ShowArms:1b}', weight: 10 },
    { command: 'execute at @r run summon lightning_bolt', weight: 2 },
    { command: 'execute at @r run setblock ~ ~ ~ minecraft:chest{LootTable:"chests/simple_dungeon"}', weight: 10 },
    { command: 'give @r minecraft:firework_rocket{Fireworks:{Flight:3b,Explosions:[{Type:4,Flicker:1,Trail:1,Colors:[I;11743532],FadeColors:[I;15435844]}]}}', weight: 5 },
    { command: 'execute at @r run summon ender_dragon ~ ~ ~', weight: 0.001 },
    { command: 'execute at @r run summon wither ~ ~ ~', weight: 0.005 },
    { command: 'execute at @r run summon giant ~ ~ ~', weight: 0.05 },
    { command: 'execute at @r run summon shulker ~ ~ ~ {NoAI:1b}', weight: 5 },
    { command: 'execute at @r run summon vex ~ ~ ~ {BoundX:~10,BoundY:~5,BoundZ:~10,LifeTicks:1200}', weight: 5 },
    { command: 'execute at @r run summon evoker ~ ~ ~', weight: 0.5 },
    { command: 'execute at @r run summon vindicator ~ ~ ~', weight: 0.5 },
    { command: 'execute at @r run summon illusioner ~ ~ ~', weight: 0.5 },
    { command: 'execute at @r run summon elder_guardian ~ ~ ~', weight: 0.5 },
    { command: 'execute at @r run summon polar_bear ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon panda ~ ~ ~ {MainGene:"lazy",HiddenGene:"worried"}', weight: 10 },
    { command: 'execute at @r run summon parrot ~ ~ ~ {Variant:4}', weight: 10 },
    { command: 'execute at @r run summon horse ~ ~ ~ {Tame:1b,Color:3,Variant:769,ArmorItem:{id:"minecraft:diamond_horse_armor",Count:1b}}', weight: 10 },
    { command: 'execute at @r run summon villager ~ ~ ~ {VillagerData:{profession:"librarian",level:2,type:"plains"}}', weight: 10 },
    { command: 'execute at @r run summon zombie_villager ~ ~ ~ {VillagerData:{profession:"farmer",level:2,type:"desert"}}', weight: 10 },
    { command: 'execute at @r run summon zombie_horse ~ ~ ~ {Tame:1b,SaddleItem:{id:"minecraft:saddle",Count:1b}}', weight: 10 },
    { command: 'execute at @r run summon skeleton_horse ~ ~ ~ {Tame:1b,SaddleItem:{id:"minecraft:saddle",Count:1b}}', weight: 10 },
    { command: 'execute at @r run summon donkey ~ ~ ~ {Tame:1b,ChestedHorse:1b,SaddleItem:{id:"minecraft:saddle",Count:1b}}', weight: 10 },
    { command: 'execute at @r run summon mule ~ ~ ~ {Tame:1b,ChestedHorse:1b,SaddleItem:{id:"minecraft:saddle",Count:1b}}', weight: 10 },
    { command: 'execute at @r run summon llama ~ ~ ~ {Tame:1b,Strength:5,DecorItem:{id:"minecraft:carpet",Count:1b,Damage:4s}}', weight: 10 },
    { command: 'execute at @r run summon trader_llama ~ ~ ~ {Tame:1b,Strength:5,DecorItem:{id:"minecraft:carpet",Count:1b,Damage:4s}}', weight: 10 },
    { command: 'execute at @r run summon dolphin ~ ~ ~ {CanPickUpLoot:1b,NoAI:1b}', weight: 10 },
    { command: 'execute at @r run summon turtle ~ ~ ~ {HomePosX:~10,HomePosY:~,HomePosZ:~10}', weight: 10 },
    { command: 'execute at @r run summon phantom ~ ~ ~ {Size:5}', weight: 5 },
    { command: 'execute at @r run summon cod ~ ~ ~ {NoAI:1b}', weight: 15 },
    { command: 'execute at @r run summon salmon ~ ~ ~ {NoAI:1b}', weight: 15 },
    { command: 'execute at @r run summon pufferfish ~ ~ ~ {NoAI:1b,Puffsptate:2}', weight: 15 },
    { command: 'execute at @r run summon tropical_fish ~ ~ ~ {NoAI:1b,Variant:12345678}', weight: 15 },
    { command: 'execute at @r run summon drowned ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon husk ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon stray ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon blaze ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon cave_spider ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon enderman ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon ghast ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon magma_cube ~ ~ ~ {Size:3}', weight: 5 },
    { command: 'execute at @r run summon slime ~ ~ ~ {Size:3}', weight: 5 },
    { command: 'execute at @r run summon witch ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon guardian ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon elder_guardian ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon shulker ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon silverfish ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon skeleton ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon spider ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon zombie ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon zombie_pigman ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon pillager ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon ravager ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon hoglin ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon piglin ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon zoglin ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon piglin_brute ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon strider ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon zombified_piglin ~ ~ ~', weight: 5 },
    { command: 'execute at @r run summon fox ~ ~ ~ {Type:"red"}', weight: 10 },
    { command: 'execute at @r run summon ocelot ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon wolf ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon bee ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon iron_golem ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon snow_golem ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon mooshroom ~ ~ ~ {Type:"red"}', weight: 10 },
    { command: 'execute at @r run summon cow ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon pig ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon sheep ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon chicken ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon squid ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon bat ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon rabbit ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon llama ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon parrot ~ ~ ~', weight: 10 },
    { command: 'execute at @r run summon villager ~ ~ ~', weight: 10 },
    { command: 'setblock ~ ~ ~ minecraft:chest{LootTable:"chests/igloo_chest"}', weight: 10 },
    { command: 'fill ~1 ~-1 ~1 ~-1 ~-1 ~-1 minecraft:water', weight: 1 },
    { command: 'clone ~ ~ ~ ~10 ~10 ~10 ~20 ~ ~ replace move', weight: 0.5 },
    { command: 'setworldspawn ~ ~ ~', weight: 0.05 },
    { command: 'spreadplayers ~ ~ 50 100 false @a', weight: 10 },
    { command: 'data merge block ~ ~ ~ {Text1:"{\\"text\\":\\"Welcome to the server!\\"}",Text2:"{\\"text\\":\\"Enjoy your stay\\"}",Text3:"{\\"text\\":\\"Don\'t forget to read the rules!\\"}",Text4:"{\\"text\\":\\"Have fun!\\"}"}', weight: 5 },
    { command: 'playsound minecraft:block.note_block.harp master @a ~ ~ ~ 1 2', weight: 10 },
    { command: 'playsound minecraft:block.note_block.bass master @a ~ ~ ~ 1 0.5', weight: 10 },
    { command: 'playsound minecraft:block.note_block.pling master @a ~ ~ ~ 1 1.5', weight: 10 },
    { command: 'playsound minecraft:block.note_block.bell master @a ~ ~ ~ 1 1', weight: 10 },
    { command: 'playsound minecraft:block.note_block.flute master @a ~ ~ ~ 1 0.7', weight: 10 },
    { command: 'playsound minecraft:block.note_block.guitar master @a ~ ~ ~ 1 0.6', weight: 10 },
    { command: 'playsound minecraft:block.note_block.xylophone master @a ~ ~ ~ 1 1.2', weight: 10 },
    { command: 'playsound minecraft:block.note_block.iron_xylophone master @a ~ ~ ~ 1 1.3', weight: 10 },
    { command: 'playsound minecraft:block.note_block.cow_bell master @a ~ ~ ~ 1 1.4', weight: 10 },
    { command: 'playsound minecraft:block.note_block.didgeridoo master @a ~ ~ ~ 1 1.6', weight: 10 },
    { command: 'playsound minecraft:block.note_block.bit master @a ~ ~ ~ 1 1.7', weight: 10 },
    { command: 'playsound minecraft:block.note_block.banjo master @a ~ ~ ~ 1 1.8', weight: 10 },
    { command: 'playsound minecraft:block.note_block.pling master @a ~ ~ ~ 1 1.9', weight: 10 },
    { command: 'effect give @a minecraft:night_vision 10000 1 true', weight: 5 },
    { command: 'effect give @a minecraft:invisibility 10000 1 true', weight: 5 },
    { command: 'effect give @a minecraft:jump_boost 6000 5 true', weight: 5 },
    { command: 'effect give @a minecraft:speed 6000 5 true', weight: 5 },
    { command: 'effect give @a minecraft:fire_resistance 6000 0 true', weight: 5 },
    { command: 'effect give @a minecraft:haste 6000 2 true', weight: 5 },
    { command: 'effect give @a minecraft:strength 6000 5 true', weight: 5 },
    { command: 'effect give @a minecraft:regeneration 6000 2 true', weight: 5 },
    { command: 'effect give @a minecraft:resistance 6000 4 true', weight: 5 },
    { command: 'effect give @a minecraft:water_breathing 6000 0 true', weight: 5 },
    { command: 'effect give @a minecraft:levitation 100 1 true', weight: 1 },
    { command: 'enchant @p sharpness 5', weight: 5 },
    { command: 'enchant @p efficiency 5', weight: 5 },
    { command: 'enchant @p unbreaking 3', weight: 5 },
    { command: 'enchant @p fortune 3', weight: 5 },
    { command: 'enchant @p mending 1', weight: 5 },
    { command: 'enchant @p flame 1', weight: 5 },
    { command: 'enchant @p looting 3', weight: 5 },
    { command: 'enchant @p silk_touch 1', weight: 5 },
    { command: 'xp add @a 50 levels', weight: 10 },
    { command: 'xp add @a 1000 points', weight: 10},
    { command: 'give @p diamond 2', weight: 1 }
  ];
  
  // Function to select a command based on weights
  function selectWeightedCommand(weightedCommands) {
    const totalWeight = weightedCommands.reduce((total, cmd) => total + cmd.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (const item of weightedCommands) {
      if (randomNum < item.weight) {
        return item.command;
      }
      randomNum -= item.weight;
    }
  }

  // Select a command using the weighted function
  const randomCommand = selectWeightedCommand(weightedCommands);

  // Send the selected command to the server and wait for the response
  let response = await rcon.send(randomCommand);
  console.log(response);
  if (response.length < 2) {
    response = randomCommand;
  }
  global.minecraftresponse = response;

  rcon.end();
}






const PORT = process.env.PORT || 42125;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
