const { Worker, parentPort } = require('worker_threads');
const net = require('net');

const port = 55063;

const server = net.createServer((socket) => {

    socket.on('data', (data) => {
        const strData = data.toString();
        // Send the received data to the main thread
        parentPort.postMessage(strData);
    });

    //socket.on('end', () => {

    //});

    socket.on('error', (error) => {
        console.log(`Socket Error: ${error.message}`);
    });
});

server.on('error', (error) => {
    console.log(`Server Error: ${error.message}`);
});

server.listen(port, () => {
    console.log(`TCP socket server is running on port: ${port}`);
});
