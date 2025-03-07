const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const config = require('./config');
const logger = require('./utils/logger');

// Path to subscribers data file
const SUBSCRIBERS_FILE = path.join(__dirname, '../data', 'subscribers.json');

// Authenticate with Google Drive
async function authenticateGoogleDrive() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: config.backup.googleDriveCredentialsPath,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    
    const client = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: client });
    
    logger.info('Successfully authenticated with Google Drive');
    return drive;
  } catch (error) {
    logger.error(`Google Drive authentication error: ${error.message}`);
    throw error;
  }
}

// Backup subscribers file to Google Drive
async function backupToGoogleDrive() {
  if (!config.backup.enabled) {
    logger.info('Google Drive backup is disabled in config');
    return false;
  }
  
  try {
    logger.info('Starting Google Drive backup');
    
    // Check if subscribers file exists
    if (!fs.existsSync(SUBSCRIBERS_FILE)) {
      logger.warn('Subscribers file does not exist, nothing to backup');
      return false;
    }
    
    // Authenticate with Google Drive
    const drive = await authenticateGoogleDrive();
    
    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupFilename = `subscribers-backup-${timestamp}.json`;
    
    // Upload file to Google Drive
    const fileMetadata = {
      name: backupFilename,
      parents: [] // Add folder ID here if you want to upload to a specific folder
    };
    
    const media = {
      mimeType: 'application/json',
      body: fs.createReadStream(SUBSCRIBERS_FILE)
    };
    
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });
    
    logger.info(`Backup successful. File ID: ${response.data.id}`);
    return true;
  } catch (error) {
    logger.error(`Backup failed: ${error.message}`);
    return false;
  }
}

// Start backup schedule
function startBackupSchedule() {
  if (!config.backup.enabled) {
    logger.info('Google Drive backup is disabled, not starting schedule');
    return;
  }
  
  logger.info(`Starting Google Drive backup schedule (every ${config.backup.backupIntervalHours} hours)`);
  
  // Run backup immediately
  backupToGoogleDrive();
  
  // Schedule regular backups
  const intervalMs = config.backup.backupIntervalHours * 60 * 60 * 1000;
  setInterval(backupToGoogleDrive, intervalMs);
}

module.exports = {
  authenticateGoogleDrive,
  backupToGoogleDrive,
  startBackupSchedule
};
