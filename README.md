# rsspberry2email Service

A lightweight service meant to run on a Raspberry Pi that monitors an RSS feed for new content and emails subscribers when new posts are published. The service also manages email subscriptions through a simple form that can be embedded on a website, with a Cloudflare Worker acting as a secure proxy for subscription requests.

You're a good candidate for this software if:
* You have a statically-hosted website/blog with an RSS feed
* You want to offer newsletter updates to tens of people
* You use or want to use Cloudflare for DNS
* You have a Raspberry Pi or some other machine in your local network for grunt work
* You're relatively tech-savvy
* You're ~~cheap~~ too frugal to pay for a newsletter service

I wrote about this project [on my website](https://mattsayar.com/how-to-actually-run-a-free-newsletter-for-your-blog).

## Features

- **RSS Monitoring**: Checks the RSS feed at configurable intervals for new posts
- **Email Notifications**: Sends styled HTML emails to subscribers when new content is published
- **Subscription Management**: Handles subscriber sign-ups and (in the future) unsubscribes
- **Anti-Spam Protection**: Simple rate limiting and email validation
- **Monitoring**: Uses ntfy.sh for functionality, alerts, and health monitoring
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
- ntfy.sh topics 

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/MattSayar/rsspberry2email.git
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
- Create a .env file from the template (edit with your values!)
- Generate systemd service files
- Set up log rotation

### 3. Create ntfy.sh topics
1. Create a ntfy.sh account (or not, I'm not your dad)
2. Create unique, hard-to-guess topics (ntfy.sh can generate them for you)
3. Do that three times for alerts, subscribes, and unsubscribes (coming soon-ish!)
4. You can view a topic anytime at https://ntfy.sh/\[whatever\]

### 4. Deploy Cloudflare Worker
Raspberry Pis' architecture (linux arm LE) doesn't support wrangler CLI-based installs. Here is how to configure Cloudflare via the UI.

1. Log in to your Cloudflare dashboard at https://dash.cloudflare.com/
2. Navigate to "Workers & Pages" from the sidebar
3. Click "Create application" and select "Create Worker"
4. Give your worker a name (e.g., "subscribe-proxy")
5. In the editor, paste the code from `subscribe-proxy/index.js`
6. Click "Save and Deploy"

#### Set up KV namespace for rate limiting:

1. In the Cloudflare dashboard, go to "Workers & Pages"
2. Click on "Storage and Databases > KV" in the sidebar
3. Click "Create namespace"
4. Name it `RATE_LIMIT_NAMESPACE` and click "Add"
5. Go back to your Worker
6. Click on "Settings" and then "Variables and Secrets"
7. Under "Bindings", click the "+ Add" binding
8. Set the Variable name to `RATE_LIMIT_NAMESPACE` and select your KV namespace
9. Click "Save"

#### Configure environment variables:

1. Still in your worker's "Variables and Secrets" settings
2. Under "Variables and Secrets", click the "+ Add" button
3. Add the following variables:
   - `NTFY_SUBSCRIBE_TOPIC`: Your ntfy.sh subscription topic (text)
4. Click "Save"

#### Set up a route:

1. Still in your worker's Settings
2. Go to "Triggers" and click the "+ Add" button
4. Add a route like `yourdomain.com/api/subscribe*`
5. Click "Save"

## Usage

### Let systemd handle running it
This was already set up with the setup.sh script

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

The service uses [ntfy.sh](https://ntfy.sh/), a simple pub/sub service, for functionality, monitoring, and alerts. You'll receive notifications for:

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

## License

MIT
