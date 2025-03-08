# RSS-to-Email Service Specification

## Overview
A lightweight service that monitors an RSS feed (mattsayar.com/feed.xml) for new content and emails subscribers when new posts are published. The service also manages email subscriptions through a simple form that can be embedded on the website, with a Cloudflare Worker acting as a secure proxy for subscription requests.

## Core Requirements

### Subscriber Management
- Store subscriber email addresses in a local JSON file on a Raspberry Pi
- Support adding new subscribers via a form on the website that communicates through a Cloudflare Worker
- Implement one-click unsubscribe functionality
- Include basic spam protection with IP rate limiting and email validation

### RSS Monitoring
- Check the RSS feed hourly via a cron job
- Parse the feed to identify the most recent post
- Determine if the post is new since the last email was sent
- Prevent duplicate emails with a simple lock file mechanism

### Email Distribution
- Send HTML emails with basic dark mode styling
- Include post title, OG image, and link to the full post
- Use SendGrid API for email delivery
- No tracking or analytics in emails

### Notifications & Logging
- Use ntfy.sh for system alerts (RSS feed errors, email sending failures)
- Use ntfy.sh for receiving subscription requests from the Cloudflare Worker
- Implement moderate logging (successful operations and errors)
- Basic health monitoring to ensure the service is running regularly

### Backup (Optional)
- Periodically back up the subscribers JSON file to Google Drive
- Implement as an optional module that doesn't affect core functionality

## Technical Architecture

### Components
1. **Subscription Proxy (Cloudflare Worker)**
   - Receives subscription requests from the website form
   - Validates email format and applies rate limiting
   - Forwards valid requests to a private ntfy.sh topic

2. **Subscriber Management Module**
   - Listens to ntfy.sh topic for new subscription requests
   - JSON file storage for email addresses
   - Validation and anti-spam measures
   - Unsubscription handlers

3. **RSS Parser Module**
   - Feed fetching and parsing
   - New content detection logic
   - Lock file mechanism to prevent duplicate processing

4. **Email Sender Module**
   - SendGrid API integration
   - Email template with dark mode styling
   - Unsubscribe link generation

5. **Monitoring & Logging Module**
   - ntfy.sh integration for alerts
   - Local logging with rotation
   - Health check to verify service is running regularly

6. **Backup Module (Optional)**
   - Google Drive API integration
   - Scheduled backup functionality

### Data Structure
```json
{
  "subscribers": [
    {
      "email": "user@example.com",
      "subscribedAt": "2025-03-06T12:00:00Z",
      "unsubscribeToken": "unique-token-123"
    }
  ],
  "lastPost": {
    "id": "https://mattsayar.com/posts/last-post-id",
    "title": "Last Post Title",
    "publishedAt": "2025-03-05T10:30:00Z",
    "emailSentAt": "2025-03-05T11:00:00Z"
  },
  "stats": {
    "totalEmailsSent": 42,
    "lastRunAt": "2025-03-06T11:00:00Z",
    "lastHealthCheckPassed": "2025-03-06T11:00:00Z"
  }
}
```

### Anti-Spam Measures
- Rate limit: Maximum 5 subscription attempts per hour from the same IP (enforced by Cloudflare Worker)
- Email validation: Format check and basic domain validation
- Honeypot field: Hidden form field to catch automated submissions

## Implementation Details

### Cloudflare Worker (subscribe-proxy.js)
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  
  // Get the email from the request
  const email = await request.text()
  
  // Basic email validation
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return new Response('Invalid email format', { status: 400 })
  }
  
  // Rate limiting using Cloudflare's built-in features
  const ip = request.headers.get('CF-Connecting-IP')
  
  // Implement rate limiting
  const { success } = await checkRateLimit(ip)
  if (!success) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Too many attempts. Please try again later.' 
    }), { 
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Check for honeypot field (passed as a header)
  const honeypot = request.headers.get('X-Honeypot')
  if (honeypot && honeypot !== '') {
    // Silently accept but don't process bot submissions
    return new Response('Subscription received', { status: 200 })
  }
  
  // Forward to ntfy.sh with the secret topic
  try {
    // The actual topic would be stored as an environment variable in production
    const SECRET_TOPIC = NTFY_SUBSCRIBE_TOPIC // Set as environment variable in Cloudflare
    
    const ntfyResponse = await fetch(`https://ntfy.sh/${SECRET_TOPIC}`, {
      method: 'POST',
      body: email,
      headers: {
        'Title': 'New Subscription Request',
        'Priority': 'default'
      }
    })
    
    if (ntfyResponse.ok) {
      return new Response(JSON.stringify({ success: true, message: 'Subscription received' }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({ success: false, message: 'Subscription service error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: 'Internal error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Rate limiting implementation using Cloudflare's KV store
async function checkRateLimit(ip) {
  // For a small project, we could use the simplest approach
  const namespace = RATE_LIMIT_NAMESPACE // Set as environment binding in Cloudflare
  const key = `subscribe:${ip}`
  
  // Get current attempts
  const data = await namespace.get(key, { type: 'json' }) || { attempts: 0, timestamp: Date.now() }
  
  // Reset counter if it's been more than an hour
  if (Date.now() - data.timestamp > 3600000) {
    data.attempts = 0
    data.timestamp = Date.now()
  }
  
  // Increment attempts
  data.attempts++
  
  // Store updated value (1 hour TTL)
  await namespace.put(key, JSON.stringify(data), { expirationTtl: 3600 })
  
  // Check if over limit
  return { success: data.attempts <= 5 }
}
```

### Subscription Form HTML
```html
<form id="newsletter-signup" onsubmit="subscribeUser(event)">
  <h3>Subscribe to new posts</h3>
  <input type="email" id="email" placeholder="Your email address" required>
  <input type="text" id="honeypot" name="honeypot" style="display:none">
  <button type="submit">Subscribe</button>
  <p class="form-message"></p>
</form>

<script>
  function subscribeUser(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const honeypot = document.getElementById('honeypot').value;
    const formMessage = document.querySelector('.form-message');
    
    fetch('https://mattsayar.com/api/subscribe', {
      method: 'POST',
      body: email,
      headers: {
        'X-Honeypot': honeypot
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        formMessage.textContent = "Thanks for subscribing! You'll receive new post notifications soon.";
        document.getElementById('email').value = '';
      } else {
        formMessage.textContent = data.message || "Something went wrong. Please try again later.";
      }
    })
    .catch(error => {
      formMessage.textContent = "Something went wrong. Please try again later.";
      console.error('Error:', error);
    });
  }
</script>
```

### Raspberry Pi Configuration
```javascript
// config.js
module.exports = {
  rss: {
    feedUrl: 'https://mattsayar.com/feed.xml',
    checkIntervalHours: 1
  },
  email: {
    from: 'updates@mattsayar.com',
    subject: 'New Post on Matt Sayar\'s Blog',
    sendgridApiKey: process.env.SENDGRID_API_KEY // Read from environment variable
  },
  notifications: {
    alertTopic: process.env.NTFY_ALERT_TOPIC,
    subscribeTopic: process.env.NTFY_SUBSCRIBE_TOPIC,
    unsubscribeTopic: process.env.NTFY_UNSUBSCRIBE_TOPIC,
    ntfyPriority: 3 // default priority
  },
  healthCheck: {
    maxHoursBetweenRuns: 3, // Alert if service hasn't run for this many hours
  },
  backup: {
    enabled: false, // optional feature
    googleDriveCredentialsPath: './credentials.json',
    backupIntervalHours: 24
  }
};
```

### Main Service (index.js)
```javascript
const fs = require('fs');
const path = require('path');
const rssParser = require('./rssParser');
const subscriberManager = require('./subscriberManager');
const emailSender = require('./emailSender');
const monitoring = require('./monitoring');
const config = require('./config');

// Lock file path
const LOCK_FILE = path.join(__dirname, 'data', 'process.lock');

// Main function to check RSS and send emails
async function checkAndSendEmails() {
  // Check if another process is running
  if (fs.existsSync(LOCK_FILE)) {
    const lockData = fs.readFileSync(LOCK_FILE, 'utf8');
    const lockTime = new Date(lockData);
    const minutesSinceLock = (Date.now() - lockTime.getTime()) / (1000 * 60);
    
    // If lock is older than 30 minutes, assume it's stale and proceed
    if (minutesSinceLock < 30) {
      console.log('Another process is already running, exiting');
      return;
    }
    console.log('Found stale lock file, proceeding');
  }
  
  // Create lock file
  fs.writeFileSync(LOCK_FILE, new Date().toISOString());
  
  try {
    // Check RSS feed for new posts
    const latestPost = await rssParser.fetchLatestPost();
    const lastPost = subscriberManager.getLastPost();
    
    // Determine if there's a new post to send
    if (latestPost && (!lastPost || latestPost.id !== lastPost.id)) {
      console.log(`New post detected: ${latestPost.title}`);
      
      // Get subscribers
      const subscribers = subscriberManager.getSubscribers();
      if (subscribers.length === 0) {
        console.log('No subscribers to send to');
      } else {
        // Send emails
        await emailSender.sendNewPostEmail(subscribers, latestPost);
        console.log(`Email sent to ${subscribers.length} subscribers`);
        
        // Update last post information
        subscriberManager.updateLastPost(latestPost);
      }
    } else {
      console.log('No new posts found');
    }
    
    // Update health check timestamp
    monitoring.updateHealthCheckTimestamp();
    
    // Remove the lock file
    fs.unlinkSync(LOCK_FILE);
  } catch (error) {
    console.error('Error in RSS check process:', error);
    monitoring.sendAlert(`RSS check process failed: ${error.message}`);
    
    // Make sure to remove the lock file even if there's an error
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  }
}

// Start subscription listener
subscriberManager.listenForSubscriptions();

// Start unsubscribe listener
subscriberManager.listenForUnsubscribes();

// Run the RSS check immediately on startup
checkAndSendEmails();

// Setup the health check
monitoring.startHealthCheck();

// Export for testing purposes
module.exports = {
  checkAndSendEmails
};
```

### Monitoring Module
```javascript
// monitoring.js
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const config = require('./config');

const SUBSCRIBERS_FILE = path.join(__dirname, 'data', 'subscribers.json');

// Send alert notification
async function sendAlert(message) {
  try {
    await fetch(`https://ntfy.sh/${config.notifications.alertTopic}`, {
      method: 'POST',
      body: message,
      headers: {
        'Title': 'RSS Service Alert',
        'Priority': 'high'
      }
    });
    console.log(`Alert sent: ${message}`);
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}

// Update the health check timestamp
function updateHealthCheckTimestamp() {
  try {
    const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
    data.stats.lastHealthCheckPassed = new Date().toISOString();
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to update health check timestamp:', error);
  }
}

// Check if service is running regularly
function checkServiceHealth() {
  try {
    const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
    const lastHealthCheck = new Date(data.stats.lastHealthCheckPassed || 0);
    const hoursSinceLastHealthCheck = (Date.now() - lastHealthCheck.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastHealthCheck > config.healthCheck.maxHoursBetweenRuns) {
      sendAlert(`RSS service hasn't run successfully in the last ${config.healthCheck.maxHoursBetweenRuns} hours`);
    }
  } catch (error) {
    console.error('Health check failed:', error);
    sendAlert(`Health check failed: ${error.message}`);
  }
}

// Start health check monitoring
function startHealthCheck() {
  // Run health check every hour
  setInterval(checkServiceHealth, 60 * 60 * 1000);
}

module.exports = {
  sendAlert,
  updateHealthCheckTimestamp,
  startHealthCheck
};
```

### Subscriber Management Module
```javascript
// subscriberManager.js
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const monitoring = require('./monitoring');

const SUBSCRIBERS_FILE = path.join(__dirname, 'data', 'subscribers.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize subscribers file if it doesn't exist
if (!fs.existsSync(SUBSCRIBERS_FILE)) {
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify({
    subscribers: [],
    lastPost: null,
    stats: {
      totalEmailsSent: 0,
      lastRunAt: null,
      lastHealthCheckPassed: null
    }
  }, null, 2));
}

// Subscribe to the ntfy.sh topic for new subscription requests
async function listenForSubscriptions() {
  console.log('Starting subscription listener...');
  
  try {
    const response = await fetch(`https://ntfy.sh/${config.notifications.subscribeTopic}/sse`);
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
            console.log(`New subscriber added: ${email}`);
          } else {
            console.log(`Invalid email received: ${email}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Subscription listener error:', error);
    monitoring.sendAlert(`Subscription listener error: ${error.message}`);
    // Attempt to restart the listener after a delay
    setTimeout(listenForSubscriptions, 10000);
  }
}

// Listen for unsubscribe requests
async function listenForUnsubscribes() {
  console.log('Starting unsubscribe listener...');
  
  try {
    const response = await fetch(`https://ntfy.sh/${config.notifications.unsubscribeTopic}/sse`);
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
          console.log(`Unsubscribe request for token ${token}: ${success ? 'successful' : 'not found'}`);
        }
      }
    }
  } catch (error) {
    console.error('Unsubscribe listener error:', error);
    monitoring.sendAlert(`Unsubscribe listener error: ${error.message}`);
    // Attempt to restart the listener after a delay
    setTimeout(listenForUnsubscribes, 10000);
  }
}

// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Add a new subscriber
async function addSubscriber(email) {
  const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  
  // Check if subscriber already exists
  if (data.subscribers.some(sub => sub.email === email)) {
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
  return true;
}

// Get all subscribers
function getSubscribers() {
  const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  return data.subscribers;
}

// Remove a subscriber by token
function removeSubscriber(token) {
  const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  
  const initialCount = data.subscribers.length;
  data.subscribers = data.subscribers.filter(sub => sub.unsubscribeToken !== token);
  
  // Save updated data if a subscriber was removed
  if (data.subscribers.length < initialCount) {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2));
    return true;
  }
  
  return false;
}

// Update the last post information
function updateLastPost(post) {
  const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  
  data.lastPost = {
    id: post.guid || post.link,
    title: post.title,
    publishedAt: post.pubDate,
    emailSentAt: new Date().toISOString()
  };
  
  data.stats.totalEmailsSent += data.subscribers.length;
  data.stats.lastRunAt = new Date().toISOString();
  
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2));
}

// Get the last post information
function getLastPost() {
  const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  return data.lastPost;
}

module.exports = {
  listenForSubscriptions,
  listenForUnsubscribes,
  addSubscriber,
  getSubscribers,
  removeSubscriber,
  updateLastPost,
  getLastPost
};
```

### RSS Parser Module
```javascript
// rssParser.js
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const config = require('./config');
const monitoring = require('./monitoring');

// Fetch and parse the RSS feed
async function fetchRssFeed() {
  try {
    const response = await fetch(config.rss.feedUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
    }
    
    const xml = await response.text();
    
    // Parse XML to JavaScript object
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xml);
    
    return result;
  } catch (error) {
    monitoring.sendAlert(`RSS feed error: ${error.message}`);
    throw error;
  }
}

// Extract the latest post from the RSS feed
async function fetchLatestPost() {
  const feed = await fetchRssFeed();
  
  if (!feed || !feed.rss || !feed.rss.channel || !feed.rss.channel.item) {
    throw new Error('Invalid RSS feed format');
  }
  
  // Handle both array and single item cases
  const items = Array.isArray(feed.rss.channel.item) 
    ? feed.rss.channel.item 
    : [feed.rss.channel.item];
  
  // Sort by publication date (most recent first)
  items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  // Get the most recent post
  const latestPost = items[0];
  
  // Extract OG image if available
  let ogImage = null;
  if (latestPost.description && latestPost.description.includes('og:image')) {
    const match = latestPost.description.match(/<meta property="og:image" content="([^"]+)"/);
    if (match && match[1]) {
      ogImage = match[1];
    }
  }
  
  return {
    id: latestPost.guid || latestPost.link,
    title: latestPost.title,
    link: latestPost.link,
    pubDate: latestPost.pubDate,
    ogImage: ogImage
  };
}

module.exports = {
  fetchRssFeed,
  fetchLatestPost
};
```

### Email Sender Module
```javascript
// emailSender.js
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const sendgrid = require('@sendgrid/mail');
const config = require('./config');
const monitoring = require('./monitoring');

// Set SendGrid API key
sendgrid.setApiKey(config.email.sendgridApiKey);

// Load email template
const templatePath = path.join(__dirname, 'templates', 'email.html');
const templateSource = fs.readFileSync(templatePath, 'utf8');
const template = Handlebars.compile(templateSource);

// Generate unsubscribe URL
function generateUnsubscribeUrl(token) {
  return `https://ntfy.sh/${config.notifications.unsubscribeTopic}?c=Unsubscribe&t=${encodeURIComponent(token)}&action=view&redirect=https://mattsayar.com/unsubscribed.html`;
}

// Send new post notification emails
async function sendNewPostEmail(subscribers, post) {
  // Create email promises
  const emailPromises = subscribers.map(subscriber => {
    // Render email template
    const html = template({
      postTitle: post.title,
      postImage: post.ogImage || 'https://mattsayar.com/media/website/logo.png',
      postUrl: post.link,
      unsubscribeUrl: generateUnsubscribeUrl(subscriber.unsubscribeToken)
    });
    
    // Create email message
    const message = {
      to: subscriber.email,
      from: config.email.from,
      subject: config.email.subject,
      html: html,
      trackingSettings: {
        clickTracking: { enable: false },
        openTracking: { enable: false }
      }
    };
    
    // Send the email
    return sendgrid.send(message)
      .then(() => ({ success: true, email: subscriber.email }))
      .catch(error => ({ success: false, email: subscriber.email, error }));
  });
  
  // Send all emails
  const results = await Promise.all(emailPromises);
  
  // Check for failures
  const failures = results.filter(result => !result.success);
  if (failures.length > 0) {
    console.error(`Failed to send ${failures.length} emails`);
    if (failures.length > subscribers.length / 2) {
      // Alert if more than half of the emails failed
      monitoring.sendAlert(`Failed to send emails to ${failures.length} of ${subscribers.length} subscribers`);
    }
  }
  
  return results;
}

module.exports = {
  sendNewPostEmail,
  generateUnsubscribeUrl
};
```

## Error Handling

### Critical Errors (Send Notifications)
- RSS feed unavailable or malformed
- SendGrid API errors affecting multiple recipients
- Subscriber file corruption or access issues
- ntfy.sh connection issues
- Service not running for an extended period

### Standard Errors (Log Only)
- Individual email delivery failures
- Temporary network issues
- Invalid subscription attempts

## Testing Plan

### Manual Testing Without Publishing
1. **Test RSS Parsing**:
   - Create a local test RSS file with sample posts
   - Point the service to this file instead of the live feed
   - Validate detection of new posts

2. **Test Email Sending**:
   - Create a test subscriber list with only your email
   - Run the email sending function manually with test post data
   - Verify email formatting and content

3. **Test Subscription System**:
   - Deploy the Cloudflare Worker to a test route
   - Submit test subscriptions through the form
   - Verify subscriber data is correctly stored
   - Test unsubscribe flow via ntfy.sh

4. **Test Duplicate Prevention**:
   - Verify lock file creation and removal
   - Test multiple simultaneous runs to ensure only one proceeds

### Script for Testing Without Live RSS
```javascript
// test-rss-monitor.js
const config = require('./config');
const emailSender = require('./emailSender');
const subscriberManager = require('./subscriberManager');

// Override RSS feed with test data
const testPost = {
  title: 'Test Post Title',
  link: 'https://mattsayar.com/test-post',
  pubDate: new Date().toISOString(),
  ogImage: 'https://mattsayar.com/test-image.jpg'
};

// Send test email to specified address
async function sendTestEmail(emailAddress) {
  const subscribers = emailAddress ? 
    [{ email: emailAddress, unsubscribeToken: 'test-token' }] : 
    await subscriberManager.getSubscribers();
  
  await emailSender.sendNewPostEmail(subscribers, testPost);
  console.log(`Test email sent to ${subscribers.length} recipient(s)`);
}

// Run test with command line arg: node test-rss-monitor.js test@example.com
const testEmail = process.argv[2];
sendTestEmail(testEmail);
```

## Deployment Instructions

1. **Setup Raspberry Pi**:
   - Install Node.js (v16+)
   - Clone repository to `/home/pi/rss-email-service`
   - Run `npm install` to install dependencies
   - Create a `.env` file with your secrets:
     ```
     SENDGRID_API_KEY=your_sendgrid_api_key
     NTFY_ALERT_TOPIC=your_alert_topic
     NTFY_SUBSCRIBE_TOPIC=your_subscribe_topic
     NTFY_UNSUBSCRIBE_TOPIC=your_unsubscribe_topic
     ```

2. **Deploy Cloudflare Worker**:
   - Create Cloudflare account if you don't have one
   - Install Wrangler CLI: `npm install -g wrangler`
   - Login to Cloudflare: `wrangler login`
   - Initialize a new worker: `wrangler init subscribe-proxy`
   - Copy the worker code to `src/index.js`
   - Configure environment variables in `wrangler.toml`:
     ```toml
     [vars]
     NTFY_SUBSCRIBE_TOPIC = "your_subscribe_topic"
     ```
   - Create a KV namespace for rate limiting:
     ```
     wrangler kv:namespace create "RATE_LIMIT"
     ```
   - Update your `wrangler.toml` with the namespace binding
   - Deploy: `wrangler publish`
   - Set up route in Cloudflare dashboard: `mattsayar.com/api/subscribe` → your worker

3. **Configure Cron Job**:
   - Edit crontab: `crontab -e`
   - Add hourly schedule: `0 * * * * cd /home/pi/rss-email-service && node index.js >> logs/app.log 2>&1`

4. **Setup SendGrid**:
   - Create SendGrid account and generate API key
   - Verify sender domain/email

5. **Configure ntfy.sh Topics**:
   - Create three topics on ntfy.sh with randomized names:
     - Alert topic for system notifications
     - Subscribe topic for receiving new subscriptions
     - Unsubscribe topic for handling unsubscribe requests

6. **Create Unsubscribe Landing Page**:
   - Add a simple `unsubscribed.html` page to your website
   - Display a confirmation message that the user has been unsubscribed

7. **Google Drive Backup (Optional)**:
   - Create Google Cloud project
   - Enable Drive API and create credentials
   - Download credentials.json file to Raspberry Pi
   - Update backup configuration in config.js

8. **Testing Deployment**:
   - Test subscription form on your website
   - Run initial email test: `node test-rss-monitor.js your@email.com`
   - Check logs for any errors: `tail -f logs/app.log`

## Template Files

### Email Template (templates/email.html)
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Post on Matt Sayar's Blog</title>
  <style>
    body {
      background-color: #121212;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }
    .post-title {
      font-size: 24px;
      margin-bottom: 16px;
    }
    .post-image {
      width: 100%;
      height: auto;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .read-more-button {
      display: inline-block;
      background-color: #3d5afe;
      color: white;
      padding: 10px 20px;
      text-decoration: none;
      border-radius: 4px;
      margin-top: 16px;
    }
    .footer {
      margin-top: 30px;
      font-size: 12px;
      color: #909090;
      border-top: 1px solid #303030;
      padding-top: 16px;
    }
    
    @media (prefers-color-scheme: light) {
      body {
        background-color: #ffffff;
        color: #333333;
      }
      .footer {
        color: #666666;
        border-top: 1px solid #dddddd;
      }
    }
  </style>
</head>
<body>
  <h1 class="post-title">{{postTitle}}</h1>
  <img class="post-image" src="{{postImage}}" alt="{{postTitle}}">
  <a href="{{postUrl}}" class="read-more-button">Read the full post</a>
  <div class="footer">
    <p>You're receiving this because you subscribed to updates from <a href="https://mattsayar.com">mattsayar.com</a></p>
    <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> with one click</p>
  </div>
</body>
</html>
```

### Unsubscribed Landing Page (unsubscribed.html)
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed - Matt Sayar's Blog</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 2rem;
      max-width: 600px;
      margin: 0 auto;
      text-align: center;
    }
    h1 {
      margin-bottom: 1rem;
    }
    p {
      margin-bottom: 2rem;
    }
    a {
      color: #3d5afe;
    }
  </style>
</head>
<body>
  <h1>You've been unsubscribed</h1>
  <p>You'll no longer receive email updates when new posts are published.</p>
  <p>If you unsubscribed by mistake, you can <a href="/">return to the homepage</a> and subscribe again.</p>
</body>
</html>
```