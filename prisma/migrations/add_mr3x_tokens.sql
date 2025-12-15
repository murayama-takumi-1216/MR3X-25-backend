ALTER TABLE `agencies` ADD COLUMN `token` VARCHAR(50) NULL UNIQUE AFTER `id`;
CREATE UNIQUE INDEX `agencies_token_key` ON `agencies`(`token`);

ALTER TABLE `users` ADD COLUMN `token` VARCHAR(50) NULL UNIQUE AFTER `id`;
CREATE UNIQUE INDEX `users_token_key` ON `users`(`token`);

ALTER TABLE `properties` ADD COLUMN `token` VARCHAR(50) NULL UNIQUE AFTER `id`;
CREATE UNIQUE INDEX `properties_token_key` ON `properties`(`token`);

ALTER TABLE `documents` ADD COLUMN `token` VARCHAR(50) NULL UNIQUE AFTER `id`;
CREATE UNIQUE INDEX `documents_token_key` ON `documents`(`token`);

ALTER TABLE `invoices` ADD COLUMN `token` VARCHAR(50) NULL UNIQUE AFTER `id`;
CREATE UNIQUE INDEX `invoices_token_key` ON `invoices`(`token`);
