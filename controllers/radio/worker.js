const { Worker, parentPort } = require('worker_threads');
const path = require('path');

const workerPath = path.resolve(__dirname, '../../radio_api.js');
console.log(workerPath)
const worker = new Worker(workerPath);
worker.postMessage({ action: 'connect' });

module.exports = worker;