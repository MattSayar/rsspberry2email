const config = require('../src/config');
const emailSender = require('../src/emailSender');
const subscriberManager = require('../src/subscriberManager');
const logger = require('../src/utils/logger');

// Override rsspberry2email feed with test data
const testPost = {
  id: 'test-post-' + Date.now(),
  title: 'Test Post Title',
  link: 'https://mattsayar.com/test-post',
  pubDate: new Date().toISOString(),
  ogImage: 'https://mattsayar.com/media/website/logo.png'
};

// Send test email to specified address or all subscribers
async function sendTestEmail(emailAddress) {
  logger.info('Starting rsspberry2email test email send');
  
  try {
    const subscribers = emailAddress ? 
      [{ email: emailAddress, unsubscribeToken: 'test-token' }] : 
      subscriberManager.getSubscribers();
    
    if (subscribers.length === 0) {
      logger.info('No subscribers to send to');
      console.log('No subscribers to send to. Add subscribers first or specify an email address.');
      return;
    }
    
    logger.info(`Sending test email to ${subscribers.length} recipient(s)`);
    console.log(`Sending test email to ${subscribers.length} recipient(s)...`);
    
    const results = await emailSender.sendNewPostEmail(subscribers, testPost);
    
    // Count successes and failures
    const successes = results.filter(r => r.success).length;
    const failures = results.filter(r => !r.success).length;
    
    logger.info(`Test email sending complete. Successes: ${successes}, Failures: ${failures}`);
    console.log(`Test email sending complete.`);
    console.log(`Successes: ${successes}, Failures: ${failures}`);
    
    if (failures > 0) {
      console.log('Failed recipients:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`- ${r.email}: ${r.error.message}`);
      });
    }
  } catch (error) {
    logger.error(`Test email error: ${error.message}`);
    console.error(`Error sending test email: ${error.message}`);
  }
}

// Run test with command line arg: node test-email.js [email@example.com]
const testEmail = process.argv[2];
if (testEmail) {
  console.log(`Sending test email to: ${testEmail}`);
} else {
  console.log('Sending test email to all subscribers');
}

sendTestEmail(testEmail);
