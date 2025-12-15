ALTER TABLE `email_verifications` ALTER COLUMN `expires_at` DROP DEFAULT;

ALTER TABLE `igpm_index` ALTER COLUMN `created_at` DROP DEFAULT;

ALTER TABLE `notifications` ALTER COLUMN `creation_date` DROP DEFAULT;

ALTER TABLE `payments` ALTER COLUMN `data_pagamento` DROP DEFAULT;

ALTER TABLE `refresh_tokens` ALTER COLUMN `expires_at` DROP DEFAULT;
