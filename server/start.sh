#!/bin/sh

# Build client first
echo "Building client..."
cd ../client
npm install
npm run build
cd ../server

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
