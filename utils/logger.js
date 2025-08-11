// utils/logger.js

const fs = require('fs');
const path = require('path');

// Create or get the log file
const logFilePath = path.join(__dirname, 'app.log');

// Function to log messages
const log = (level, message) => {
  const time = new Date().toISOString();
  const logMsg = `[${time}] ${level.toUpperCase()}: ${message}\n`;

  // Save to file
  fs.appendFileSync(logFilePath, logMsg);

  // Also print to console
  console.log(logMsg.trim());
};

// Export functions to use in your app
module.exports = {
  info: (msg) => log('info', msg),
  error: (msg) => log('error', msg),
  warn: (msg) => log('warn', msg),
};
