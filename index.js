const express = require('express');
const { app } = require('./controllers/server/serverController')
const { Pool } = require('pg');
const http = require('http');
const config = require('./config/config'); // Import the configuration
const config_radio = require('./config/configRadio'); // Import the configuration
const config_mcRcon = require('./config/configMcRcon');
const wss = require('./controllers/radio/websocket')
const worker = require('./controllers/radio/worker')
const {getCurrentPlayingSong, updateQueueClient} = require('./controllers/radio/radioController')
const mainRoutes = require('./routes/main/main');
const loginRoutes = require('./routes/login/login');
const registerRoutes = require('./routes/register/register');
const logoutRoutes = require('./routes/logout/logout');
const radioRoutes = require('./routes/radio/radio');
const fileRoutes = require('./routes/files/files');
const profileRoutes = require('./routes/profile/profile');
app.use(express.json());
app.use('/', mainRoutes);
app.use('/login', loginRoutes);
app.use('/register', registerRoutes);
app.use('/logout', logoutRoutes);
app.use('/radio', radioRoutes);
app.use('/files', fileRoutes)
app.use('/profile', profileRoutes)





// WebSocket connection event
wss.on('connection', async (ws) => {

  // Send the current song to the newly connected client
  const currentSong = await getCurrentPlayingSong();
  await updateQueueClient()
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


const PORT = process.env.PORT || 42125;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
