# Brevo Migration TODO for rsspberry2email

## Prerequisites
- [ ] Sign up for Brevo account at https://www.brevo.com
- [ ] Get API key from Settings > SMTP & API > API Keys
- [ ] Note: Brevo API v3 key format is: `xkeysib-[64 character string]`

## Code Changes

### 1. Environment Variables
- [ ] Update `.env` file:
  ```env
  # Replace this:
  SENDGRID_API_KEY=your_sendgrid_api_key_here
  
  # With this:
  BREVO_API_KEY=your_brevo_api_key_here
  ```

- [ ] Update `.env.example`:
  ```env
  # Replace this:
  SENDGRID_API_KEY=your_sendgrid_api_key_here
  
  # With this:
  BREVO_API_KEY=your_brevo_api_key_here
  ```

### 2. Configuration (src/config.js)
- [ ] Update the email configuration object:
  ```javascript
  // Replace this line:
  sendgridApiKey: process.env.SENDGRID_API_KEY
  
  // With this line:
  brevoApiKey: process.env.BREVO_API_KEY
  ```

### 3. Package Dependencies (package.json)
- [ ] Remove SendGrid dependency:
  ```bash
  npm uninstall @sendgrid/mail
  ```
  
- [ ] No new dependencies needed! Brevo works with existing `node-fetch`

### 4. Email Sender Module (src/emailSender.js)
This is the main file that needs changes:

- [ ] Remove SendGrid import:
  ```javascript
  // Delete this line:
  const sendgrid = require('@sendgrid/mail');
  ```

- [ ] Remove SendGrid initialization:
  ```javascript
  // Delete this line:
  sendgrid.setApiKey(config.email.sendgridApiKey);
  ```

- [ ] Replace the entire `sendNewPostEmail` function with Brevo implementation:
  ```javascript
  // Send new post notification emails using Brevo API
  async function sendNewPostEmail(subscribers, post) {
    logger.info(`Preparing to send emails to ${subscribers.length} subscribers`);
    
    // Create email promises
    const emailPromises = subscribers.map(subscriber => {
      // Render email template
      const html = template({
        postTitle: post.title,
        postImage: post.ogImage || 'https://yourdomain.com/media/website/logo.png',
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
  ```

### 5. Documentation Updates
- [ ] Update README.md:
  - [ ] Change "SendGrid account for email delivery" to "Brevo account for email delivery"
  - [ ] Update any SendGrid-specific instructions
  - [ ] Update the architecture diagram if it mentions SendGrid

- [ ] Update setup script comments (scripts/setup.sh):
  - [ ] Change references from SENDGRID_API_KEY to BREVO_API_KEY

### 6. Testing
- [ ] Test email sending with the test script:
  ```bash
  node scripts/test-email.js test@example.com
  ```

- [ ] Verify email formatting looks correct
- [ ] Check that unsubscribe links are included (even if not functional yet)
- [ ] Confirm emails arrive in inbox (not spam)

## Optional Improvements

### Use Brevo SMTP Instead of API (Alternative Approach)
If you prefer SMTP over API, you can use nodemailer with Brevo's SMTP settings:

- [ ] Install nodemailer: `npm install nodemailer`
- [ ] Use these SMTP settings:
  ```javascript
  const transporter = nodemailer.createTransporter({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: config.email.from, // Your email
      pass: config.email.brevoSmtpKey // SMTP key (different from API key)
    }
  });
  ```

### Domain Authentication
- [ ] Add your domain in Brevo dashboard
- [ ] Configure SPF, DKIM, and DMARC records for better deliverability

## Brevo API Reference
- API Documentation: https://developers.brevo.com/reference/sendtransacemail
- API Endpoint: `https://api.brevo.com/v3/smtp/email`
- Required Headers:
  - `api-key`: Your Brevo API key
  - `content-type`: application/json
  - `accept`: application/json

## Differences from SendGrid
1. **API Structure**: Brevo uses `htmlContent` instead of `html`
2. **Sender Format**: Brevo uses object with `name` and `email` fields
3. **Recipients**: Brevo uses array of objects for `to` field
4. **No Tracking**: Tracking is disabled by default in Brevo (good for privacy)

## Troubleshooting
- [ ] If emails don't send, check:
  - API key is correct and active
  - Sender email is verified in Brevo
  - API response for specific error messages
  - Brevo dashboard for sending logs

## Rollback Plan
If you need to switch back to SendGrid:
1. Restore original `src/emailSender.js`
2. Change `brevoApiKey` back to `sendgridApiKey` in config.js
3. Update `.env` with SendGrid API key
4. Run `npm install @sendgrid/mail`