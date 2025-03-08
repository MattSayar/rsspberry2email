#!/bin/bash
# rsspberry2email Service Setup Script
# Usage: ./scripts/setup.sh

set -e

echo "=== rsspberry2email Service Setup ==="
echo

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "Please run this script as a regular user, not as root."
  exit 1
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p data logs

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
User=$USER
WorkingDirectory=$PWD
ExecStart=/usr/bin/node $PWD/src/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:$PWD/logs/app.log
StandardError=append:$PWD/logs/app.log

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
echo "3. Set up the systemd service or cron job"
echo "4. Test the service with: node scripts/test-email.js your@email.com"
echo

chmod +x scripts/setup.sh
