const express = require('express');
const router = express.Router();
const authController = require('../../controllers/access/authentication');

router.get('/', (req, res) => {
    if (req.session.token) {
        if(authController.handleAuth(req)) {
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

router.get('/about', (req, res) => {
    if (req.session.token) {
        if(authController.handleAuth(req)) {
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
  
  router.get('/tos', (req, res) => {
    if (req.session.token) {
        if(authController.handleAuth(req)) {
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
  

module.exports = router;