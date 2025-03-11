const config = require('../src/config');
const emailSender = require('../src/emailSender');
const subscriberManager = require('../src/subscriberManager');
const rssParser = require('../src/rssParser');
const logger = require('../src/utils/logger');

// Fallback test post in case fetching from feed fails
const fallbackPost = {
  id: 'test-post-' + Date.now(),
  title: 'Test Post Title',
  link: 'https://mattsayar.com/test-post',
  pubDate: new Date().toISOString(),
  ogImage: 'https://mattsayar.com/media/website/logo.png'
};

// Send test email to specified address or all subscribers
async function sendTestEmail(emailAddress, useTestData = false) {
  logger.info('Starting rsspberry2email test email send');
  
  try {
    let post;
    
    if (useTestData) {
      logger.info('Using test data for email');
      console.log('Using fallback test data for email...');
      post = fallbackPost;
    } else {
      try {
        // Fetch the latest post from the RSS feed
        logger.info('Fetching latest post from RSS feed');
        console.log('Fetching latest post...');
        
        post = await rssParser.fetchLatestPost();
        
        logger.info(`Using latest post: "${post.title}" for test email`);
        console.log(`Using latest post: "${post.title}"`);
        console.log(`Link: ${post.link}`);
      } catch (fetchError) {
        logger.error(`Failed to fetch latest post: ${fetchError.message}`);
        console.error(`Failed to fetch latest post: ${fetchError.message}`);
        console.log('Falling back to test data...');
        post = fallbackPost;
      }
    }
    
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
    
    const results = await emailSender.sendNewPostEmail(subscribers, post);
    
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

// Parse command line arguments
const args = process.argv.slice(2);
const useTestData = args.includes('--use-test-data');
const testEmail = args.find(arg => !arg.startsWith('--'));

// Validate email if provided
if (testEmail) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(testEmail)) {
    console.error('Error: Invalid email address format');
    process.exit(1);
  }
  console.log(`Sending test email to: ${testEmail}`);
} else {
  console.log('Sending test email to all subscribers');
}

if (useTestData) {
  console.log('Using test data instead of fetching from RSS feed');
}

// Execute the test and handle process exit
sendTestEmail(testEmail, useTestData).then(() => {
  console.log('Test completed');
}).catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});