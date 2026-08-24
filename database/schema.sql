-- =====================================================================
-- NexBank - MySQL schema
-- Designed and Developed by Sahithya K.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS nexbank
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nexbank;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs, notifications, loan_payments, loans, loan_products,
  bill_payments, bills, billers, cards, conversions, transfers, transactions,
  beneficiaries, wallet_balances, wallets, accounts, exchange_rates, currencies,
  role_permissions, permissions, users, roles;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Identity & access control
-- ---------------------------------------------------------------------
CREATE TABLE roles (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(50)  NOT NULL UNIQUE,
  label        VARCHAR(80)  NOT NULL,
  description  VARCHAR(255) NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(80)  NOT NULL UNIQUE,
  module       VARCHAR(40)  NOT NULL,
  description  VARCHAR(255) NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_permissions_module (module)
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id       INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role       FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name      VARCHAR(120) NOT NULL,
  email          VARCHAR(160) NOT NULL UNIQUE,
  phone          VARCHAR(20)  NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role_id        INT UNSIGNED NOT NULL,
  status         ENUM('active','suspended','pending') NOT NULL DEFAULT 'active',
  address        VARCHAR(255) NULL,
  managed_by     BIGINT UNSIGNED NULL COMMENT 'employee assigned to this customer',
  last_login_at  DATETIME NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role    FOREIGN KEY (role_id)    REFERENCES roles(id),
  CONSTRAINT fk_users_manager FOREIGN KEY (managed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_users_role   (role_id),
  INDEX idx_users_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Currencies (data-driven: adding a currency needs no schema change)
-- ---------------------------------------------------------------------
CREATE TABLE currencies (
  code        CHAR(3)      NOT NULL PRIMARY KEY,
  name        VARCHAR(60)  NOT NULL,
  symbol      VARCHAR(8)   NOT NULL,
  decimals    TINYINT UNSIGNED NOT NULL DEFAULT 2,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE exchange_rates (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  base_currency  CHAR(3) NOT NULL,
  quote_currency CHAR(3) NOT NULL,
  rate           DECIMAL(20,8) NOT NULL,
  effective_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rate_pair (base_currency, quote_currency),
  CONSTRAINT fk_rate_base  FOREIGN KEY (base_currency)  REFERENCES currencies(code) ON DELETE CASCADE,
  CONSTRAINT fk_rate_quote FOREIGN KEY (quote_currency) REFERENCES currencies(code) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------
CREATE TABLE accounts (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT UNSIGNED NOT NULL,
  account_number VARCHAR(20) NOT NULL UNIQUE,
  account_type   ENUM('savings','current','salary','fixed_deposit') NOT NULL DEFAULT 'savings',
  currency_code  CHAR(3) NOT NULL,
  balance        DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  status         ENUM('active','frozen','closed') NOT NULL DEFAULT 'active',
  ifsc_code      VARCHAR(15) NULL,
  branch         VARCHAR(80) NULL,
  opened_at      DATE NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_accounts_user     FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_accounts_currency FOREIGN KEY (currency_code) REFERENCES currencies(code),
  CONSTRAINT chk_accounts_balance CHECK (balance >= 0),
  INDEX idx_accounts_user   (user_id),
  INDEX idx_accounts_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Multi-currency wallet
-- ---------------------------------------------------------------------
CREATE TABLE wallets (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL UNIQUE,
  status      ENUM('active','frozen') NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE wallet_balances (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  wallet_id     BIGINT UNSIGNED NOT NULL,
  currency_code CHAR(3) NOT NULL,
  balance       DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wallet_currency (wallet_id, currency_code),
  CONSTRAINT fk_wb_wallet   FOREIGN KEY (wallet_id)     REFERENCES wallets(id)     ON DELETE CASCADE,
  CONSTRAINT fk_wb_currency FOREIGN KEY (currency_code) REFERENCES currencies(code),
  CONSTRAINT chk_wb_balance CHECK (balance >= 0)
) ENGINE=InnoDB;

CREATE TABLE conversions (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference      VARCHAR(30) NOT NULL UNIQUE,
  wallet_id      BIGINT UNSIGNED NOT NULL,
  user_id        BIGINT UNSIGNED NOT NULL,
  from_currency  CHAR(3) NOT NULL,
  to_currency    CHAR(3) NOT NULL,
  from_amount    DECIMAL(20,4) NOT NULL,
  to_amount      DECIMAL(20,4) NOT NULL,
  rate           DECIMAL(20,8) NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conv_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_conv_user (user_id, created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Beneficiaries, transactions, transfers
-- ---------------------------------------------------------------------
CREATE TABLE beneficiaries (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT UNSIGNED NOT NULL,
  nickname       VARCHAR(80) NOT NULL,
  account_number VARCHAR(20) NOT NULL,
  holder_name    VARCHAR(120) NOT NULL,
  bank_name      VARCHAR(120) NOT NULL DEFAULT 'NexBank',
  ifsc_code      VARCHAR(15) NULL,
  currency_code  CHAR(3) NOT NULL DEFAULT 'INR',
  is_internal    TINYINT(1) NOT NULL DEFAULT 1,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_beneficiary (user_id, account_number),
  CONSTRAINT fk_ben_user     FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ben_currency FOREIGN KEY (currency_code) REFERENCES currencies(code),
  INDEX idx_ben_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE transactions (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference         VARCHAR(30) NOT NULL UNIQUE,
  user_id           BIGINT UNSIGNED NOT NULL,
  account_id        BIGINT UNSIGNED NULL,
  wallet_id         BIGINT UNSIGNED NULL,
  type              ENUM('transfer_in','transfer_out','self_transfer','conversion',
                         'bill_payment','card_payment','loan_disbursement',
                         'loan_repayment','deposit','withdrawal','fee') NOT NULL,
  direction         ENUM('credit','debit') NOT NULL,
  description       VARCHAR(255) NOT NULL,
  counterparty_name VARCHAR(120) NULL,
  counterparty_ref  VARCHAR(40) NULL,
  amount            DECIMAL(20,4) NOT NULL,
  currency_code     CHAR(3) NOT NULL,
  balance_after     DECIMAL(20,4) NULL,
  status            ENUM('completed','pending','failed','cancelled') NOT NULL DEFAULT 'completed',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_txn_user     FOREIGN KEY (user_id)       REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_txn_account  FOREIGN KEY (account_id)    REFERENCES accounts(id)  ON DELETE SET NULL,
  CONSTRAINT fk_txn_wallet   FOREIGN KEY (wallet_id)     REFERENCES wallets(id)   ON DELETE SET NULL,
  CONSTRAINT fk_txn_currency FOREIGN KEY (currency_code) REFERENCES currencies(code),
  INDEX idx_txn_user_date (user_id, created_at),
  INDEX idx_txn_status    (status),
  INDEX idx_txn_type      (type),
  INDEX idx_txn_account   (account_id)
) ENGINE=InnoDB;

CREATE TABLE transfers (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference           VARCHAR(30) NOT NULL UNIQUE,
  idempotency_key     VARCHAR(64) NULL,
  sender_user_id      BIGINT UNSIGNED NOT NULL,
  sender_account_id   BIGINT UNSIGNED NOT NULL,
  receiver_account_id BIGINT UNSIGNED NULL,
  beneficiary_id      BIGINT UNSIGNED NULL,
  amount              DECIMAL(18,2) NOT NULL,
  currency_code       CHAR(3) NOT NULL,
  remarks             VARCHAR(255) NULL,
  status              ENUM('completed','pending','failed','cancelled') NOT NULL DEFAULT 'completed',
  failure_reason      VARCHAR(255) NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_transfer_idem (sender_user_id, idempotency_key),
  CONSTRAINT fk_tr_sender   FOREIGN KEY (sender_user_id)      REFERENCES users(id)         ON DELETE CASCADE,
  CONSTRAINT fk_tr_from     FOREIGN KEY (sender_account_id)   REFERENCES accounts(id),
  CONSTRAINT fk_tr_to       FOREIGN KEY (receiver_account_id) REFERENCES accounts(id)      ON DELETE SET NULL,
  CONSTRAINT fk_tr_ben      FOREIGN KEY (beneficiary_id)      REFERENCES beneficiaries(id) ON DELETE SET NULL,
  CONSTRAINT fk_tr_currency FOREIGN KEY (currency_code)       REFERENCES currencies(code),
  INDEX idx_tr_sender (sender_user_id, created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------
CREATE TABLE cards (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT UNSIGNED NOT NULL,
  account_id     BIGINT UNSIGNED NULL,
  card_type      ENUM('debit','credit') NOT NULL,
  network        ENUM('visa','mastercard','rupay','amex') NOT NULL DEFAULT 'visa',
  last_four      CHAR(4) NOT NULL,
  card_holder    VARCHAR(120) NOT NULL,
  expiry_month   TINYINT UNSIGNED NOT NULL,
  expiry_year    SMALLINT UNSIGNED NOT NULL,
  status         ENUM('active','blocked','expired') NOT NULL DEFAULT 'active',
  daily_limit    DECIMAL(18,2) NOT NULL DEFAULT 50000.00,
  credit_limit   DECIMAL(18,2) NULL,
  online_enabled TINYINT(1) NOT NULL DEFAULT 1,
  intl_enabled   TINYINT(1) NOT NULL DEFAULT 0,
  contactless    TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cards_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_cards_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  INDEX idx_cards_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bills
-- ---------------------------------------------------------------------
CREATE TABLE billers (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  category   ENUM('electricity','water','internet','mobile','dth','gas','insurance','other') NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_biller (name, category),
  INDEX idx_billers_category (category)
) ENGINE=InnoDB;

CREATE TABLE bills (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  biller_id       INT UNSIGNED NOT NULL,
  consumer_number VARCHAR(60) NOT NULL,
  label           VARCHAR(120) NULL,
  amount          DECIMAL(18,2) NOT NULL,
  currency_code   CHAR(3) NOT NULL DEFAULT 'INR',
  due_date        DATE NOT NULL,
  status          ENUM('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bills_user     FOREIGN KEY (user_id)       REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_bills_biller   FOREIGN KEY (biller_id)     REFERENCES billers(id),
  CONSTRAINT fk_bills_currency FOREIGN KEY (currency_code) REFERENCES currencies(code),
  INDEX idx_bills_user_status (user_id, status)
) ENGINE=InnoDB;

CREATE TABLE bill_payments (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference     VARCHAR(30) NOT NULL UNIQUE,
  bill_id       BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  account_id    BIGINT UNSIGNED NOT NULL,
  amount        DECIMAL(18,2) NOT NULL,
  currency_code CHAR(3) NOT NULL,
  status        ENUM('completed','pending','failed') NOT NULL DEFAULT 'completed',
  paid_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bp_bill    FOREIGN KEY (bill_id)    REFERENCES bills(id)    ON DELETE CASCADE,
  CONSTRAINT fk_bp_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_bp_account FOREIGN KEY (account_id) REFERENCES accounts(id),
  INDEX idx_bp_user (user_id, paid_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Loans
-- ---------------------------------------------------------------------
CREATE TABLE loan_products (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(120) NOT NULL UNIQUE,
  description       VARCHAR(255) NULL,
  interest_rate     DECIMAL(5,2) NOT NULL,
  min_amount        DECIMAL(18,2) NOT NULL,
  max_amount        DECIMAL(18,2) NOT NULL,
  min_tenure_months SMALLINT UNSIGNED NOT NULL DEFAULT 6,
  max_tenure_months SMALLINT UNSIGNED NOT NULL DEFAULT 240,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE loans (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference      VARCHAR(30) NOT NULL UNIQUE,
  user_id        BIGINT UNSIGNED NOT NULL,
  product_id     INT UNSIGNED NOT NULL,
  account_id     BIGINT UNSIGNED NULL,
  principal      DECIMAL(18,2) NOT NULL,
  interest_rate  DECIMAL(5,2) NOT NULL,
  tenure_months  SMALLINT UNSIGNED NOT NULL,
  emi_amount     DECIMAL(18,2) NOT NULL,
  outstanding    DECIMAL(18,2) NOT NULL,
  currency_code  CHAR(3) NOT NULL DEFAULT 'INR',
  purpose        VARCHAR(255) NULL,
  status         ENUM('applied','under_review','approved','rejected','active','closed') NOT NULL DEFAULT 'applied',
  decided_by     BIGINT UNSIGNED NULL,
  decided_at     DATETIME NULL,
  decision_note  VARCHAR(255) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_loans_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_loans_product FOREIGN KEY (product_id) REFERENCES loan_products(id),
  CONSTRAINT fk_loans_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_loans_officer FOREIGN KEY (decided_by) REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_loans_user   (user_id),
  INDEX idx_loans_status (status)
) ENGINE=InnoDB;

CREATE TABLE loan_payments (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference  VARCHAR(30) NOT NULL UNIQUE,
  loan_id    BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  account_id BIGINT UNSIGNED NULL,
  amount     DECIMAL(18,2) NOT NULL,
  status     ENUM('completed','pending','failed') NOT NULL DEFAULT 'completed',
  paid_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lp_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
  CONSTRAINT fk_lp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_lp_loan (loan_id, paid_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Notifications & audit
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  title      VARCHAR(160) NOT NULL,
  message    VARCHAR(500) NOT NULL,
  type       ENUM('transaction','transfer','security','payment','system') NOT NULL DEFAULT 'system',
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id, is_read, created_at)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NULL,
  actor_email VARCHAR(160) NULL,
  action      VARCHAR(80) NOT NULL,
  entity_type VARCHAR(60) NULL,
  entity_id   VARCHAR(60) NULL,
  description VARCHAR(500) NULL,
  status      ENUM('success','failure') NOT NULL DEFAULT 'success',
  ip_address  VARCHAR(64) NULL,
  user_agent  VARCHAR(255) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_action (action),
  INDEX idx_audit_user   (user_id, created_at),
  INDEX idx_audit_date   (created_at)
) ENGINE=InnoDB;
