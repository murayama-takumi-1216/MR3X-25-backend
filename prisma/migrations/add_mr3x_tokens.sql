-- Migration: Add MR3X Token Fields
-- Description: Adds token fields in MR3X-XXX-YEAR-XXXX-XXXX format for government-required identification
-- Date: 2025-12-08

-- Add token to agencies table
ALTER TABLE `agencies` ADD COLUMN `token` VARCHAR(50) NULL UNIQUE AFTER `id`;
CREATE UNIQUE INDEX `agencies_token_key` ON `agencies`(`token`);

-- Add token to users table (for tenants and owners)
ALTER TABLE `users` ADD COLUMN `token` VARCHAR(50) NULL UNIQUE AFTER `id`;
CREATE UNIQUE INDEX `users_token_key` ON `users`(`token`);

-- Add token to properties table
ALTER TABLE `properties` ADD COLUMN `token` VARCHAR(50) NULL UNIQUE AFTER `id`;
CREATE UNIQUE INDEX `properties_token_key` ON `properties`(`token`);

-- Add token to documents table
ALTER TABLE `documents` ADD COLUMN `token` VARCHAR(50) NULL UNIQUE AFTER `id`;
CREATE UNIQUE INDEX `documents_token_key` ON `documents`(`token`);

-- Add token to invoices table
ALTER TABLE `invoices` ADD COLUMN `token` VARCHAR(50) NULL UNIQUE AFTER `id`;
CREATE UNIQUE INDEX `invoices_token_key` ON `invoices`(`token`);

-- Note: Contracts already have a token field, no change needed
-- Note: Existing records will have NULL tokens, they will be generated on next update or via migration script
