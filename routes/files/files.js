const express = require('express');
const router = express.Router();
const authController = require('../../controllers/access/authentication');
const fileController = require('../../controllers/files/fileController');
const multerMiddleware = require('../../middleware/storage/multerConfig')
const validator = require('validator');
const fs = require('fs'); // For createReadStream
const fsp = require('fs').promises; // For promise-based operations
const path = require('path')

router.get('/', async (req, res) => { 
    if (req.session.token) {
        if(authController.handleAuth(req)) {
              await fileController.generateUserFolders()
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

router.get('/:username', async (req, res) => {
    if (req.session.token) {
        if(authController.handleAuth(req)) {
            let fileUser = req.params.username;
            if (fileUser) {
              // Sanitize the user input
              fileUser = validator.escape(fileUser);
            }
            try {
            const directoryPath = `G:/website/${fileUser}`;
            const items = await fsp.readdir(directoryPath);
            
  
  
            const storageUsedGB = await fileController.getUserStorageUsage(directoryPath);
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
                    return `<a href="/files/download/${fileUser}/${item}">${item}</a>${req.session.username == fileUser ? ` <a href="/files/delete/${fileUser}/${item}">Delete</a>` : ''} ${previewLink}<br>`;
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
            }
            catch {
              res.send('An error has occured during your bullshit attempt.')
            }
        } else {
            res.send('invalid token');
        }
    } else {
        res.redirect('/');
    }
  });

router.post('/upload/:username', multerMiddleware.userUpload.array('files'), async (req, res) => {
    if (req.session.token && authController.handleAuth(req)) {
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

router.get('/delete/:username/:filename', async (req, res) => {
    if (req.session.token && authController.handleAuth(req)) {
        if (req.params.username === req.session.username) {
            let fileUser = req.params.username;
            if (fileUser) {
              // Sanitize the user input
              fileUser = validator.escape(fileUser);
            }
            let filename = req.params.filename;
            if (filename) {
              // Sanitize the user input
              filename = validator.escape(filename);
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
router.post('/upload/:username', multerMiddleware.userUpload.array('files'), async (req, res) => {
    if (req.session.token && authController.handleAuth(req)) {
        if (req.params.username === req.session.username) {
            let fileUser = req.params.username;
            if (fileUser) {
              // Sanitize the user input
              fileUser = validator.escape(fileUser);
            }
            const directoryPath = `G:/website/${fileUser}`;
            const storageUsedGB = await fileController.getUserStorageUsage(directoryPath);
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

  router.get('/download/:username/:filename', async (req, res) => {
    let fileUser = req.params.username;
    if (fileUser) {
      // Sanitize the user input
      fileUser = validator.escape(fileUser);
    }
    let filename = req.params.filename;
    if (filename) {
      // Sanitize the user input
      filename = validator.escape(filename);
    }
    const filePath = path.join(`G:/website/${fileUser}`, filename);
  
    try {
        // Serve the file directly for the browser to display
        res.download(filePath);
    } catch (error) {
        res.status(500).send('Error downloading file.');
    }
  });
  
  router.get('/:username/preview/:filename', async (req, res) => {
    let fileUser = req.params.username;
    if (fileUser) {
      // Sanitize the user input
      fileUser = validator.escape(fileUser);
    }
    let filename = req.params.filename;
    if (filename) {
      // Sanitize the user input
      filename = validator.escape(filename);
    }
    const filePath = path.join(`G:/website/${fileUser}`, filename);
  
    try {
        // Serve the file directly for the browser to display
        res.sendFile(filePath);
    } catch (error) {
        res.status(500).send('Error previewing file.');
    }
  });

//profile stuff
router.post(
    '/uploadAvatar',
    multerMiddleware.upload, // Handle the file upload
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

module.exports = router;