const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const config = require('./config');
const logger = require('./utils/logger');

// Path to subscribers data file
const SUBSCRIBERS_FILE = path.join(__dirname, '../data', 'subscribers.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize subscribers file if it doesn't exist
if (!fs.existsSync(SUBSCRIBERS_FILE)) {
  const initialData = {
    subscribers: [],
    lastPost: null,
    stats: {
      totalEmailsSent: 0,
      lastRunAt: null,
      lastHealthCheckPassed: null
    }
  };
  
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(initialData, null, 2));
  logger.info('Initialized subscribers file');
}

// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Subscribe to the ntfy.sh topic for new subscription requests
async function listenForSubscriptions() {
  logger.info('Starting subscription listener...');
  
  try {
    const response = await fetch(`https://ntfy.sh/${config.notifications.subscribeTopic}/sse`);
    
    if (!response.ok) {
      throw new Error(`Failed to connect to ntfy.sh: ${response.status} ${response.statusText}`);
    }
    
    const reader = response.body.getReader();
    
    // Process the SSE stream
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const message = new TextDecoder().decode(value);
      // ntfy.sh SSE messages contain multiple lines
      if (message.includes('event: message')) {
        // Extract the email from the message
        const emailMatch = message.match(/data: (.+@.+\..+)/);
        if (emailMatch && emailMatch[1]) {
          const email = emailMatch[1].trim();
          // Validate and add the subscriber
          if (isValidEmail(email)) {
            await addSubscriber(email);
            logger.info(`New subscriber added: ${email}`);
          } else {
            logger.warn(`Invalid email received: ${email}`);
          }
        }
      }
    }
  } catch (error) {
    logger.error(`Subscription listener error: ${error.message}`);
    const monitoring = require('./monitoring');
    monitoring.sendAlert(`Subscription listener error: ${error.message}`);
    // Attempt to restart the listener after a delay
    setTimeout(listenForSubscriptions, 10000);
  }
}

// Listen for unsubscribe requests
async function listenForUnsubscribes() {
  logger.info('Starting unsubscribe listener...');
  
  try {
    const response = await fetch(`https://ntfy.sh/${config.notifications.unsubscribeTopic}/sse`);
    
    if (!response.ok) {
      throw new Error(`Failed to connect to ntfy.sh: ${response.status} ${response.statusText}`);
    }
    
    const reader = response.body.getReader();
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const message = new TextDecoder().decode(value);
      if (message.includes('event: message')) {
        // Extract the token from the message
        const tokenMatch = message.match(/data: (.+)/);
        if (tokenMatch && tokenMatch[1]) {
          const token = tokenMatch[1].trim();
          // Process the unsubscribe
          const success = await removeSubscriber(token);
          logger.info(`Unsubscribe request for token ${token}: ${success ? 'successful' : 'not found'}`);
        }
      }
    }
  } catch (error) {
    logger.error(`Unsubscribe listener error: ${error.message}`);
    const monitoring = require('./monitoring');
    monitoring.sendAlert(`Unsubscribe listener error: ${error.message}`);
    // Attempt to restart the listener after a delay
    setTimeout(listenForUnsubscribes, 10000);
  }
}

// Get all subscribers
function getSubscribers() {
  try {
    const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
    return data.subscribers;
  } catch (error) {
    logger.error(`Failed to get subscribers: ${error.message}`);
    return [];
  }
}

// Add a new subscriber
function addSubscriber(email) {
  try {
    const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
    
    // Check if subscriber already exists
    if (data.subscribers.some(sub => sub.email === email)) {
      logger.info(`Subscriber already exists: ${email}`);
      return false;
    }
    
    // Generate unsubscribe token
    const unsubscribeToken = crypto.randomBytes(32).toString('hex');
    
    // Add new subscriber
    data.subscribers.push({
      email,
      subscribedAt: new Date().toISOString(),
      unsubscribeToken
    });
    
    // Save updated data
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2));
    logger.info(`Added new subscriber: ${email}`);
    return true;
  } catch (error) {
    logger.error(`Failed to add subscriber: ${error.message}`);
    return false;
  }
}

// Remove a subscriber by token
function removeSubscriber(token) {
  try {
    const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
    
    const initialCount = data.subscribers.length;
    data.subscribers = data.subscribers.filter(sub => sub.unsubscribeToken !== token);
    
    // Save updated data if a subscriber was removed
    if (data.subscribers.length < initialCount) {
      fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2));
      logger.info(`Removed subscriber with token: ${token}`);
      return true;
    }
    
    logger.warn(`No subscriber found with token: ${token}`);
    return false;
  } catch (error) {
    logger.error(`Failed to remove subscriber: ${error.message}`);
    return false;
  }
}

// Get the last post information
function getLastPost() {
  try {
    const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
    return data.lastPost;
  } catch (error) {
    logger.error(`Failed to get last post: ${error.message}`);
    return null;
  }
}

// Update the last post information
function updateLastPost(post) {
  try {
    const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
    
    data.lastPost = {
      id: post.id,
      title: post.title,
      publishedAt: post.pubDate,
      emailSentAt: new Date().toISOString()
    };
    
    data.stats.totalEmailsSent += data.subscribers.length;
    data.stats.lastRunAt = new Date().toISOString();
    
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2));
    logger.info(`Updated last post: ${post.title}`);
    return true;
  } catch (error) {
    logger.error(`Failed to update last post: ${error.message}`);
    return false;
  }
}

module.exports = {
  getSubscribers,
  addSubscriber,
  removeSubscriber,
  getLastPost,
  updateLastPost,
  listenForSubscriptions,
  listenForUnsubscribes,
  isValidEmail
};
