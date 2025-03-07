const http = require('http');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

// File types and their content types
const contentTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif'
};

// Create HTTP server
const server = http.createServer((req, res) => {
  logger.info(`Dashboard request: ${req.method} ${req.url}`);
  
  // Parse URL
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './public/dashboard.html';
  } else if (filePath === './data/subscribers.json') {
    // Serve the subscribers data file
    filePath = './data/subscribers.json';
  } else {
    // Serve files from public directory
    filePath = './public' + req.url;
  }
  
  // Get file extension
  const extname = path.extname(filePath);
  const contentType = contentTypes[extname] || 'text/plain';
  
  // Read file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        logger.warn(`File not found: ${filePath}`);
        res.writeHead(404);
        res.end('File not found');
      } else {
        // Server error
        logger.error(`Server error: ${error.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start server
function startDashboard(port = 3000) {
  server.listen(port, () => {
    logger.info(`Dashboard server running at http://localhost:${port}/`);
    console.log(`Dashboard server running at http://localhost:${port}/`);
  });
}

module.exports = {
  startDashboard
};
