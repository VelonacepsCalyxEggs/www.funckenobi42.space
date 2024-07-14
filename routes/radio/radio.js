const express = require('express');
const router = express.Router();

const { Pool } = require('pg');
const config_radio = require('../../config/configRadio'); // Import the configuration
const pool_radio = new Pool(config_radio);
const radioController = require('../../controllers/radio/radioController')
const cryptographyController = require('../../controllers/cryptography/cryptographyController')
const validator = require('validator');

router.get('/music/api/addToPlaylist/:songID', async function(req, res) {
    const songID = req.params.songID;
    await radioController.addSongToPlaylist(songID, req)
    radioController.updateQueueClient;
    res.send('Song added to queue.');
  });
  
router.get('/', (req, res) => {
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
  
router.get('/music', async (req, res) => {
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
    if (currentPage == undefined || currentPage <= 0) {
        currentPage = 1;
    }
    const pageSize = 6; // Number of records per page
    const offset = (currentPage - 1) * pageSize;
    
    const radioSql = await pool_radio.connect();
    const queryDataLength = await radioSql.query(`SELECT max(id) FROM music`);
    var maxPages = (queryDataLength.rows[0]["max"]) / 6;
    if (filter == undefined) {
        filterQuery = `&f=id`
        queryData1 = await radioSql.query(`SELECT * FROM music ORDER BY id ASC LIMIT ${pageSize} offset ${offset}`);
    } else {
        if (filter == 'album') {
        queryData1 = await radioSql.query(`SELECT DISTINCT album FROM music`);
        maxPages = 1;
        }
        else if (filter == 'id') {
        queryData1 = await radioSql.query(`SELECT * FROM music ORDER BY id ASC LIMIT ${pageSize} offset ${offset}`);
        }
        else {
        queryData1 = await radioSql.query(`SELECT * FROM music ORDER BY id ASC LIMIT ${pageSize} offset ${offset}`);
        }
        filterQuery = `&f=${filter}`
    }     

    let htmlString = ''; // Initialize an empty string

    // Iterate through each song in the music list
    if (filter == 'album') {
        queryData1.rows.forEach((song) => {
        href = cryptographyController.encodeName(String(song.album));
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

router.get('/music/:userQuery', async (req, res) => {
    let userQuery = req.params.userQuery;
    if (userQuery) {
        // Sanitize the user input
        userQuery = validator.escape(userQuery);
    }
    const radioSql = await pool_radio.connect();
    if (String(userQuery.length) > 4) {
        const decodedQuery = Buffer.from(userQuery, 'base64').toString('utf-8');
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

router.get('/music/api/addToPlaylist/:songID', async function(req, res) {
    const songID = req.params.songID;
    await radioController.addSongToPlaylist(songID, req)
    radioController.updateQueueClient;
    res.send('Song added to queue.');
  });

module.exports = router;