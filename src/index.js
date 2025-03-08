const fs = require('fs');
const path = require('path');
const rssParser = require('./rssParser');
const subscriberManager = require('./subscriberManager');
const emailSender = require('./emailSender');
const monitoring = require('./monitoring');
const logger = require('./utils/logger');
const config = require('./config');

// Lock file path for rsspberry2email
const LOCK_FILE = path.join(__dirname, '../data', 'process.lock');

// Main function to check RSS and send emails
async function checkAndSendEmails() {
  logger.info('Starting rsspberry2email check process');
  
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
    logger.info('Fetching latest post from feed');
    const latestPost = await rssParser.fetchLatestPost();
    const lastPost = subscriberManager.getLastPost();
    
    // Determine if there's a new post to send
    if (latestPost && (!lastPost || latestPost.id !== lastPost.id)) {
      logger.info(`Detected post: ${latestPost.title}`);
      
      if (!lastPost) {
        // If there's no last post record, this is likely a first run or after database reset
        // Just save this as the latest post without sending emails
        logger.info('No previous post record found. Storing current post without sending emails.');
        subscriberManager.updateLastPost(latestPost);
      } else {
        // Check the published dates to determine if it's truly a new post
        const latestPostDate = new Date(latestPost.pubDate);
        const lastPostDate = new Date(lastPost.publishedAt);
        
        // Only consider it a new post if it was published AFTER the previously recorded post
        // Use a small buffer (e.g., 1 minute) to handle slight timestamp variations
        const isNewerPost = latestPostDate > new Date(lastPostDate.getTime() + 60000);
        
        if (isNewerPost) {
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
          }
          
          // Update last post information
          subscriberManager.updateLastPost(latestPost);
        } else {
          logger.info(`Post "${latestPost.title}" is not newer than the last processed post. Skipping email.`);
          
          // Still update the record if the ID is different but date is not newer
          // This handles cases where the CMS updates post IDs without changing content
          subscriberManager.updateLastPost(latestPost);
        }
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
    logger.error(`Error in rsspberry2email check process: ${error.message}`);
    monitoring.sendAlert(`rsspberry2email check process failed: ${error.message}`);
    
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

// Initialize dashboard server if not in cron mode
if (process.env.CRON_MODE !== 'true') {
  logger.info('Starting monitoring dashboard');
  const dashboard = require('./dashboard');
  dashboard.startDashboard(3000);
}

// Run the rsspberry2email check immediately on startup
logger.info('Running initial rsspberry2email check');
checkAndSendEmails();

// Setup scheduled checks based on config
const checkIntervalMs = config.rss.checkIntervalHours * 60 * 60 * 1000;
setInterval(checkAndSendEmails, checkIntervalMs);
logger.info(`Scheduled rsspberry2email checks every ${config.rss.checkIntervalHours} hour(s)`);

// Export for testing purposes
module.exports = {
  checkAndSendEmails
};
