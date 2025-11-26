#!/usr/bin/env node

/**
 * Script to push Prisma schema changes directly to database (no migration files)
 * Usage: node scripts/migrate.js
 * This uses 'prisma db push' which applies schema changes without creating migration files
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('Pushing schema changes to database (no migration files)...');
console.log('💡 Tip: Stop your backend server before running this to avoid file lock errors\n');

try {
  // Run prisma db push - applies schema directly without migration files
  const command = `npx prisma db push`;
  console.log(`Running: ${command}\n`);
  
  execSync(command, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: { ...process.env },
    shell: true,
  });
  
  console.log(`\n✅ Schema changes applied successfully!`);
  
  // Try to generate Prisma client (may fail if server is running)
  console.log('\nGenerating Prisma Client...');
  try {
    execSync('npx prisma generate', {
      stdio: 'pipe', // Use pipe to capture output
      cwd: path.join(__dirname, '..'),
      env: { ...process.env },
      shell: true,
    });
    console.log('✅ Prisma Client generated successfully!');
  } catch (generateError) {
    const errorOutput = generateError.stderr?.toString() || generateError.stdout?.toString() || generateError.message || '';
    
    // Check if it's an EPERM error (file lock)
    if (errorOutput.includes('EPERM') || errorOutput.includes('operation not permitted')) {
      console.log('\n⚠️  Warning: Could not regenerate Prisma Client (file is locked)');
      console.log('   This usually means your backend server is running.');
      console.log('   Solution: Stop the server, then run: npx prisma generate');
      console.log('   Or restart the server - it will regenerate automatically.');
      console.log('\n✅ Migration completed successfully (schema changes applied to database)');
      // Don't exit with error - the schema push succeeded
      process.exit(0);
    } else {
      // Some other error occurred
      console.error('\n⚠️  Warning: Prisma Client generation failed');
      if (errorOutput) {
        console.error(errorOutput);
      }
      console.log('\n✅ Migration completed successfully (schema changes applied to database)');
      console.log('   You may need to run "npx prisma generate" manually later.');
      // Don't exit with error - the schema push succeeded
      process.exit(0);
    }
  }
  
} catch (error) {
  // This catch only handles the db push failure
  console.error('\n❌ Schema push failed!');
  const errorOutput = error.stderr?.toString() || error.stdout?.toString() || error.message || '';
  if (errorOutput) {
    console.error(errorOutput);
  }
  console.error('\n💡 Make sure:');
  console.error('   1. Your database is running and accessible');
  console.error('   2. DATABASE_URL is set correctly in .env');
  console.error('   3. Your Prisma schema is valid');
  console.error('   4. Stop your backend server before running migrations');
  process.exit(1);
}

