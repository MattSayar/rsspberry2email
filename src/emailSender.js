const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const fetch = require('node-fetch');
const config = require('./config');
const logger = require('./utils/logger');

// Brevo API will use the API key from config

// Load email template
const templatePath = path.join(__dirname, '../templates', 'email.html');
const templateSource = fs.readFileSync(templatePath, 'utf8');
const template = Handlebars.compile(templateSource);

// Generate unsubscribe URL 
function generateUnsubscribeUrl(token) {
  return token; //TODO
}

// Send new post notification emails
async function sendNewPostEmail(subscribers, post) {
  logger.info(`Preparing to send emails to ${subscribers.length} subscribers`);
  
  // Create email promises
  const emailPromises = subscribers.map(subscriber => {
    // Render email template
    const html = template({
      postTitle: post.title,
      postImage: post.ogImage || 'https://mattsayar.com/media/website/logo.png', // who knows it is for your site
      postUrl: post.link,
      unsubscribeUrl: generateUnsubscribeUrl(subscriber.unsubscribeToken)
    });
    
    // Create email message for Brevo API
    const message = {
      sender: {
        name: config.email.fromName,
        email: config.email.from
      },
      to: [{
        email: subscriber.email
      }],
      subject: config.email.subject,
      htmlContent: html
    };
    
    // Send the email via Brevo API
    return fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': config.email.brevoApiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(message)
    })
    .then(response => {
      if (response.ok) {
        logger.info(`Email sent successfully to ${subscriber.email}`);
        return { success: true, email: subscriber.email };
      } else {
        return response.json().then(error => {
          logger.error(`Failed to send email to ${subscriber.email}: ${JSON.stringify(error)}`);
          return { success: false, email: subscriber.email, error };
        });
      }
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
