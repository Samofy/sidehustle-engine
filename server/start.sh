#!/bin/sh
echo "Running database migrations..."
node db/migrate.js

if [ $? -eq 0 ]; then
  echo "Migrations successful, starting server..."
  node index.js
else
  echo "Migrations failed!"
  exit 1
fi
