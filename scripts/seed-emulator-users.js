#!/usr/bin/env node

/**
 * Seeds Firebase Auth Emulator with test users
 * Reads from emulator-test-users.json and creates users via REST API
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EMULATOR_URL = 'http://127.0.0.1:9099';
const PROJECT_ID = 'demo-project';

async function createUser(email, password, displayName) {
  const url = `${EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      displayName: displayName || email,
      returnSecureToken: true
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create user ${email}: ${error}`);
  }

  const data = await response.json();
  return data;
}

async function waitForEmulator(maxAttempts = 30) {
  const healthUrl = `${EMULATOR_URL}/`;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await fetch(healthUrl, { method: 'GET' });
      // Any response means emulator is up
      return true;
    } catch {
      // Emulator not ready yet, wait and retry
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

async function seedUsers() {
  console.log('🌱 Seeding Firebase Emulator with test users...\n');

  // Read test users from config file
  const configPath = join(__dirname, '..', 'emulator-test-users.json');
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));

  // Wait for emulator to be ready (poll until it responds)
  console.log('⏳ Waiting for emulator to be ready');
  const isReady = await waitForEmulator(30);

  if (!isReady) {
    console.error('\n❌ Emulator did not start in time.');
    console.error('   Try running: npm run emulator:seed (after emulator is running)');
    process.exit(1);
  }

  console.log(' ready!\n');

  for (const user of config.users) {
    try {
      const result = await createUser(user.email, user.password, user.displayName);
      console.log(`✅ Created: ${user.email}`);
      console.log(`   UID: ${result.localId}`);
      console.log(`   Role: ${user.isSuperAdmin ? 'Super Admin' : 'Chain Admin'}`);
      if (user.chainIds) {
        console.log(`   Chains: ${user.chainIds.join(', ')}`);
      }
      console.log('');
    } catch (error) {
      console.error(`❌ Failed to create ${user.email}:`, error.message);
    }
  }

  console.log('✨ Done! Users created in emulator.');
  console.log('📝 Add these emails to your database admin_users table.\n');
}

seedUsers().catch(error => {
  console.error('Error seeding users:', error);
  process.exit(1);
});
