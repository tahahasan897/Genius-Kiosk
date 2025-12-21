#!/bin/bash

# Start Firebase Emulator and automatically seed test users

echo "🔧 Starting Firebase Auth Emulator..."
echo ""

# Start emulator in background
firebase emulators:start --only auth &
EMULATOR_PID=$!

# Give a brief moment for process to start
sleep 2

# Seed test users (the Node script will poll until emulator is ready)
node scripts/seed-emulator-users.js

# Show success message
echo ""
echo "✅ Emulator is running with test users!"
echo "📊 Emulator UI: http://localhost:4000"
echo "🔐 Auth Emulator: http://localhost:9099"
echo ""
echo "Press Ctrl+C to stop the emulator"
echo ""

# Wait for the background emulator process
wait $EMULATOR_PID
