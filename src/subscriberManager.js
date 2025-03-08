const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const EventSource = require('eventsource');
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

// Subscription listener using EventSource (proper SSE client)
function listenForSubscriptions() {
  logger.info('Starting subscription listener...');
  
  // Create an SSE client using eventsource package
  const source = new EventSource(`https://ntfy.sh/${config.notifications.subscribeTopic}/sse`);
  
  // Handle messages
  source.onmessage = async (event) => {
    try {
      const data = event.data;
      
      // Check if it looks like an email
      if (data && data.includes('@')) {
        const email = data.trim();
        
        // Validate and add the subscriber
        if (isValidEmail(email)) {
          await addSubscriber(email);
          logger.info(`New subscriber added: ${email}`);
        } else {
          logger.warn(`Invalid email received: ${email}`);
        }
      }
    } catch (error) {
      logger.error(`Error processing subscription message: ${error.message}`);
    }
  };
  
  // Handle errors
  source.onerror = (error) => {
    logger.error(`Subscription listener error: ${error.message || 'Unknown error'}`);
    
    // Don't send alert for each error, just close and restart after a delay
    source.close();
    
    const monitoring = require('./monitoring');
    monitoring.sendAlert(`Subscription listener disconnected. Reconnecting...`);
    
    // Restart the listener after a delay
    setTimeout(listenForSubscriptions, 10000);
  };
  
  // Handle connection open
  source.onopen = () => {
    logger.info('Subscription listener connected successfully');
  };
  
  return source; // Return the source so it can be closed if needed
}

// Unsubscribe listener using EventSource
function listenForUnsubscribes() {
  logger.info('Starting unsubscribe listener...');
  
  // Create an SSE client using eventsource package
  const source = new EventSource(`https://ntfy.sh/${config.notifications.unsubscribeTopic}/sse`);
  
  // Handle messages
  source.onmessage = async (event) => {
    try {
      const token = event.data.trim();
      
      if (token) {
        // Process the unsubscribe
        const success = await removeSubscriber(token);
        logger.info(`Unsubscribe request for token ${token}: ${success ? 'successful' : 'not found'}`);
      }
    } catch (error) {
      logger.error(`Error processing unsubscribe message: ${error.message}`);
    }
  };
  
  // Handle errors
  source.onerror = (error) => {
    logger.error(`Unsubscribe listener error: ${error.message || 'Unknown error'}`);
    
    // Don't send alert for each error, just close and restart after a delay
    source.close();
    
    const monitoring = require('./monitoring');
    monitoring.sendAlert(`Unsubscribe listener disconnected. Reconnecting...`);
    
    // Restart the listener after a delay
    setTimeout(listenForUnsubscribes, 10000);
  };
  
  // Handle connection open
  source.onopen = () => {
    logger.info('Unsubscribe listener connected successfully');
  };
  
  return source; // Return the source so it can be closed if needed
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