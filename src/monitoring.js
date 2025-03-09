const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const config = require('./config');
const logger = require('./utils/logger');

const SUBSCRIBERS_FILE = path.join(__dirname, '../data', 'subscribers.json');

// Send alert notification
async function sendAlert(message) {
  try {
    logger.info(`Sending alert: ${message}`);
    
    await fetch(`https://ntfy.sh/${config.notifications.alertTopic}`, {
      method: 'POST',
      body: message,
      headers: {
        'Title': 'RSS Service Alert',
        'Priority': 'high'
      }
    });
    
    logger.info(`Alert sent: ${message}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send alert: ${error.message}`);
    return false;
  }
}

// Update the health check timestamp
function updateHealthCheckTimestamp() {
  try {
    const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
    data.stats.lastHealthCheckPassed = new Date().toISOString();
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2));
    logger.info('Updated health check timestamp');
    return true;
  } catch (error) {
    logger.error(`Failed to update health check timestamp: ${error.message}`);
    return false;
  }
}

// Check if service is running regularly
function checkServiceHealth() {
  try {
    const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
    
    // Skip the check if this is the first run (no timestamp yet)
    if (!data.stats || !data.stats.lastHealthCheckPassed) {
      logger.info('No previous health check found - assuming this is the first run');
      // Update the timestamp so future checks work correctly
      updateHealthCheckTimestamp();
      return true;
    }
    
    const lastHealthCheck = new Date(data.stats.lastHealthCheckPassed);
    const hoursSinceLastHealthCheck = (Date.now() - lastHealthCheck.getTime()) / (1000 * 60 * 60);
    
    logger.info(`Hours since last health check: ${hoursSinceLastHealthCheck.toFixed(2)}`);
    
    if (hoursSinceLastHealthCheck > config.healthCheck.maxHoursBetweenRuns) {
      sendAlert(`RSS service hasn't run successfully in the last ${config.healthCheck.maxHoursBetweenRuns} hours`);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    sendAlert(`Health check failed: ${error.message}`);
    return false;
  }
}

// Start health check monitoring
function startHealthCheck() {
  logger.info('Starting health check monitoring');
  
  // Run health check immediately
  checkServiceHealth();
  
  // Run health check every hour
  setInterval(checkServiceHealth, 60 * 60 * 1000);
}

module.exports = {
  sendAlert,
  updateHealthCheckTimestamp,
  checkServiceHealth,
  startHealthCheck
};
