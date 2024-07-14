//file stuff
const { Pool } = require('pg');
const dbConfig = require('../../config/config'); // Adjust the path to your database connection
const path = require('path');
const fs = require('fs'); // For createReadStream
const fsp = require('fs').promises; // For promise-based operations
const pool = new Pool(dbConfig); // Use the configuration to create the pool

exports.generateUserFolders = async () => {
    const client = await pool.connect();
    try {
      let users = await client.query('SELECT * FROM users WHERE confirmed = true');
      for (let user of users.rows) {
        // Generate a unique folder name, e.g., using the user ID
        const folderName = `${user.username}`;
        const folderPath = path.join('G:/website', folderName);
  
        // Create the folder if it doesn't exist
        await fsp.mkdir(folderPath, { recursive: true }); // No callback needed here
        console.log(`Folder created for user ${user.id}: ${folderPath}`);
      }
    } catch (error) {
      console.error('Error generating user folders:', error);
    } finally {
      client.release();
    }
}

exports.getUserStorageUsage = async (directoryPath) => {
    const files = await fsp.readdir(directoryPath);
    let totalSize = 0;
  
    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = await fsp.stat(filePath);
        totalSize += stats.size;
    }
  
    // Convert bytes to gigabytes
    const totalSizeGB = totalSize / (1024 * 1024 * 1024);
    return totalSizeGB;
};

