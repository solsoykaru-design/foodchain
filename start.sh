#!/bin/bash
# Production start script for FoodChain
# Run: chmod +x start.sh && ./start.sh

set -e

echo "=== Building portal frontend ==="
cd portal/frontend
npm install && npm run build
cd ../..

echo "=== Building SPAs ==="
npm run build:website 2>/dev/null || echo "website build skipped"
npm run build:guest 2>/dev/null || echo "guest build skipped"
npm run build:admin 2>/dev/null || echo "admin build skipped"
npm run build:courier 2>/dev/null || echo "courier build skipped"
npm run build:waiter 2>/dev/null || echo "waiter build skipped"
npm run build:kitchen 2>/dev/null || echo "kitchen build skipped"

echo "=== Starting server ==="
cd server && node index.js
