# RSS-to-Email Service Implementation Blueprint

## Overview

Looking at the RSS-to-Email service specification, I'll draft a detailed implementation plan broken down into iterative steps that build upon each other. Each step will be accompanied by a prompt for a code-generation LLM to implement that specific part of the solution.

This blueprint prioritizes:
1. Best practices in Node.js development
2. Incremental, testable progress
3. Proper error handling and resilience
4. Security considerations
5. Maintainable, modular code structure

## Phase 1: Foundation Setup

### Step 1: Project Initialization

**Prompt:**
```
I'm building an RSS-to-Email service that monitors a blog feed and emails subscribers when new posts are published. Let's start by setting up the basic project structure.

Please create:
1. A package.json file with essential dependencies:
   - node-fetch for HTTP requests
   - xml2js for RSS parsing
   - @sendgrid/mail for email delivery
   - dotenv for environment variable management
   - fs and path for file operations

2. A basic directory structure:
   - /data (for storing subscriber info)
   - /src (for source code)
   - /templates (for email templates)
   - /logs (for log files)

3. A .env.example file showing required environment variables:
   - SENDGRID_API_KEY
   - NTFY_ALERT_TOPIC
   - NTFY_SUBSCRIBE_TOPIC
   - NTFY_UNSUBSCRIBE_TOPIC

4. A basic .gitignore file that excludes:
   - node_modules
   - .env
   - /data/*.json
   - /logs/*.log
```

### Step 2: Configuration Module

**Prompt:**
```
Now let's create a configuration module for our RSS-to-Email service. This module will centralize all configuration parameters and load environment variables.

Please create src/config.js that:
1. Uses dotenv to load environment variables
2. Exports a configuration object with these sections:
   - rss: Settings for RSS feed URL and check interval (hourly)
   - email: Settings for sending emails (from address, subject, SendGrid API key)
   - notifications: Settings for ntfy.sh topics (alert, subscribe, unsubscribe)
   - healthCheck: Maximum hours between successful runs (3 hours)
   - backup: Google Drive backup settings (disabled by default)

Make sure the module validates that required environment variables exist and provides sensible defaults for non-critical settings.
```

### Step 3: Basic Logging Setup

**Prompt:**
```
Let's implement a simple logging module for our RSS-to-Email service that:
1. Creates a src/utils/logger.js module
2. Provides functions for different log levels (info, warn, error)
3. Logs to both console and a rotating log file in the logs directory
4. Includes timestamps and log levels
5. Provides a clean interface that can be imported by other modules

The logger should create the logs directory if it doesn't exist. Make sure to set up log file rotation to avoid filling the disk space with log files over time.
```

## Phase 2: Core Functionality

### Step 4: Subscriber Management Module (Basic)

**Prompt:**
```
Let's implement the core subscriber management module for our RSS-to-Email service. This module will handle operations related to subscribers.

Create src/subscriberManager.js that:
1. Creates/initializes a JSON file in the data directory to store subscribers if it doesn't exist
2. Provides functions for:
   - getSubscribers(): Returns array of all subscribers
   - addSubscriber(email): Adds a new subscriber with generated unsubscribe token
   - removeSubscriber(token): Removes a subscriber by unsubscribe token
   - getLastPost(): Returns info about the last post that was sent
   - updateLastPost(post): Updates the stored last post information

Use the Node.js fs module for file operations and handle errors appropriately. The JSON structure should follow this format:
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

### Step 5: RSS Parser Module

**Prompt:**
```
Let's implement the RSS parser module for our RSS-to-Email service. This module will fetch and parse the blog's RSS feed.

Create src/rssParser.js that:
1. Imports node-fetch and xml2js
2. Provides two main functions:
   - fetchRssFeed(): Fetches the RSS feed from config.rss.feedUrl and parses XML to JavaScript object
   - fetchLatestPost(): Extracts and returns the most recent post from the feed with these properties:
     * id: Unique identifier (guid or link)
     * title: Post title
     * link: URL to the post
     * pubDate: Publication date
     * ogImage: Open Graph image URL if available (extracted from description)

Handle errors appropriately, including network errors and invalid feed structure. Return clean, consistent objects that can be used by other modules.
```

### Step 6: Monitoring Module

**Prompt:**
```
Let's implement the monitoring module for our RSS-to-Email service. This module will handle sending alerts and tracking service health.

Create src/monitoring.js that:
1. Provides these functions:
   - sendAlert(message): Sends an alert notification to ntfy.sh
   - updateHealthCheckTimestamp(): Updates the health check timestamp in the subscribers.json file
   - checkServiceHealth(): Checks if the service has run successfully in the configured time period
   - startHealthCheck(): Starts a timer to run health checks periodically

The module should use node-fetch to send notifications to ntfy.sh using the topic from config.notifications.alertTopic. For health check timestamps, it should update the stats.lastHealthCheckPassed field in the subscribers.json file.

Make sure to handle errors gracefully and log appropriate messages.
```

### Step 7: Email Templates

**Prompt:**
```
Let's create the email template for our RSS-to-Email service. This will be an HTML template for notification emails when a new blog post is published.

Create templates/email.html that:
1. Has a responsive design that works well on mobile and desktop
2. Includes:
   - Post title ({{postTitle}})
   - Featured image ({{postImage}})
   - Link to read the full post ({{postUrl}})
   - Unsubscribe link ({{unsubscribeUrl}})
3. Supports dark mode via media queries
4. Has a clean, minimal design with basic styling
5. Works well in most email clients

Also create templates/unsubscribed.html, a simple page that shows a confirmation message when someone unsubscribes, with a link back to the homepage.

The template should use Handlebars-style placeholders ({{variable}}) for dynamic content.
```

### Step 8: Email Sender Module

**Prompt:**
```
Let's implement the email sender module for our RSS-to-Email service. This module will handle sending emails to subscribers.

Create src/emailSender.js that:
1. Imports @sendgrid/mail, fs, path, and a simple template engine
2. Provides functions:
   - generateUnsubscribeUrl(token): Generates unsubscribe URL using ntfy.sh
   - sendNewPostEmail(subscribers, post): Sends email to all subscribers about a new post

The module should:
- Load and compile the email.html template
- Use SendGrid to send emails
- Disable tracking (no open/click tracking)
- Handle errors and report failures
- Return results of all send operations

When sending emails to multiple subscribers, use Promise.all for parallel processing but with proper error handling to continue even if some emails fail.
```

## Phase 3: Integration and Main Logic

### Step 9: Main Service Module (Basic Flow)

**Prompt:**
```
Let's implement the main service module that ties everything together in our RSS-to-Email service.

Create src/index.js that:
1. Imports all previously created modules:
   - config
   - rssParser
   - subscriberManager
   - emailSender
   - monitoring
   - logger

2. Implements a checkAndSendEmails() function that:
   - Uses a lock file mechanism to prevent duplicate runs
   - Checks the RSS feed for new posts
   - Compares with the last sent post
   - Sends emails to subscribers when there's a new post
   - Updates the last post information
   - Updates health check timestamp
   - Handles errors and sends alerts if needed

3. Has a simple main entry point that runs checkAndSendEmails() immediately

Focus on the core flow and lock file mechanism in this step. We'll add the subscription listener functionality in a later step.

Make sure to implement proper error handling and clean up the lock file even if the process fails.
```

### Step 10: Lock File Mechanism

**Prompt:**
```
Let's enhance the lock file mechanism in our RSS-to-Email service to prevent duplicate email sends if multiple instances run simultaneously.

Modify src/index.js to:
1. Define a constant for the lock file path (data/process.lock)
2. Before processing, check if the lock file exists:
   - If it exists, read its timestamp
   - If the lock is older than 30 minutes, assume it's stale and proceed
   - If the lock is fresh, exit gracefully
3. Create the lock file with the current timestamp when processing begins
4. Remove the lock file when processing is complete, even if errors occur
5. Use proper try/catch blocks to ensure the lock file is always cleaned up

Make sure the lock file handling is robust and won't leave stale locks that prevent the service from running.
```

## Phase 4: Subscription Management

### Step 11: Subscription Listener

**Prompt:**
```
Let's implement the subscription listener functionality in our RSS-to-Email service. This will listen for new subscription requests sent through ntfy.sh.

Enhance src/subscriberManager.js to add:
1. A listenForSubscriptions() function that:
   - Connects to ntfy.sh SSE (Server-Sent Events) endpoint for the subscription topic
   - Processes incoming messages to extract email addresses
   - Validates email format
   - Adds valid emails to the subscribers list
   - Handles reconnection if the connection is lost

2. A function to start the listener when the service starts

This module should connect to https://ntfy.sh/{topic}/sse where {topic} is the subscription topic from the configuration. Make sure to properly handle the SSE message format and extract the email from the data field.

Handle errors gracefully and attempt to reconnect after failures with a reasonable delay.
```

### Step 12: Unsubscribe Listener

**Prompt:**
```
Let's implement the unsubscribe listener functionality in our RSS-to-Email service. This will listen for unsubscribe requests sent through ntfy.sh.

Enhance src/subscriberManager.js to add:
1. A listenForUnsubscribes() function that:
   - Connects to ntfy.sh SSE endpoint for the unsubscribe topic
   - Processes incoming messages to extract unsubscribe tokens
   - Removes subscribers with matching tokens
   - Handles reconnection if the connection is lost

2. Update the main service to start both subscription and unsubscribe listeners when the service starts

The unsubscribe listener should follow the same pattern as the subscription listener, connecting to the appropriate ntfy.sh topic and processing incoming messages.

Make sure to log appropriate information about unsubscribe events and handle errors gracefully.
```

### Step 13: Complete Main Service Integration

**Prompt:**
```
Let's finalize the main service module by integrating all components into a complete working solution.

Update src/index.js to:
1. Start both the subscription and unsubscribe listeners when the service starts
2. Set up the health check monitor
3. Run the initial RSS check
4. Export the checkAndSendEmails function for potential testing

Make sure all components are properly connected and the service runs as expected. Add appropriate logging throughout the flow to make monitoring and debugging easier.

The final structure should include initialization of all components followed by the main RSS check function execution.
```

## Phase 5: Cloudflare Worker for Subscription Proxy

### Step 14: Cloudflare Worker Setup

**Prompt:**
```
Let's implement the Cloudflare Worker that will serve as a subscription proxy for our RSS-to-Email service. This worker will receive subscription requests from the website form and forward them to ntfy.sh.

Create subscribe-proxy/index.js that:
1. Listens for POST requests to /api/subscribe
2. Extracts the email from the request body
3. Validates email format
4. Implements rate limiting using Cloudflare's KV store
5. Checks for honeypot field to filter bot submissions
6. Forwards valid requests to the ntfy.sh topic
7. Returns appropriate responses for success/failure

Use the Cloudflare Workers KV for rate limiting, storing a counter for each IP address and resetting it hourly.

Also create a wrangler.toml configuration file that:
1. Defines the worker name and compatibility date
2. Specifies environment variables (NTFY_SUBSCRIBE_TOPIC)
3. Configures KV namespace binding for rate limiting
```

### Step 15: Subscription Form HTML/JS

**Prompt:**
```
Let's create the HTML and JavaScript for the subscription form that will be embedded on the website. This form will allow users to subscribe to the RSS-to-Email service.

Create public/subscription-form.html that contains:
1. A simple form with:
   - Email input field
   - Hidden honeypot field
   - Subscribe button
   - Message area for feedback
2. JavaScript that:
   - Prevents default form submission
   - Collects the email and honeypot values
   - Sends a POST request to the Cloudflare Worker endpoint
   - Handles the response and displays appropriate messages
   - Clears the form on success

The form should have simple styling that can be easily integrated into the existing website design. Make sure the JavaScript uses fetch() for the API call and handles errors appropriately.
```

## Phase 6: Testing and Deployment

### Step 16: Testing Script

**Prompt:**
```
Let's create a testing script for our RSS-to-Email service that allows us to test email sending without needing a new post in the actual RSS feed.

Create scripts/test-email.js that:
1. Imports the necessary modules (config, emailSender, subscriberManager)
2. Creates a mock post object with test data
3. Provides a function to send test emails to either:
   - A specific email address provided as a command-line argument
   - All current subscribers if no email is specified

The script should be runnable with:
- `node scripts/test-email.js` (sends to all subscribers)
- `node scripts/test-email.js test@example.com` (sends to specific address)

Include clear logging to show what's happening and the results of the send operation.
```

### Step 17: README and Documentation

**Prompt:**
```
Let's create comprehensive documentation for our RSS-to-Email service to help with deployment and maintenance.

Create a README.md file that includes:
1. Project overview and features
2. Prerequisites and dependencies
3. Step-by-step installation instructions:
   - Raspberry Pi setup
   - Environment variables configuration
   - Cloudflare Worker deployment
   - Cron job setup
   - SendGrid configuration
   - ntfy.sh topic setup
4. Testing procedures
5. Troubleshooting common issues
6. Maintenance tasks

Also include a simple architecture diagram showing how the components interact.

The documentation should be clear enough that someone with basic technical knowledge can set up and maintain the service.
```

### Step 18: Deployment Scripts

**Prompt:**
```
Let's create deployment scripts for our RSS-to-Email service to simplify setup and updates.

Create scripts/setup.sh that:
1. Creates necessary directories (data, logs)
2. Installs dependencies
3. Copies .env.example to .env and prompts for values
4. Sets up log rotation
5. Creates a systemd service file for automatic startup

Create scripts/deploy-worker.sh that:
1. Installs wrangler if needed
2. Authenticates with Cloudflare if needed
3. Creates KV namespace for rate limiting
4. Deploys the worker

Both scripts should have appropriate error checking and user prompts. Make them executable and include usage instructions in comments at the top.
```

## Phase 7: Advanced Features (Optional)

### Step 19: Google Drive Backup Module

**Prompt:**
```
Let's implement the optional Google Drive backup module for our RSS-to-Email service. This will periodically back up the subscribers JSON file to Google Drive.

Create src/backup.js that:
1. Imports the Google Drive API client library
2. Provides functions for:
   - authenticateGoogleDrive(): Sets up authentication with credentials file
   - backupToGoogleDrive(): Uploads the subscribers.json file to Google Drive
   - startBackupSchedule(): Sets up a periodic backup based on configuration

The module should be optional and only activate if the backup.enabled setting is true in the configuration. It should handle authentication gracefully and retry on failures.

Update the main service module to initialize the backup system if enabled.
```

### Step 20: Monitoring Dashboard

**Prompt:**
```
Let's create a simple monitoring dashboard for our RSS-to-Email service that shows key statistics and service health.

Create a simple HTML/JS dashboard page that:
1. Reads the subscribers.json file to display:
   - Number of subscribers
   - Last post sent (title, date)
   - Total emails sent
   - Last successful run
   - Health check status
2. Refreshes automatically every minute
3. Provides basic visualizations (subscriber growth over time if available)

This should be a standalone page that can be accessed on the Raspberry Pi's local network for monitoring. It should not require a full web server - just a simple HTTP file server will do.

Make sure the dashboard is responsive and has a clean, easy-to-read design.
```

## Implementation Steps Summary

This blueprint breaks down the RSS-to-Email service implementation into 20 distinct steps, each building on the previous ones. The steps are organized into phases that focus on different aspects of the system:

1. **Foundation Setup**: Basic project structure, configuration, and logging
2. **Core Functionality**: Subscriber management, RSS parsing, monitoring, and email sending
3. **Integration**: Main service logic and lock file mechanism
4. **Subscription Management**: Listeners for subscription and unsubscribe requests
5. **Cloudflare Worker**: Subscription proxy for the website form
6. **Testing and Deployment**: Test scripts, documentation, and deployment automation
7. **Advanced Features**: Optional features like Google Drive backup and monitoring dashboard

Each step is accompanied by a prompt for a code-generation LLM that clearly outlines what needs to be implemented. The prompts focus on small, manageable pieces that can be tested independently before being integrated into the larger system.

This approach ensures incremental progress with no big jumps in complexity at any stage. It also prioritizes best practices like error handling, security, and maintainability throughout the implementation process.