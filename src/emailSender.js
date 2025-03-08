const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const sendgrid = require('@sendgrid/mail');
const config = require('./config');
const logger = require('./utils/logger');

// Set SendGrid API key
sendgrid.setApiKey(config.email.sendgridApiKey);

// Load email template
const templatePath = path.join(__dirname, '../templates', 'email.html');
const templateSource = fs.readFileSync(templatePath, 'utf8');
const template = Handlebars.compile(templateSource);

// Generate unsubscribe URL
function generateUnsubscribeUrl(token) {
  return `https://ntfy.sh/${config.notifications.unsubscribeTopic}?c=Unsubscribe&t=${encodeURIComponent(token)}&action=view&redirect=https://yourdomain.com/unsubscribed`;
}

// Send new post notification emails
async function sendNewPostEmail(subscribers, post) {
  logger.info(`Preparing to send emails to ${subscribers.length} subscribers`);
  
  // Create email promises
  const emailPromises = subscribers.map(subscriber => {
    // Render email template
    const html = template({
      postTitle: post.title,
      postImage: post.ogImage || 'https://yourdomain.com/images/logo.png',
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
      .then(() => {
        logger.info(`Email sent successfully to ${subscriber.email}`);
        return { success: true, email: subscriber.email };
      })
      .catch(error => {
        logger.error(`Failed to send email to ${subscriber.email}: ${error.message}`);
        return { success: false, email: subscriber.email, error };
      });
  });
  
  // Send all emails with proper error handling
  const results = await Promise.allSettled(emailPromises)
    .then(outcomes => outcomes.map(outcome => 
      outcome.status === 'fulfilled' ? outcome.value : 
      { success: false, email: 'unknown', error: new Error(outcome.reason || 'Unknown error') }
    ));
  
  // Check for failures
  const failures = results.filter(result => !result.success);
  if (failures.length > 0) {
    logger.error(`Failed to send ${failures.length} emails`);
    if (failures.length > subscribers.length / 2) {
      // Alert if more than half of the emails failed
      const monitoring = require('./monitoring');
      monitoring.sendAlert(`Failed to send emails to ${failures.length} of ${subscribers.length} subscribers`);
    }
  }
  
  return results;
}

module.exports = {
  sendNewPostEmail,
  generateUnsubscribeUrl
};
