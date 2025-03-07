# RSS-to-Email Service Implementation Checklist

## Phase 1: Foundation Setup

### Step 1: Project Initialization
- [x] Create package.json with dependencies:
  - [x] node-fetch
  - [x] xml2js
  - [x] @sendgrid/mail
  - [x] dotenv
  - [x] fs and path (built-in)
- [x] Set up directory structure:
  - [x] /data
  - [x] /src
  - [x] /templates
  - [x] /logs
- [x] Create .env.example with required variables:
  - [x] SENDGRID_API_KEY
  - [x] NTFY_ALERT_TOPIC
  - [x] NTFY_SUBSCRIBE_TOPIC
  - [x] NTFY_UNSUBSCRIBE_TOPIC
- [x] Create .gitignore file:
  - [x] node_modules
  - [x] .env
  - [x] /data/*.json
  - [x] /logs/*.log

### Step 2: Configuration Module
- [x] Create src/config.js:
  - [x] Load environment variables using dotenv
  - [x] Configure RSS settings (feedUrl, checkIntervalHours)
  - [x] Configure email settings (from, subject, sendgridApiKey)
  - [x] Configure notification settings (alertTopic, subscribeTopic, unsubscribeTopic)
  - [x] Configure health check settings (maxHoursBetweenRuns)
  - [x] Configure backup settings (enabled, credentialsPath, backupIntervalHours)
- [x] Add environment variable validation
- [x] Add sensible defaults for non-critical settings

### Step 3: Basic Logging Setup
- [x] Create src/utils/logger.js:
  - [x] Implement log levels (info, warn, error)
  - [x] Configure console logging
  - [x] Configure file logging with rotation
  - [x] Add timestamp and log level formatting
- [x] Create logs directory if it doesn't exist
- [x] Test logging with multiple log levels

## Phase 2: Core Functionality

### Step 4: Subscriber Management Module (Basic)
- [x] Create src/subscriberManager.js:
  - [x] Create/initialize JSON file in data directory
  - [x] Implement getSubscribers() function
  - [x] Implement addSubscriber(email) function with token generation
  - [x] Implement removeSubscriber(token) function
  - [x] Implement getLastPost() function
  - [x] Implement updateLastPost(post) function
- [x] Add error handling for file operations
- [x] Test basic subscriber management functions

### Step 5: RSS Parser Module
- [x] Create src/rssParser.js:
  - [x] Implement fetchRssFeed() function
  - [x] Implement fetchLatestPost() function
  - [x] Add OG image extraction from description
  - [x] Handle both array and single item cases
- [x] Add error handling for network and parsing errors
- [x] Test with sample RSS feed

### Step 6: Monitoring Module
- [x] Create src/monitoring.js:
  - [x] Implement sendAlert(message) function using ntfy.sh
  - [x] Implement updateHealthCheckTimestamp() function
  - [x] Implement checkServiceHealth() function
  - [x] Implement startHealthCheck() function with timer
- [x] Test ntfy.sh integration
- [x] Verify health check updates in subscribers.json

### Step 7: Email Templates
- [x] Create templates/email.html:
  - [x] Add responsive design
  - [x] Include post title, image, and link placeholders
  - [x] Add unsubscribe link placeholder
  - [x] Add dark mode support
  - [x] Style for email client compatibility
- [x] Create templates/unsubscribed.html:
  - [x] Add confirmation message
  - [x] Add link to homepage
  - [x] Add simple styling
- [x] Test templates with sample data

### Step 8: Email Sender Module
- [x] Create src/emailSender.js:
  - [x] Load and compile email template
  - [x] Implement generateUnsubscribeUrl(token) function
  - [x] Implement sendNewPostEmail(subscribers, post) function
  - [x] Configure SendGrid with API key
  - [x] Disable tracking (open/click)
- [x] Add parallel email sending with Promise.all
- [x] Add error handling for send failures
- [x] Test with sample data

## Phase 3: Integration and Main Logic

### Step 9: Main Service Module (Basic Flow)
- [x] Create src/index.js:
  - [x] Import all required modules
  - [x] Implement checkAndSendEmails() function skeleton
  - [x] Add new post detection logic
  - [x] Add email sending for new posts
  - [x] Add logging throughout
- [x] Add error handling
- [x] Test basic flow with mock data

### Step 10: Lock File Mechanism
- [x] Update src/index.js:
  - [x] Define lock file path constant
  - [x] Add check for existing lock file
  - [x] Add stale lock detection (> 30 minutes)
  - [x] Create lock file at processing start
  - [x] Remove lock file at processing end
  - [x] Ensure lock file cleanup even on errors
- [x] Test lock file mechanism with multiple runs

## Phase 4: Subscription Management

### Step 11: Subscription Listener
- [x] Update src/subscriberManager.js:
  - [x] Implement listenForSubscriptions() function
  - [x] Add ntfy.sh SSE connection
  - [x] Add email extraction from messages
  - [x] Add email validation
  - [x] Add error handling and reconnection logic
- [x] Test subscription listener with ntfy.sh messages

### Step 12: Unsubscribe Listener
- [x] Update src/subscriberManager.js:
  - [x] Implement listenForUnsubscribes() function
  - [x] Add ntfy.sh SSE connection for unsubscribe topic
  - [x] Add token extraction from messages
  - [x] Add subscriber removal logic
  - [x] Add error handling and reconnection logic
- [x] Update index.js to start unsubscribe listener
- [x] Test unsubscribe flow

### Step 13: Complete Main Service Integration
- [x] Update src/index.js:
  - [x] Start subscription listener on service start
  - [x] Start unsubscribe listener on service start
  - [x] Start health check monitor
  - [x] Run initial RSS check
  - [x] Export functions for testing
- [x] Ensure all components are properly connected
- [x] Add comprehensive logging
- [x] Test full service integration

## Phase 5: Cloudflare Worker for Subscription Proxy

### Step 14: Cloudflare Worker Setup
- [x] Create subscribe-proxy/index.js:
  - [x] Add request handler for POST requests
  - [x] Add email extraction and validation
  - [x] Implement rate limiting with KV store
  - [x] Add honeypot check for bot detection
  - [x] Add ntfy.sh forwarding
  - [x] Add response handling
- [x] Create wrangler.toml:
  - [x] Configure worker name and compatibility
  - [x] Add environment variables
  - [x] Configure KV namespace binding
- [x] Test locally with wrangler dev

### Step 15: Subscription Form HTML/JS
- [x] Create public/subscription-form.html:
  - [x] Add form with email input
  - [x] Add hidden honeypot field
  - [x] Add subscribe button
  - [x] Add message area for feedback
  - [x] Add JavaScript for form submission
  - [x] Add fetch request to API endpoint
  - [x] Add response handling and user feedback
  - [x] Style the form
- [x] Test form submission

## Phase 6: Testing and Deployment

### Step 16: Testing Script
- [x] Create scripts/test-email.js:
  - [x] Import required modules
  - [x] Create mock post object
  - [x] Implement test email function
  - [x] Add command-line argument handling
  - [x] Add logging for results
- [x] Test with specific email address
- [x] Test with all subscribers

### Step 17: README and Documentation
- [x] Create README.md:
  - [x] Add project overview and features
  - [x] List prerequisites and dependencies
  - [x] Add installation instructions
  - [x] Add configuration instructions
  - [x] Add testing procedures
  - [x] Add troubleshooting guide
  - [x] Add maintenance tasks
- [x] Create simple architecture diagram
- [x] Review and proofread documentation

### Step 18: Deployment Scripts
- [x] Create scripts/setup.sh:
  - [x] Add directory creation
  - [x] Add dependency installation
  - [x] Add .env configuration
  - [x] Add log rotation setup
  - [x] Add systemd service configuration
- [x] Create scripts/deploy-worker.sh:
  - [x] Add wrangler installation
  - [x] Add Cloudflare authentication
  - [x] Add KV namespace creation
  - [x] Add worker deployment
- [x] Make scripts executable
- [x] Add usage instructions in comments
- [x] Test scripts in clean environment

## Phase 7: Advanced Features (Optional)

### Step 19: Google Drive Backup Module
- [x] Create src/backup.js:
  - [x] Add Google Drive API client
  - [x] Implement authenticateGoogleDrive() function
  - [x] Implement backupToGoogleDrive() function
  - [x] Implement startBackupSchedule() function
  - [x] Add conditional activation based on config
- [x] Update index.js to initialize backup if enabled
- [x] Test with Google Drive credentials

### Step 20: Monitoring Dashboard
- [x] Create public/dashboard.html:
  - [x] Add statistics display (subscribers, emails sent)
  - [x] Add last post information
  - [x] Add health status display
  - [x] Add auto-refresh functionality
  - [x] Add basic visualizations
  - [x] Style for responsiveness
- [x] Create simple HTTP server for dashboard
- [x] Test dashboard displays

## Final Tasks
- [x] Run complete end-to-end test
- [x] Deploy to production Raspberry Pi
- [x] Set up cron job for regular execution
- [x] Monitor initial operation
- [x] Document any issues or improvements
