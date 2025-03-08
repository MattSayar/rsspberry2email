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
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

// Subscribe to the ntfy.sh topic for new subscription requests
async function listenForSubscriptions() {
  logger.info('Starting subscription listener...');
  
  try {
    const response = await fetch(`https://ntfy.sh/${config.notifications.subscribeTopic}/sse`);
    
    if (!response.ok) {
      throw new Error(`Failed to connect to ntfy.sh: ${response.status} ${response.statusText}`);
    }
    
    logger.info('Subscription listener connected successfully');
    
    // Use a different approach to read the stream
    response.body.on('data', (chunk) => {
      const message = chunk.toString();
      logger.debug(`Received message: ${message}`);
      
      // Check if it starts with "data: " and contains JSON
      if (message.trim().startsWith('data:')) {
        try {
          // Extract everything after "data: "
          const jsonStr = message.trim().substring(6);
          logger.debug(`Extracted JSON: ${jsonStr}`);
          
          const jsonData = JSON.parse(jsonStr);
          logger.debug(`Parsed JSON: ${JSON.stringify(jsonData)}`);
          
          if (jsonData.message) {
            const email = jsonData.message;
            logger.debug(`Found email: ${email}`);
            
            if (isValidEmail(email)) {
              const result = addSubscriber(email);
              logger.debug(`Added subscriber result: ${result}`);
            } else {
              logger.warn(`Invalid email format: ${email}`);
            }
          } else {
            logger.warn(`No message field in JSON: ${JSON.stringify(jsonData)}`);
          }
        } catch (error) {
          logger.error(`Error processing message: ${error.message}`);
        }
      }
    });
    
    // Handle end of stream
    response.body.on('end', () => {
      logger.warn('Subscription listener stream ended');
      // Restart the listener
      setTimeout(listenForSubscriptions, 10000);
    });
    
    // Handle errors
    response.body.on('error', (error) => {
      logger.error(`Subscription listener stream error: ${error.message}`);
      // Restart the listener
      setTimeout(listenForSubscriptions, 10000);
    });
    
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
    
    logger.info('Unsubscribe listener connected successfully');
    
    response.body.on('data', (chunk) => {
      const message = chunk.toString();
      
      // Skip logging for keepalive events
      if (!message.includes('event: keepalive')) {
        logger.debug(`Received message: ${message}`);
      }
      
      if (message.includes('message')) {
        try {          
          // Direct regex extraction - as simple as possible
          const tokenMatch = message.match(/"message":"([^"]+)"/);
          
          if (tokenMatch && tokenMatch[1]) {
            const token = tokenMatch[1];
            logger.debug(`Extracted token: ${token}`);
            
            // Handle the unsubscribe
            const success = directUnsubscribe(token);
            logger.info(`Unsubscribe result: ${success ? 'SUCCESS' : 'FAILED'}`);
          } else {
            logger.warn('Could not extract token from message');
          }
        } catch (error) {
          logger.error(`Error handling unsubscribe: ${error.message}`);
        }
      }
    });
    
    // Handle stream end and errors
    response.body.on('end', () => {
      logger.warn('Unsubscribe listener stream ended');
      setTimeout(listenForUnsubscribes, 5000);
    });
    
    response.body.on('error', (error) => {
      logger.error(`Unsubscribe listener stream error: ${error.message}`);
      setTimeout(listenForUnsubscribes, 5000);
    });
    
  } catch (error) {
    logger.error(`Unsubscribe listener connection error: ${error.message}`);
    const monitoring = require('./monitoring');
    monitoring.sendAlert(`Unsubscribe listener error: ${error.message}`);
    setTimeout(listenForUnsubscribes, 5000);
  }
}

// Direct unsubscribe with maximum safety
function directUnsubscribe(token) {
  try {
    logger.info(`Starting direct unsubscribe for token: ${token}`);
    
    // Read file and create backup
    const fileContents = fs.readFileSync(SUBSCRIBERS_FILE, 'utf8');
    fs.writeFileSync(`${SUBSCRIBERS_FILE}.bak`, fileContents);
    logger.debug('Created backup file');
    
    // Parse data
    let data;
    try {
      data = JSON.parse(fileContents);
      logger.debug(`Parsed subscribers data with ${data.subscribers.length} subscribers`);
    } catch (parseError) {
      logger.error(`Failed to parse JSON: ${parseError.message}`);
      return false;
    }
    
    // Find and remove subscriber
    const initialCount = data.subscribers.length;
    const subscriberIndex = data.subscribers.findIndex(sub => sub.unsubscribeToken === token);
    
    if (subscriberIndex !== -1) {
      // Found the subscriber - log and remove
      const subscriber = data.subscribers[subscriberIndex];
      logger.debug(`Found subscriber at index ${subscriberIndex}: ${subscriber.email}`);
      
      // Remove subscriber
      data.subscribers.splice(subscriberIndex, 1);
      logger.debug(`Removed subscriber from array, new count: ${data.subscribers.length}`);
      
      // Write to temporary file first, then rename for atomic write
      const tempFile = `${SUBSCRIBERS_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
      fs.renameSync(tempFile, SUBSCRIBERS_FILE);
      
      logger.debug('Successfully saved updated subscribers file');
      return true;
    } else {
      logger.warn(`No subscriber found with token: ${token}`);
      return false;
    }
  } catch (error) {
    logger.error(`Direct unsubscribe error: ${error.message}`);
    return false;
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
      logger.debug(`Removed subscriber with token: ${token}`);
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