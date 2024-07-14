const { Pool } = require('pg');
const config_radio = require('../../config/configRadio'); // Import the configuration
const pool_radio = new Pool(config_radio);
const wss = require('./websocket');
const authController = require('../access/authentication'); // Adjust the path to your auth controller

const getSong = async (id) => {
  const client = await pool_radio.connect();
  const resultSong = await client.query('SELECT * FROM music WHERE id = $1', [id]);
  const song = resultSong.rows[0];
  client.release();
  return song;
};

const addSongToPlaylist = async (id, req) => {
  if (await authController.handleAuth(req)) {
    const client = await pool_radio.connect();
    const resultSong = await client.query('SELECT * FROM music WHERE id = $1', [id]);
    const songID = resultSong.rows[0]["id"];
    await client.query('INSERT INTO playlist(song_id, added_by_user) VALUES($1, $2)', [id, req.session.username]);
    client.release();
    await updateQueueClient();
    return true;
  } else {
    return false;
  }
};

const updateQueueClient = async () => {
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
};

const getCurrentPlayingSong = async () => {
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

module.exports = { getSong, addSongToPlaylist, getCurrentPlayingSong, updateQueueClient };