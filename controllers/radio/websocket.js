const WebSocket = require('ws');
const serverController = require('../server/serverController'); // Adjust the path to your server setup
const server = serverController.server
const wss = new WebSocket.Server({ server });

server.listen(55064, () => {
    console.log('Express server with WebSocket listening on port 55064');
  });

module.exports = wss;