const fs = require('fs');
const path = require('path');
const rssParser = require('./rssParser');
const subscriberManager = require('./subscriberManager');
const emailSender = require('./emailSender');
const monitoring = require('./monitoring');
const logger = require('./utils/logger');
const config = require('./config');

// Lock file path
const LOCK_FILE = path.join(__dirname, '../data', 'process.lock');

// Main function to check RSS and send emails
async function checkAndSendEmails() {
  logger.info('Starting RSS check process');
  
  // Check if another process is running
  if (fs.existsSync(LOCK_FILE)) {
    const lockData = fs.readFileSync(LOCK_FILE, 'utf8');
    const lockTime = new Date(lockData);
    const minutesSinceLock = (Date.now() - lockTime.getTime()) / (1000 * 60);
    
    // If lock is older than 30 minutes, assume it's stale and proceed
    if (minutesSinceLock < 30) {
      logger.info('Another process is already running, exiting');
      return;
    }
    logger.warn(`Found stale lock file (${minutesSinceLock.toFixed(2)} minutes old), proceeding`);
  }
  
  // Create lock file
  fs.writeFileSync(LOCK_FILE, new Date().toISOString());
  logger.info('Created lock file');
  
  try {
    // Check RSS feed for new posts
    logger.info('Fetching latest post from RSS feed');
    const latestPost = await rssParser.fetchLatestPost();
    const lastPost = subscriberManager.getLastPost();
    
    // Determine if there's a new post to send
    if (latestPost && (!lastPost || latestPost.id !== lastPost.id)) {
      logger.info(`New post detected: ${latestPost.title}`);
      
      // Get subscribers
      const subscribers = subscriberManager.getSubscribers();
      if (subscribers.length === 0) {
        logger.info('No subscribers to send to');
      } else {
        // Send emails
        logger.info(`Sending emails to ${subscribers.length} subscribers`);
        await emailSender.sendNewPostEmail(subscribers, latestPost);
        logger.info(`Email sending complete`);
        
        // Update last post information
        subscriberManager.updateLastPost(latestPost);
      }
    } else {
      logger.info('No new posts found');
    }
    
    // Update health check timestamp
    monitoring.updateHealthCheckTimestamp();
    
    // Remove the lock file
    fs.unlinkSync(LOCK_FILE);
    logger.info('Removed lock file');
  } catch (error) {
    logger.error(`Error in RSS check process: ${error.message}`);
    monitoring.sendAlert(`RSS check process failed: ${error.message}`);
    
    // Make sure to remove the lock file even if there's an error
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
      logger.info('Removed lock file after error');
    }
  }
}

// Start subscription listener
logger.info('Starting subscription and unsubscribe listeners');
subscriberManager.listenForSubscriptions();

// Start unsubscribe listener
subscriberManager.listenForUnsubscribes();

// Start health check monitoring
monitoring.startHealthCheck();

// Initialize backup if enabled
if (config.backup.enabled) {
  logger.info('Initializing Google Drive backup');
  const backup = require('./backup');
  backup.startBackupSchedule();
}

// Start dashboard server if not running in cron mode
if (process.env.CRON_MODE !== 'true') {
  logger.info('Starting monitoring dashboard');
  const dashboard = require('./dashboard');
  dashboard.startDashboard(3000);
}

// Run the RSS check immediately on startup
logger.info('Running initial RSS check');
checkAndSendEmails();

// Export for testing purposes
module.exports = {
  checkAndSendEmails
};
