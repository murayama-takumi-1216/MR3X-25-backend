ALTER TABLE `contracts`
ADD COLUMN `early_termination_penalty_percent` DECIMAL(5, 2) NULL DEFAULT 3.0 COMMENT 'Percentage of monthly rent for early termination penalty',
ADD COLUMN `late_fee_percent` DECIMAL(5, 2) NULL DEFAULT 2.0 COMMENT 'Late payment fine percentage',
ADD COLUMN `daily_penalty_percent` DECIMAL(5, 2) NULL DEFAULT 0.33 COMMENT 'Daily penalty percentage per day overdue',
ADD COLUMN `interest_rate_percent` DECIMAL(5, 2) NULL DEFAULT 1.0 COMMENT 'Monthly interest rate on overdue payments',
ADD COLUMN `early_payment_discount_percent` DECIMAL(5, 2) NULL DEFAULT 0.0 COMMENT 'Discount percentage for early payment',
ADD COLUMN `early_payment_discount_days` INTEGER NULL DEFAULT 0 COMMENT 'Days before due date to receive discount',
ADD COLUMN `readjustment_index` VARCHAR(20) NULL DEFAULT 'IGPM' COMMENT 'Index for annual rent readjustment: IGPM, IPCA, INPC, IGP-M',
ADD COLUMN `readjustment_month` INTEGER NULL DEFAULT 12 COMMENT 'Month of annual readjustment (1-12)';

ALTER TABLE `agencies`
ADD COLUMN `default_early_termination_penalty_percent` DECIMAL(5, 2) NULL DEFAULT 3.0,
ADD COLUMN `default_late_fee_percent` DECIMAL(5, 2) NULL DEFAULT 2.0,
ADD COLUMN `default_daily_penalty_percent` DECIMAL(5, 2) NULL DEFAULT 0.33,
ADD COLUMN `default_interest_rate_percent` DECIMAL(5, 2) NULL DEFAULT 1.0,
ADD COLUMN `default_early_payment_discount_percent` DECIMAL(5, 2) NULL DEFAULT 0.0,
ADD COLUMN `default_early_payment_discount_days` INTEGER NULL DEFAULT 0,
ADD COLUMN `default_readjustment_index` VARCHAR(20) NULL DEFAULT 'IGPM',
ADD COLUMN `default_readjustment_month` INTEGER NULL DEFAULT 12;
