#!/bin/bash
# Cloudflare Worker Deployment Script
# Usage: ./scripts/deploy-worker.sh

set -e

echo "=== Cloudflare Worker Deployment ==="
echo

# Check if Wrangler is installed
if ! command -v wrangler &> /dev/null; then
  echo "Wrangler CLI not found. Installing..."
  npm install -g wrangler
else
  echo "Wrangler CLI found."
fi

# Navigate to worker directory
cd subscribe-proxy

# Check if logged in to Cloudflare
echo "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
  echo "Not logged in to Cloudflare. Please login:"
  wrangler login
else
  echo "Already logged in to Cloudflare."
fi

# Create KV namespace if it doesn't exist
echo "Checking for KV namespace..."
KV_NAMESPACE_ID=$(grep -oP 'id = "\K[^"]+' wrangler.toml 2>/dev/null || echo "")

if [ "$KV_NAMESPACE_ID" = "your_kv_namespace_id_here" ] || [ -z "$KV_NAMESPACE_ID" ]; then
  echo "Creating KV namespace for rate limiting..."
  KV_OUTPUT=$(wrangler kv:namespace create "RATE_LIMIT")
  KV_NAMESPACE_ID=$(echo "$KV_OUTPUT" | grep -oP 'id = "\K[^"]+')
  
  # Update wrangler.toml with the new KV namespace ID
  sed -i "s/id = \"your_kv_namespace_id_here\"/id = \"$KV_NAMESPACE_ID\"/" wrangler.toml
  echo "Updated wrangler.toml with KV namespace ID: $KV_NAMESPACE_ID"
else
  echo "KV namespace already configured."
fi

# Check if NTFY_SUBSCRIBE_TOPIC is set
NTFY_TOPIC=$(grep -oP 'NTFY_SUBSCRIBE_TOPIC = "\K[^"]+' wrangler.toml)
if [ "$NTFY_TOPIC" = "your_subscribe_topic_here" ]; then
  echo "Please update the NTFY_SUBSCRIBE_TOPIC in wrangler.toml"
  read -p "Enter your ntfy.sh subscribe topic: " NEW_TOPIC
  sed -i "s/NTFY_SUBSCRIBE_TOPIC = \"your_subscribe_topic_here\"/NTFY_SUBSCRIBE_TOPIC = \"$NEW_TOPIC\"/" wrangler.toml
  echo "Updated wrangler.toml with ntfy.sh topic."
fi

# Deploy the worker
echo "Deploying Cloudflare Worker..."
wrangler publish

echo
echo "Deployment complete!"
echo "Next steps:"
echo "1. Set up a route in the Cloudflare dashboard to point yourdomain.com/api/subscribe to your worker"
echo "2. Update the subscription form HTML with your domain"
echo

# Return to the root directory
cd ..

chmod +x scripts/deploy-worker.sh
