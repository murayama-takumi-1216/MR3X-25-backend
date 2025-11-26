#!/usr/bin/env node

/**
 * Script to create Prisma migrations with automatic naming
 * Usage: node scripts/migrate.js [migration-name]
 * If no name is provided, it will use a timestamp-based name
 */

const { execSync } = require('child_process');
const path = require('path');

// Get migration name from command line argument or generate one
const customName = process.argv[2];
let migrationName;

if (customName) {
  // Use custom name if provided
  migrationName = customName;
} else {
  // Generate automatic name with timestamp
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
  migrationName = `auto_${timestamp}`;
}

console.log(`Creating migration: ${migrationName}`);

try {
  // Run prisma migrate dev with the generated name
  execSync(
    `npx prisma migrate dev --name ${migrationName}`,
    {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    }
  );
  console.log(`✅ Migration "${migrationName}" created successfully!`);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}

