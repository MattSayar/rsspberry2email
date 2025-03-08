require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = [
  'SENDGRID_API_KEY',
  'NTFY_ALERT_TOPIC',
  'NTFY_SUBSCRIBE_TOPIC',
  'NTFY_UNSUBSCRIBE_TOPIC'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please check your .env file or environment configuration.');
  process.exit(1);
}

module.exports = {
  rss: {
    feedUrl: 'https://mattsayar.com/feed.xml',
    checkIntervalHours: 1
  },
  email: {
    from: 'matt@mattsayar.com',
    subject: 'New Post from Matt Sayar',
    sendgridApiKey: process.env.SENDGRID_API_KEY
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
