require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = [
  'BREVO_API_KEY',
  'NTFY_ALERT_TOPIC',
  'NTFY_SUBSCRIBE_TOPIC',
  'NTFY_UNSUBSCRIBE_TOPIC',
  'EMAIL_FROM',
  'EMAIL_FROM_NAME',
  'RSS_FEED_URL',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please check your .env file or environment configuration.');
  process.exit(1);
}

module.exports = {
  rss: {
    feedUrl: process.env.RSS_FEED_URL,
    checkIntervalHours: 1
  },
  email: {
    from: process.env.EMAIL_FROM,
    fromName: process.env.EMAIL_FROM_NAME,
    subject: 'New Post',
    brevoApiKey: process.env.BREVO_API_KEY
  },
  notifications: {
    alertTopic: process.env.NTFY_ALERT_TOPIC,
    subscribeTopic: process.env.NTFY_SUBSCRIBE_TOPIC,
    unsubscribeTopic: process.env.NTFY_UNSUBSCRIBE_TOPIC,
    ntfyPriority: 3 // default priority
  },
  healthCheck: {
    maxHoursBetweenRuns: 3, // Alert if service hasn't run for this many hours
  }
};
