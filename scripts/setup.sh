#!/bin/bash
# rsspberry2email Service Setup Script
# Usage: ./scripts/setup.sh

set -e

echo "=== rsspberry2email Service Setup ==="
echo

# Prompt for domain name
read -p "Enter your domain name (without http/https, e.g. example.com): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
  echo "Error: Domain name cannot be empty."
  exit 1
fi
echo "Using domain: $DOMAIN_NAME ✓"
echo

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "Please run this script as a regular user, not as root."
  exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d '.' -f 1)
if [ "$NODE_MAJOR" -lt 16 ]; then
  echo "Error: Node.js v16 or higher is required. Found v$NODE_VERSION"
  echo "Please upgrade Node.js and try again."
  exit 1
fi
echo "Node.js v$NODE_VERSION detected. ✓"

# Create necessary directories and set proper permissions
echo "Creating directories with proper permissions..."
mkdir -p data logs
touch logs/app.log
chmod 755 logs
chmod 644 logs/app.log
echo "Directories and log file created with proper permissions. ✓"

# Get the current user
CURRENT_USER=$(whoami)
echo "Setup is running as user: $CURRENT_USER"

# Find and replace yourdomain.com in all relevant files
echo "Updating domain references in project files..."
# More comprehensive find command to catch all file types
find src templates public scripts -type f | xargs grep -l "yourdomain\.com" 2>/dev/null | xargs sed -i.bak "s/yourdomain\.com/$DOMAIN_NAME/g" 2>/dev/null || true
# Clean up backup files created by sed
find . -name "*.bak" -type f -delete 2>/dev/null
echo "Domain references updated. ✓"

# Install dependencies
echo "Installing dependencies..."
npm install

# Set up environment variables
if [ ! -f .env ]; then
  echo "Setting up environment variables..."
  cp .env.example .env
  echo "Please edit .env file with your actual values:"
  echo "  SENDGRID_API_KEY: Your SendGrid API key"
  echo "  EMAIL_FROM: Email address to send from"
  echo "  EMAIL_FROM_NAME: Name to display in the from field"
  echo "  RSS_FEED_URL: URL of the RSS feed to monitor"
  echo "  NTFY_ALERT_TOPIC: ntfy.sh topic for system alerts"
  echo "  NTFY_SUBSCRIBE_TOPIC: ntfy.sh topic for subscription requests"
  echo "  NTFY_UNSUBSCRIBE_TOPIC: ntfy.sh topic for unsubscribe requests"
  echo
  read -p "Press Enter to continue after editing .env..."
else
  echo ".env file already exists, skipping..."
fi

# Set up log rotation
echo "Setting up log rotation..."
cat > logrotate.conf << EOF
$PWD/logs/app.log {
  daily
  rotate 7
  compress
  delaycompress
  missingok
  notifempty
  create 644 $USER $USER
}
EOF

echo "To set up log rotation, run:"
echo "  sudo cp logrotate.conf /etc/logrotate.d/rsspberry2email"

# Create systemd service file
echo "Creating systemd service file..."
cat > rsspberry2email.service << EOF
[Unit]
Description=RSS to Email Service
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$PWD
ExecStart=/usr/bin/node $PWD/src/index.js
Restart=on-failure
RestartSec=10
# Create log directory and set permissions on start if needed
ExecStartPre=/bin/bash -c "mkdir -p $PWD/logs && touch $PWD/logs/app.log && chmod 644 $PWD/logs/app.log"

# Set output to null to prevent duplicate logging since the app handles its own logging to app.log
StandardOutput=append:null
StandardError=append:null

[Install]
WantedBy=multi-user.target
EOF

echo "To install the systemd service, run:"
echo "  sudo cp rsspberry2email.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable rsspberry2email"
echo "  sudo systemctl start rsspberry2email"

echo
echo "Setup complete! Next steps:"
echo "1. Edit your .env file if you haven't already"
echo "2. Deploy the Cloudflare Worker using the instructions in the README"
echo "3. Set up the systemd service (instructions above)"
echo "4. Test the service with: node scripts/test-email.js your@email.com"
echo
echo "Your domain ($DOMAIN_NAME) has been configured in all relevant files."
echo

chmod +x scripts/setup.sh