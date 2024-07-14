const express = require('express');
const router = express.Router();
const authController = require('../../controllers/access/authentication');
const profileController = require('../../controllers/profile/profileController');

router.get('/profile/:userProfile', async (req, res) => { // Add 'async' here
    const userProfile = req.params.userProfile;
    if (userProfile) {
      try {
        const profile = await profileController.getProfile(userProfile); // Await the result
        if (profile) {
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


module.exports = router;