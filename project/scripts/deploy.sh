#!/bin/bash
set -euo pipefail

echo "=== AIKEN v2 Deploy ==="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and configure."
  exit 1
fi

# Build
echo "1. Building..."
npm run build
echo "   Build complete."

# Deploy Firestore rules
echo "2. Deploying Firestore rules..."
npx firebase deploy --only firestore:rules
echo "   Rules deployed."

# Deploy hosting
echo "3. Deploying to Firebase Hosting..."
npx firebase deploy --only hosting
echo "   Hosting deployed."

echo ""
echo "=== Deploy Complete ==="
echo "Site URL: https://$(npx firebase hosting:channel:list 2>/dev/null | head -1 || echo 'your-project.web.app')"
