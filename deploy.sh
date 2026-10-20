#!/bin/bash

# Color Hut Deployment & Fix Script for CyberPanel
echo "Starting Deployment and Maintenance..."

# 1. Pull latest changes
echo "Pulling latest code from GitHub..."
git pull origin restore

# 2. Install dependencies (fixed with .npmrc)
echo "Installing dependencies..."
npm install --legacy-peer-deps

# 3. Running migrations
echo "Running database migrations..."
node scripts/migrate-trash-by.js

# 4. Build the application
echo "Building the application..."
npm run build

# 4. Restart the server (assuming PM2 is used on CyberPanel)
# Replace 'erpapp' with your actual PM2 process name if different
echo "Restarting application via PM2..."
pm2 restart all || npm start

echo "Deployment and Fixes applied successfully!"
