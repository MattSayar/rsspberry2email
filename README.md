# RSS-to-Email Service

A lightweight service that monitors an RSS feed for new content and emails subscribers when new posts are published. The service also manages email subscriptions through a simple form that can be embedded on a website, with a Cloudflare Worker acting as a secure proxy for subscription requests.

## Features

- **RSS Monitoring**: Checks the RSS feed hourly for new posts
- **Email Notifications**: Sends styled HTML emails to subscribers when new content is published
- **Subscription Management**: Handles subscriber sign-ups and unsubscribes
- **Anti-Spam Protection**: Includes rate limiting, email validation, and honeypot fields
- **Monitoring**: Uses ntfy.sh for alerts and health monitoring
- **Security**: Cloudflare Worker proxy for subscription requests

## Architecture

```
┌─────────────┐     ┌───────────────┐     ┌───────────────┐
│  Website    │     │  Cloudflare   │     │    ntfy.sh    │
│  Form       │────▶│  Worker       │────▶│  (Subscribe)  │
└─────────────┘     └───────────────┘     └───────┬───────┘
                                                  │
                                                  ▼
┌─────────────┐     ┌───────────────┐     ┌───────────────┐
│  Email      │     │  RSS-to-Email │     │  Subscriber   │
│  Inbox      │◀────│  Service      │◀────│  Management   │
└─────────────┘     └───────┬───────┘     └───────────────┘
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
git clone https://github.com/yourusername/rss-to-email.git
cd rss-to-email
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file and edit it with your values:

```bash
cp .env.example .env
nano .env
```

Required environment variables:
- `SENDGRID_API_KEY`: Your SendGrid API key
- `NTFY_ALERT_TOPIC`: ntfy.sh topic for system alerts
- `NTFY_SUBSCRIBE_TOPIC`: ntfy.sh topic for subscription requests
- `NTFY_UNSUBSCRIBE_TOPIC`: ntfy.sh topic for unsubscribe requests

### 4. Deploy Cloudflare Worker

Install Wrangler CLI:

```bash
npm install -g wrangler
```

Login to Cloudflare:

```bash
wrangler login
```

Create a KV namespace for rate limiting:

```bash
wrangler kv:namespace create "RATE_LIMIT"
```

Update the `subscribe-proxy/wrangler.toml` file with your KV namespace ID and ntfy.sh topic.

Deploy the worker:

```bash
cd subscribe-proxy
wrangler publish
```

Configure a route in the Cloudflare dashboard to point `yourdomain.com/api/subscribe` to your worker.

### 5. Set up cron job

Edit your crontab:

```bash
crontab -e
```

Add an hourly schedule:

```
0 * * * * cd /path/to/rss-to-email && node src/index.js >> logs/app.log 2>&1
```

## Usage

### Testing Email Delivery

To test email delivery without waiting for a new post:

```bash
# Send to all subscribers
npm test

# Send to a specific email
node scripts/test-email.js test@example.com
```

### Embedding the Subscription Form

Copy the `public/subscription-form.html` file to your website and update the API endpoint URL to match your Cloudflare Worker.

## Monitoring

The service uses ntfy.sh for monitoring and alerts. You'll receive notifications for:

- RSS feed errors
- Email sending failures
- Service health issues

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
   - Check cron job is set up correctly
   - Verify Node.js is installed and working
   - Check logs for errors

### Logs

Logs are stored in the `logs` directory. Check `app.log` for the most recent activity.

## Maintenance

### Backing Up Subscribers

The subscribers data is stored in `data/subscribers.json`. Back up this file regularly.

### Updating the Service

To update the service:

```bash
git pull
npm install
```

Then restart the service or wait for the next cron job run.

## License

MIT
