# RSS-to-Email Service Implementation Checklist

## Phase 1: Foundation Setup

### Step 1: Project Initialization
- [ ] Create package.json with dependencies:
  - [ ] node-fetch
  - [ ] xml2js
  - [ ] @sendgrid/mail
  - [ ] dotenv
  - [ ] fs and path (built-in)
- [ ] Set up directory structure:
  - [ ] /data
  - [ ] /src
  - [ ] /templates
  - [ ] /logs
- [ ] Create .env.example with required variables:
  - [ ] SENDGRID_API_KEY
  - [ ] NTFY_ALERT_TOPIC
  - [ ] NTFY_SUBSCRIBE_TOPIC
  - [ ] NTFY_UNSUBSCRIBE_TOPIC
- [ ] Create .gitignore file:
  - [ ] node_modules
  - [ ] .env
  - [ ] /data/*.json
  - [ ] /logs/*.log

### Step 2: Configuration Module
- [ ] Create src/config.js:
  - [ ] Load environment variables using dotenv
  - [ ] Configure RSS settings (feedUrl, checkIntervalHours)
  - [ ] Configure email settings (from, subject, sendgridApiKey)
  - [ ] Configure notification settings (alertTopic, subscribeTopic, unsubscribeTopic)
  - [ ] Configure health check settings (maxHoursBetweenRuns)
  - [ ] Configure backup settings (enabled, credentialsPath, backupIntervalHours)
- [ ] Add environment variable validation
- [ ] Add sensible defaults for non-critical settings

### Step 3: Basic Logging Setup
- [ ] Create src/utils/logger.js:
  - [ ] Implement log levels (info, warn, error)
  - [ ] Configure console logging
  - [ ] Configure file logging with rotation
  - [ ] Add timestamp and log level formatting
- [ ] Create logs directory if it doesn't exist
- [ ] Test logging with multiple log levels

## Phase 2: Core Functionality

### Step 4: Subscriber Management Module (Basic)
- [ ] Create src/subscriberManager.js:
  - [ ] Create/initialize JSON file in data directory
  - [ ] Implement getSubscribers() function
  - [ ] Implement addSubscriber(email) function with token generation
  - [ ] Implement removeSubscriber(token) function
  - [ ] Implement getLastPost() function
  - [ ] Implement updateLastPost(post) function
- [ ] Add error handling for file operations
- [ ] Test basic subscriber management functions

### Step 5: RSS Parser Module
- [ ] Create src/rssParser.js:
  - [ ] Implement fetchRssFeed() function
  - [ ] Implement fetchLatestPost() function
  - [ ] Add OG image extraction from description
  - [ ] Handle both array and single item cases
- [ ] Add error handling for network and parsing errors
- [ ] Test with sample RSS feed

### Step 6: Monitoring Module
- [ ] Create src/monitoring.js:
  - [ ] Implement sendAlert(message) function using ntfy.sh
  - [ ] Implement updateHealthCheckTimestamp() function
  - [ ] Implement checkServiceHealth() function
  - [ ] Implement startHealthCheck() function with timer
- [ ] Test ntfy.sh integration
- [ ] Verify health check updates in subscribers.json

### Step 7: Email Templates
- [ ] Create templates/email.html:
  - [ ] Add responsive design
  - [ ] Include post title, image, and link placeholders
  - [ ] Add unsubscribe link placeholder
  - [ ] Add dark mode support
  - [ ] Style for email client compatibility
- [ ] Create templates/unsubscribed.html:
  - [ ] Add confirmation message
  - [ ] Add link to homepage
  - [ ] Add simple styling
- [ ] Test templates with sample data

### Step 8: Email Sender Module
- [ ] Create src/emailSender.js:
  - [ ] Load and compile email template
  - [ ] Implement generateUnsubscribeUrl(token) function
  - [ ] Implement sendNewPostEmail(subscribers, post) function
  - [ ] Configure SendGrid with API key
  - [ ] Disable tracking (open/click)
- [ ] Add parallel email sending with Promise.all
- [ ] Add error handling for send failures
- [ ] Test with sample data

## Phase 3: Integration and Main Logic

### Step 9: Main Service Module (Basic Flow)
- [ ] Create src/index.js:
  - [ ] Import all required modules
  - [ ] Implement checkAndSendEmails() function skeleton
  - [ ] Add new post detection logic
  - [ ] Add email sending for new posts
  - [ ] Add logging throughout
- [ ] Add error handling
- [ ] Test basic flow with mock data

### Step 10: Lock File Mechanism
- [ ] Update src/index.js:
  - [ ] Define lock file path constant
  - [ ] Add check for existing lock file
  - [ ] Add stale lock detection (> 30 minutes)
  - [ ] Create lock file at processing start
  - [ ] Remove lock file at processing end
  - [ ] Ensure lock file cleanup even on errors
- [ ] Test lock file mechanism with multiple runs

## Phase 4: Subscription Management

### Step 11: Subscription Listener
- [ ] Update src/subscriberManager.js:
  - [ ] Implement listenForSubscriptions() function
  - [ ] Add ntfy.sh SSE connection
  - [ ] Add email extraction from messages
  - [ ] Add email validation
  - [ ] Add error handling and reconnection logic
- [ ] Test subscription listener with ntfy.sh messages

### Step 12: Unsubscribe Listener
- [ ] Update src/subscriberManager.js:
  - [ ] Implement listenForUnsubscribes() function
  - [ ] Add ntfy.sh SSE connection for unsubscribe topic
  - [ ] Add token extraction from messages
  - [ ] Add subscriber removal logic
  - [ ] Add error handling and reconnection logic
- [ ] Update index.js to start unsubscribe listener
- [ ] Test unsubscribe flow

### Step 13: Complete Main Service Integration
- [ ] Update src/index.js:
  - [ ] Start subscription listener on service start
  - [ ] Start unsubscribe listener on service start
  - [ ] Start health check monitor
  - [ ] Run initial RSS check
  - [ ] Export functions for testing
- [ ] Ensure all components are properly connected
- [ ] Add comprehensive logging
- [ ] Test full service integration

## Phase 5: Cloudflare Worker for Subscription Proxy

### Step 14: Cloudflare Worker Setup
- [ ] Create subscribe-proxy/index.js:
  - [ ] Add request handler for POST requests
  - [ ] Add email extraction and validation
  - [ ] Implement rate limiting with KV store
  - [ ] Add honeypot check for bot detection
  - [ ] Add ntfy.sh forwarding
  - [ ] Add response handling
- [ ] Create wrangler.toml:
  - [ ] Configure worker name and compatibility
  - [ ] Add environment variables
  - [ ] Configure KV namespace binding
- [ ] Test locally with wrangler dev

### Step 15: Subscription Form HTML/JS
- [ ] Create public/subscription-form.html:
  - [ ] Add form with email input
  - [ ] Add hidden honeypot field
  - [ ] Add subscribe button
  - [ ] Add message area for feedback
  - [ ] Add JavaScript for form submission
  - [ ] Add fetch request to API endpoint
  - [ ] Add response handling and user feedback
  - [ ] Style the form
- [ ] Test form submission

## Phase 6: Testing and Deployment

### Step 16: Testing Script
- [ ] Create scripts/test-email.js:
  - [ ] Import required modules
  - [ ] Create mock post object
  - [ ] Implement test email function
  - [ ] Add command-line argument handling
  - [ ] Add logging for results
- [ ] Test with specific email address
- [ ] Test with all subscribers

### Step 17: README and Documentation
- [ ] Create README.md:
  - [ ] Add project overview and features
  - [ ] List prerequisites and dependencies
  - [ ] Add installation instructions
  - [ ] Add configuration instructions
  - [ ] Add testing procedures
  - [ ] Add troubleshooting guide
  - [ ] Add maintenance tasks
- [ ] Create simple architecture diagram
- [ ] Review and proofread documentation

### Step 18: Deployment Scripts
- [ ] Create scripts/setup.sh:
  - [ ] Add directory creation
  - [ ] Add dependency installation
  - [ ] Add .env configuration
  - [ ] Add log rotation setup
  - [ ] Add systemd service configuration
- [ ] Create scripts/deploy-worker.sh:
  - [ ] Add wrangler installation
  - [ ] Add Cloudflare authentication
  - [ ] Add KV namespace creation
  - [ ] Add worker deployment
- [ ] Make scripts executable
- [ ] Add usage instructions in comments
- [ ] Test scripts in clean environment

## Phase 7: Advanced Features (Optional)

### Step 19: Google Drive Backup Module
- [ ] Create src/backup.js:
  - [ ] Add Google Drive API client
  - [ ] Implement authenticateGoogleDrive() function
  - [ ] Implement backupToGoogleDrive() function
  - [ ] Implement startBackupSchedule() function
  - [ ] Add conditional activation based on config
- [ ] Update index.js to initialize backup if enabled
- [ ] Test with Google Drive credentials

### Step 20: Monitoring Dashboard
- [ ] Create public/dashboard.html:
  - [ ] Add statistics display (subscribers, emails sent)
  - [ ] Add last post information
  - [ ] Add health status display
  - [ ] Add auto-refresh functionality
  - [ ] Add basic visualizations
  - [ ] Style for responsiveness
- [ ] Create simple HTTP server for dashboard
- [ ] Test dashboard displays

## Final Tasks
- [ ] Run complete end-to-end test
- [ ] Deploy to production Raspberry Pi
- [ ] Set up cron job for regular execution
- [ ] Monitor initial operation
- [ ] Document any issues or improvements