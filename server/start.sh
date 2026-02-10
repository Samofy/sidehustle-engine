#!/bin/sh

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Build client first
echo "Building client..."
cd "$PROJECT_ROOT/client" || exit 1
npm install
npm run build
echo "Client build complete!"

# Go back to server directory
cd "$SCRIPT_DIR" || exit 1

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
