const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path
const logFile = path.join(logsDir, 'app.log');

// Log levels
const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

// Get current timestamp
function getTimestamp() {
  return new Date().toISOString();
}

// Format log message
function formatLogMessage(level, message) {
  return `[${getTimestamp()}] [${level}] ${message}`;
}

// Write to log file with rotation
function writeToLogFile(message) {
  try {
    // Check if log file exists and get its size
    let stats;
    try {
      stats = fs.statSync(logFile);
    } catch (err) {
      // File doesn't exist, will be created
    }

    // Rotate log if it's larger than 5MB
    if (stats && stats.size > 5 * 1024 * 1024) {
      const backupLogFile = `${logFile}.${getTimestamp().replace(/:/g, '-')}`;
      fs.renameSync(logFile, backupLogFile);
    }

    // Append to log file
    fs.appendFileSync(logFile, message + '\n');
  } catch (err) {
    console.error(`Failed to write to log file: ${err.message}`);
  }
}

// Log functions
function info(message) {
  const formattedMessage = formatLogMessage(LOG_LEVELS.INFO, message);
  console.log(formattedMessage);
  writeToLogFile(formattedMessage);
}

function warn(message) {
  const formattedMessage = formatLogMessage(LOG_LEVELS.WARN, message);
  console.warn(formattedMessage);
  writeToLogFile(formattedMessage);
}

function error(message) {
  const formattedMessage = formatLogMessage(LOG_LEVELS.ERROR, message);
  console.error(formattedMessage);
  writeToLogFile(formattedMessage);
}

module.exports = {
  info,
  warn,
  error,
  LOG_LEVELS
};
