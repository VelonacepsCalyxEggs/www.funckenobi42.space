const multer = require('multer');
const path = require('path');
const validator = require('validator');
const fs = require('fs'); // For createReadStream
const fsp = require('fs').promises; // For promise-based operations

const websiteStorage = multer.diskStorage({
  destination: function (req, file, cb) {
      let fileUser = req.params.username;
      if (fileUser) {
        // Sanitize the user input
        fileUser = validator.escape(fileUser);
      }
      const directoryPath = `G:/website/${fileUser}`;
      cb(null, directoryPath);
  },
  filename: function (req, file, cb) {
      cb(null, file.originalname);
  }
});

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

const userUpload = multer({ storage: websiteStorage });

module.exports = { userUpload, upload };