# rsspberry2email Service

A lightweight service that monitors an RSS feed for new content and emails subscribers when new posts are published. The service also manages email subscriptions through a simple form that can be embedded on a website, with a Cloudflare Worker acting as a secure proxy for subscription requests.

## Features

- **RSS Monitoring**: Checks the RSS feed at configurable intervals for new posts
- **Email Notifications**: Sends styled HTML emails to subscribers when new content is published
- **Subscription Management**: Handles subscriber sign-ups and unsubscribes
- **Anti-Spam Protection**: Includes rate limiting, email validation, and honeypot fields
- **Monitoring**: Uses ntfy.sh for alerts and health monitoring
- **Dashboard**: Simple monitoring dashboard to check service status
- **Security**: Cloudflare Worker proxy for subscription requests

## Architecture

```
┌─────────────┐     ┌───────────────┐     ┌───────────────┐
│  Website    │     │  Cloudflare   │     │    ntfy.sh    │
│  Form       │────▶│  Worker       │────▶│  (Subscribe)  │
└─────────────┘     └───────────────┘     └───────┬───────┘
                                                  │
                                                  ▼
┌─────────────┐     ┌────────────────┐     ┌───────────────┐
│  Email      │     │ rsspberry2email│     │  Subscriber   │
│  Inbox      │◀────│  Service       │◀────│  Management   │
└─────────────┘     └───────┬────────┘     └───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  RSS Feed     │
                    │  Monitoring   │
                    └───────────────┘
```

## Prerequisites

- Node.js v16 or higher
- Raspberry Pi or similar server (always-on)
- SendGrid account for email delivery
- Cloudflare account (for the subscription proxy)
- ntfy.sh topics for notifications

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/rsspberry2email.git
cd rsspberry2email
```

### 2. Run the setup script

The setup script will create necessary directories, install dependencies, and set up configuration files:

```bash
./scripts/setup.sh
```

This script will:
- Create data and logs directories
- Install npm dependencies
- Create a .env file from the template
- Generate systemd service files
- Set up log rotation

### 3. Deploy Cloudflare Worker

1. Log in to your Cloudflare dashboard at https://dash.cloudflare.com/
2. Navigate to "Workers & Pages" from the sidebar
3. Click "Create application" and select "Create Worker"
4. Give your worker a name (e.g., "subscribe-proxy")
5. In the editor, paste the code from `subscribe-proxy/index.js`
6. Click "Save and Deploy"

#### Set up KV namespace for rate limiting:

1. In the Cloudflare dashboard, go to "Workers & Pages"
2. Click on "KV" in the sidebar
3. Click "Create namespace"
4. Name it "RATE_LIMIT" and click "Add"
5. Go back to your worker
6. Click on "Settings" and then "Variables"
7. Under "KV Namespace Bindings", click "Add binding"
8. Set the Variable name to "RATE_LIMIT_NAMESPACE" and select your KV namespace
9. Click "Save"

#### Configure environment variables:

1. Still in your worker's "Variables" settings
2. Under "Environment Variables", click "Add variable"
3. Add the following variables:
   - `NTFY_TOPIC`: Your ntfy.sh subscription topic
   - `ALLOWED_ORIGIN`: Your website domain (e.g., "https://yourdomain.com")
4. Click "Save"

#### Set up a route:

1. Go to "Workers & Pages" in the dashboard
2. Click on your worker
3. Go to "Triggers" and click "Add route"
4. Add a route like `yourdomain.com/api/subscribe*`
5. Click "Save"



## Usage

### Starting the service manually

```bash
# Run in foreground
node src/index.js

# Run in background
nohup node src/index.js > logs/app.log 2>&1 &
```

### Testing Email Delivery

To test email delivery without waiting for a new post:

```bash
# Send to all subscribers
npm test

# Send to a specific email
node scripts/test-email.js test@example.com
```

### Monitoring Dashboard

The service includes a simple monitoring dashboard that shows:
- Service status
- Last successful check
- Subscriber count
- Last post information

Access it at `http://your-server-ip:3000/dashboard.html`

### Embedding the Subscription Form

Copy the `public/subscription-form.html` file to your website and update the API endpoint URL in the JavaScript fetch call to match your Cloudflare Worker endpoint:

```html
<form id="subscription-form" action="https://yourdomain.com/api/subscribe" method="post">
  <!-- Form content -->
</form>
```


## Monitoring

The service uses ntfy.sh for monitoring and alerts. You'll receive notifications for:

- RSS feed errors
- Email sending failures
- Service health issues
- New subscriptions and unsubscribes

## Troubleshooting

### Common Issues

1. **Emails not sending**
   - Check SendGrid API key
   - Verify sender domain is verified in SendGrid
   - Check logs for specific errors

2. **Subscription form not working**
   - Ensure Cloudflare Worker is deployed correctly
   - Check browser console for JavaScript errors
   - Verify the API endpoint URL is correct

3. **Service not running**
   - Check systemd service is running correctly
   - Verify Node.js is installed and working
   - Check logs for errors


### Logs

Logs are stored in the `logs` directory. Check `app.log` for the most recent activity.

## Maintenance

### Backing Up Subscribers

The subscribers data is stored in `data/subscribers.json`. Consider making regular backups of this file.

### Updating the Service

To update the service:

```bash
git pull
npm install
```

Then restart the service or wait for the next cron job run.

## License

MIT
