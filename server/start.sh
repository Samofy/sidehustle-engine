#!/bin/sh

# Simple approach - try to find and build client if it exists
if [ -d "../client" ]; then
  echo "Building client..."
  (cd ../client && npm install && npm run build) || echo "Warning: Client build failed, continuing anyway..."
fi

# Run migrations
echo "Running database migrations..."
node db/migrate.js

if [ $? -eq 0 ]; then
  echo "Migrations successful, starting server..."
  node index.js
else
  echo "Migrations failed!"
  exit 1
fi
