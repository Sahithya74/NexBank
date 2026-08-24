-- =====================================================================
-- NexBank - seed data (demo dataset)
-- Designed and Developed by Sahithya K.
--
-- All demo accounts use the password: Password@123
-- Replace __PASSWORD_HASH__ by running:  npm run seed:hash --prefix server
-- =====================================================================

USE nexbank;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE notifications;
TRUNCATE TABLE loan_payments;
TRUNCATE TABLE loans;
TRUNCATE TABLE loan_products;
TRUNCATE TABLE bill_payments;
TRUNCATE TABLE bills;
TRUNCATE TABLE billers;
TRUNCATE TABLE cards;
TRUNCATE TABLE conversions;
TRUNCATE TABLE transfers;
TRUNCATE TABLE transactions;
TRUNCATE TABLE beneficiaries;
TRUNCATE TABLE wallet_balances;
TRUNCATE TABLE wallets;
TRUNCATE TABLE accounts;
TRUNCATE TABLE exchange_rates;
TRUNCATE TABLE currencies;
TRUNCATE TABLE role_permissions;
TRUNCATE TABLE permissions;
TRUNCATE TABLE users;
TRUNCATE TABLE roles;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------
INSERT INTO roles (id, name, label, description) VALUES
  (1, 'admin',    'Administrator', 'Full platform administration and configuration'),
  (2, 'manager',  'Manager',       'Approvals, monitoring and reporting'),
  (3, 'employee', 'Bank Employee', 'Servicing assigned customers'),
  (4, 'customer', 'Customer',      'Retail banking customer');

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
INSERT INTO permissions (code, module, description) VALUES
  ('profile.view',             'profile',      'View own profile'),
  ('profile.update',           'profile',      'Update own profile'),
  ('account.view.own',         'accounts',     'View own bank accounts'),
  ('account.view.assigned',    'accounts',     'View accounts of assigned customers'),
  ('account.view.all',         'accounts',     'View all bank accounts'),
  ('account.manage',           'accounts',     'Create, freeze and close accounts'),
  ('wallet.view.own',          'wallet',       'View own multi-currency wallet'),
  ('wallet.view.all',          'wallet',       'View all customer wallets'),
  ('wallet.manage',            'wallet',       'Add and remove wallet currencies'),
  ('wallet.convert',           'wallet',       'Convert between wallet currencies'),
  ('transfer.create',          'transfers',    'Initiate fund transfers'),
  ('transfer.view.own',        'transfers',    'View own transfers'),
  ('transfer.view.all',        'transfers',    'View all transfers'),
  ('beneficiary.manage',       'transfers',    'Manage beneficiaries'),
  ('transaction.view.own',     'transactions', 'View own transactions'),
  ('transaction.view.assigned','transactions', 'View transactions of assigned customers'),
  ('transaction.view.all',     'transactions', 'View all transactions'),
  ('transaction.review',       'transactions', 'Review and flag transactions'),
  ('bill.manage',              'bills',        'Add and manage billers and bills'),
  ('bill.pay',                 'bills',        'Pay bills'),
  ('card.view',                'cards',        'View own cards'),
  ('card.manage',              'cards',        'Block, unblock and control cards'),
  ('loan.apply',               'loans',        'Apply for a loan'),
  ('loan.view.own',            'loans',        'View own loans'),
  ('loan.view.all',            'loans',        'View all loan applications'),
  ('loan.review',              'loans',        'Move loans through review'),
  ('loan.approve',             'loans',        'Approve or reject loan applications'),
  ('loan.repay',               'loans',        'Make loan repayments'),
  ('notification.view',        'notifications','View own notifications'),
  ('request.process',          'support',      'Process customer service requests'),
  ('user.view',                'admin',        'View platform users'),
  ('user.manage',              'admin',        'Create, update and suspend users'),
  ('role.view',                'admin',        'View roles and permissions'),
  ('role.manage',              'admin',        'Assign permissions to roles'),
  ('audit.view',               'admin',        'View audit logs'),
  ('report.view',              'admin',        'View reports and analytics'),
  ('admin.dashboard',          'admin',        'Access the administration dashboard'),
  ('settings.manage',          'admin',        'Manage system configuration');

-- Customer
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions WHERE code IN (
  'profile.view','profile.update','account.view.own','wallet.view.own','wallet.manage',
  'wallet.convert','transfer.create','transfer.view.own','beneficiary.manage',
  'transaction.view.own','bill.manage','bill.pay','card.view','card.manage',
  'loan.apply','loan.view.own','loan.repay','notification.view');

-- Bank employee
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE code IN (
  'profile.view','profile.update','account.view.assigned','transaction.view.assigned',
  'transaction.review','request.process','user.view','loan.view.all','notification.view');

-- Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE code IN (
  'profile.view','profile.update','account.view.all','account.view.assigned','account.manage',
  'wallet.view.all','transfer.view.all','transaction.view.all','transaction.review',
  'request.process','user.view','loan.view.all','loan.review','loan.approve',
  'report.view','audit.view','admin.dashboard','notification.view');

-- Administrator (everything)
INSERT INTO role_permissions (role_id, permission_id) SELECT 1, id FROM permissions;

-- ---------------------------------------------------------------------
-- Currencies & exchange rates (rates are quoted against USD)
-- ---------------------------------------------------------------------
INSERT INTO currencies (code, name, symbol, decimals, is_active) VALUES
  ('INR', 'Indian Rupee',        '₹',   2, 1),
  ('USD', 'US Dollar',           '$',   2, 1),
  ('EUR', 'Euro',                '€',   2, 1),
  ('GBP', 'British Pound',       '£',   2, 1),
  ('JPY', 'Japanese Yen',        '¥',   0, 1),
  ('AED', 'UAE Dirham',          'د.إ', 2, 1);

INSERT INTO exchange_rates (base_currency, quote_currency, rate) VALUES
  ('USD','USD',  1.00000000),
  ('USD','INR', 83.20000000),
  ('USD','EUR',  0.92000000),
  ('USD','GBP',  0.79000000),
  ('USD','JPY', 157.50000000),
  ('USD','AED',  3.67250000);

-- ---------------------------------------------------------------------
-- Users  (password for every demo account: Password@123)
-- ---------------------------------------------------------------------
INSERT INTO users (id, full_name, email, phone, password_hash, role_id, status, address, managed_by) VALUES
  (1, 'Aarav Sharma',   'admin@nexbank.com',    '+91 98400 11001', '__PASSWORD_HASH__', 1, 'active', 'Corporate Office, Chennai', NULL),
  (2, 'Priya Nair',     'manager@nexbank.com',  '+91 98400 11002', '__PASSWORD_HASH__', 2, 'active', 'Anna Nagar Branch, Chennai', NULL),
  (3, 'Rahul Verma',    'employee@nexbank.com', '+91 98400 11003', '__PASSWORD_HASH__', 3, 'active', 'Anna Nagar Branch, Chennai', NULL),
  (4, 'Meera Krishnan', 'meera@nexbank.com',    '+91 98400 22001', '__PASSWORD_HASH__', 4, 'active', '14 Gandhi Street, Chennai',  3),
  (5, 'Arjun Rao',      'arjun@nexbank.com',    '+91 98400 22002', '__PASSWORD_HASH__', 4, 'active', '82 Lake View Road, Bengaluru', 3),
  (6, 'Divya Menon',    'divya@nexbank.com',    '+91 98400 22003', '__PASSWORD_HASH__', 4, 'suspended', '5 Marine Drive, Kochi', 3);

-- ---------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------
INSERT INTO accounts (id, user_id, account_number, account_type, currency_code, balance, status, ifsc_code, branch, opened_at) VALUES
  (1, 4, 'NEX1000000001', 'savings', 'INR', 452300.75, 'active', 'NEXB0001234', 'Anna Nagar, Chennai',  '2023-04-12'),
  (2, 4, 'NEX1000000002', 'current', 'INR', 128900.00, 'active', 'NEXB0001234', 'Anna Nagar, Chennai',  '2023-09-01'),
  (3, 5, 'NEX1000000003', 'savings', 'INR',  87450.25, 'active', 'NEXB0005678', 'Indiranagar, Bengaluru', '2024-01-20'),
  (4, 5, 'NEX1000000004', 'salary',  'INR',  36500.00, 'active', 'NEXB0005678', 'Indiranagar, Bengaluru', '2024-02-11'),
  (6, 6, 'NEX1000000006', 'savings', 'INR',  12000.00, 'frozen', 'NEXB0009012', 'Marine Drive, Kochi',  '2024-06-05');

-- ---------------------------------------------------------------------
-- Wallets
-- ---------------------------------------------------------------------
INSERT INTO wallets (id, user_id, status) VALUES (1, 4, 'active'), (2, 5, 'active');

INSERT INTO wallet_balances (wallet_id, currency_code, balance) VALUES
  (1, 'INR', 125000.0000),
  (1, 'USD',   2450.5000),
  (1, 'EUR',   1180.0000),
  (1, 'GBP',    640.0000),
  (1, 'JPY',  85000.0000),
  (1, 'AED',   3200.0000),
  (2, 'INR',  42000.0000),
  (2, 'USD',    810.2500);

INSERT INTO conversions (reference, wallet_id, user_id, from_currency, to_currency, from_amount, to_amount, rate, created_at) VALUES
  ('CNV20260801A1B2', 1, 4, 'USD', 'INR',  500.0000, 41600.0000, 83.20000000, '2026-08-01 10:12:00'),
  ('CNV20260805C3D4', 1, 4, 'INR', 'EUR', 20000.0000,  221.1500,  0.01105769, '2026-08-05 16:40:00'),
  ('CNV20260812E5F6', 1, 4, 'USD', 'GBP',  200.0000,  158.0000,  0.79000000, '2026-08-12 09:05:00');

-- ---------------------------------------------------------------------
-- Beneficiaries
-- ---------------------------------------------------------------------
INSERT INTO beneficiaries (user_id, nickname, account_number, holder_name, bank_name, ifsc_code, currency_code, is_internal) VALUES
  (4, 'Arjun - Savings', 'NEX1000000003', 'Arjun Rao',    'NexBank', 'NEXB0005678', 'INR', 1),
  (4, 'Arjun - Salary',  'NEX1000000004', 'Arjun Rao',    'NexBank', 'NEXB0005678', 'INR', 1),
  (5, 'Meera',           'NEX1000000001', 'Meera Krishnan','NexBank','NEXB0001234', 'INR', 1);

-- ---------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------
INSERT INTO transactions (reference, user_id, account_id, wallet_id, type, direction, description, counterparty_name, amount, currency_code, balance_after, status, created_at) VALUES
  ('TXN20260701AA01', 4, 1, NULL, 'deposit',       'credit', 'Salary credit - Northwind Technologies', 'Northwind Technologies', 185000.0000, 'INR', 512300.7500, 'completed', '2026-07-01 09:00:00'),
  ('TXN20260703AA02', 4, 1, NULL, 'transfer_out',  'debit',  'Transfer to Arjun Rao',                  'Arjun Rao',                12500.0000, 'INR', 499800.7500, 'completed', '2026-07-03 14:22:00'),
  ('TXN20260705AA03', 4, 1, NULL, 'bill_payment',  'debit',  'Electricity bill - TNEB',                'TNEB',                      3240.0000, 'INR', 496560.7500, 'completed', '2026-07-05 11:10:00'),
  ('TXN20260709AA04', 4, 2, NULL, 'card_payment',  'debit',  'Card purchase - Amazon India',           'Amazon India',              7899.0000, 'INR', 121001.0000, 'completed', '2026-07-09 19:45:00'),
  ('TXN20260712AA05', 4, 1, NULL, 'transfer_out',  'debit',  'Rent payment',                           'Lakeside Properties',      28000.0000, 'INR', 468560.7500, 'completed', '2026-07-12 08:30:00'),
  ('TXN20260718AA06', 4, 1, NULL, 'withdrawal',    'debit',  'ATM withdrawal - Anna Nagar',            'NexBank ATM',              10000.0000, 'INR', 458560.7500, 'completed', '2026-07-18 17:05:00'),
  ('TXN20260801AA07', 4, NULL, 1, 'conversion',    'debit',  'Converted USD to INR',                   NULL,                         500.0000, 'USD',   2950.5000, 'completed', '2026-08-01 10:12:00'),
  ('TXN20260801AA08', 4, NULL, 1, 'conversion',    'credit', 'Converted USD to INR',                   NULL,                       41600.0000, 'INR', 145000.0000, 'completed', '2026-08-01 10:12:05'),
  ('TXN20260803AA09', 4, 1, NULL, 'bill_payment',  'debit',  'Broadband bill - ACT Fibernet',          'ACT Fibernet',              1499.0000, 'INR', 457061.7500, 'completed', '2026-08-03 12:00:00'),
  ('TXN20260806AA10', 4, 1, NULL, 'loan_repayment','debit',  'Home loan EMI',                          'NexBank Loans',            18420.0000, 'INR', 438641.7500, 'completed', '2026-08-06 06:00:00'),
  ('TXN20260810AA11', 4, 1, NULL, 'transfer_out',  'debit',  'Transfer to Arjun Rao',                  'Arjun Rao',                 5000.0000, 'INR', 433641.7500, 'pending',   '2026-08-10 15:20:00'),
  ('TXN20260814AA12', 4, 1, NULL, 'transfer_out',  'debit',  'Transfer to unverified account',         'Unknown Beneficiary',      15000.0000, 'INR',         NULL, 'failed',    '2026-08-14 13:02:00'),
  ('TXN20260816AA13', 4, 2, NULL, 'card_payment',  'debit',  'Card purchase - Flipkart',               'Flipkart',                  2199.0000, 'INR', 118802.0000, 'cancelled', '2026-08-16 20:11:00'),
  ('TXN20260820AA14', 4, 1, NULL, 'deposit',       'credit', 'Interest credit',                        'NexBank',                   1859.0000, 'INR', 452300.7500, 'completed', '2026-08-20 00:05:00'),
  ('TXN20260702BB01', 5, 3, NULL, 'deposit',       'credit', 'Salary credit - Bluepeak Labs',          'Bluepeak Labs',            96000.0000, 'INR',  96000.0000, 'completed', '2026-07-02 09:00:00'),
  ('TXN20260703BB02', 5, 3, NULL, 'transfer_in',   'credit', 'Transfer from Meera Krishnan',           'Meera Krishnan',           12500.0000, 'INR', 108500.0000, 'completed', '2026-07-03 14:22:00'),
  ('TXN20260715BB03', 5, 3, NULL, 'bill_payment',  'debit',  'Mobile recharge - Airtel',               'Airtel',                     799.0000, 'INR', 107701.0000, 'completed', '2026-07-15 10:30:00'),
  ('TXN20260806BB04', 5, 3, NULL, 'withdrawal',    'debit',  'ATM withdrawal - Indiranagar',           'NexBank ATM',              20000.0000, 'INR',  87450.2500, 'completed', '2026-08-06 18:40:00');

INSERT INTO transfers (reference, idempotency_key, sender_user_id, sender_account_id, receiver_account_id, beneficiary_id, amount, currency_code, remarks, status, created_at) VALUES
  ('TRF20260703AA01', NULL, 4, 1, 3, 1, 12500.00, 'INR', 'Shared expenses',  'completed', '2026-07-03 14:22:00'),
  ('TRF20260810AA02', NULL, 4, 1, 3, 1,  5000.00, 'INR', 'Awaiting review',  'pending',   '2026-08-10 15:20:00'),
  ('TRF20260814AA03', NULL, 4, 1, NULL, NULL, 15000.00, 'INR', 'Beneficiary not verified', 'failed', '2026-08-14 13:02:00');

-- ---------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------
INSERT INTO cards (user_id, account_id, card_type, network, last_four, card_holder, expiry_month, expiry_year, status, daily_limit, credit_limit, online_enabled, intl_enabled, contactless) VALUES
  (4, 1, 'debit',  'visa',       '4821', 'MEERA KRISHNAN', 8, 2029, 'active',  75000.00,      NULL, 1, 0, 1),
  (4, 2, 'credit', 'mastercard', '9137', 'MEERA KRISHNAN', 3, 2028, 'active', 150000.00, 250000.00, 1, 1, 1),
  (4, 1, 'debit',  'rupay',      '5560', 'MEERA KRISHNAN', 1, 2027, 'blocked', 25000.00,      NULL, 0, 0, 0),
  (5, 3, 'debit',  'visa',       '3308', 'ARJUN RAO',     11, 2030, 'active',  50000.00,      NULL, 1, 0, 1);

-- ---------------------------------------------------------------------
-- Bills
-- ---------------------------------------------------------------------
INSERT INTO billers (id, name, category) VALUES
  (1, 'TNEB - Tamil Nadu Electricity Board', 'electricity'),
  (2, 'BESCOM',                              'electricity'),
  (3, 'Chennai Metro Water',                 'water'),
  (4, 'ACT Fibernet',                        'internet'),
  (5, 'Jio Fiber',                           'internet'),
  (6, 'Airtel Postpaid',                     'mobile'),
  (7, 'Tata Play',                           'dth'),
  (8, 'Indane Gas',                          'gas'),
  (9, 'NexBank Life Cover',                  'insurance');

INSERT INTO bills (user_id, biller_id, consumer_number, label, amount, currency_code, due_date, status) VALUES
  (4, 1, 'TNEB-88213490', 'Home electricity',  3420.00, 'INR', '2026-09-05', 'pending'),
  (4, 4, 'ACT-4471209',   'Home broadband',    1499.00, 'INR', '2026-09-02', 'pending'),
  (4, 6, '9840022001',    'Postpaid mobile',    799.00, 'INR', '2026-08-20', 'overdue'),
  (4, 7, 'TP-90112334',   'DTH subscription',   450.00, 'INR', '2026-09-12', 'pending'),
  (5, 2, 'BES-77120934',  'Flat electricity',  2180.00, 'INR', '2026-09-08', 'pending');

-- ---------------------------------------------------------------------
-- Loans
-- ---------------------------------------------------------------------
INSERT INTO loan_products (id, name, description, interest_rate, min_amount, max_amount, min_tenure_months, max_tenure_months) VALUES
  (1, 'NexBank Home Loan',     'Long tenure housing finance with competitive rates', 8.45,  500000.00, 20000000.00, 60, 300),
  (2, 'NexBank Personal Loan', 'Unsecured personal finance, disbursed same day',    11.75,   50000.00,  2000000.00, 12,  60),
  (3, 'NexBank Car Loan',      'New and pre-owned vehicle finance',                  9.25,  100000.00,  5000000.00, 12,  84),
  (4, 'NexBank Education Loan','Domestic and overseas education finance',            7.90,  100000.00,  7500000.00, 24, 180);

INSERT INTO loans (id, reference, user_id, product_id, account_id, principal, interest_rate, tenure_months, emi_amount, outstanding, currency_code, purpose, status, decided_by, decided_at) VALUES
  (1, 'LON20240115AA01', 4, 1, 1, 2200000.00, 8.45, 240, 19035.00, 1985400.00, 'INR', 'Apartment purchase', 'active',       2, '2024-01-18 11:00:00'),
  (2, 'LON20260805AA02', 4, 2, 1,  300000.00, 11.75,  36,  9925.00,  300000.00, 'INR', 'Home renovation',    'under_review', NULL, NULL),
  (3, 'LON20260812BB01', 5, 3, 3,  850000.00, 9.25,   60, 17740.00,  850000.00, 'INR', 'Car purchase',       'applied',      NULL, NULL);

INSERT INTO loan_payments (reference, loan_id, user_id, account_id, amount, status, paid_at) VALUES
  ('LPY20260606AA01', 1, 4, 1, 18420.00, 'completed', '2026-06-06 06:00:00'),
  ('LPY20260706AA02', 1, 4, 1, 18420.00, 'completed', '2026-07-06 06:00:00'),
  ('LPY20260806AA03', 1, 4, 1, 18420.00, 'completed', '2026-08-06 06:00:00');

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES
  (4, 'Transfer failed',      'Your transfer of INR 15,000.00 could not be completed because the beneficiary is not verified.', 'transfer',    0, '2026-08-14 13:02:00'),
  (4, 'Bill due soon',        'Your ACT Fibernet bill of INR 1,499.00 is due on 02 Sep 2026.',                                   'payment',     0, '2026-08-22 08:00:00'),
  (4, 'Bill overdue',         'Your Airtel Postpaid bill of INR 799.00 was due on 20 Aug 2026.',                                 'payment',     0, '2026-08-21 08:00:00'),
  (4, 'New login detected',   'A new sign-in to your NexBank account was detected from Chennai, India.',                          'security',    1, '2026-08-20 21:14:00'),
  (4, 'Salary credited',      'INR 185,000.00 has been credited to account ending 0001.',                                        'transaction', 1, '2026-07-01 09:00:00'),
  (4, 'Loan under review',    'Your personal loan application LON20260805AA02 is under review.',                                  'system',      0, '2026-08-05 17:30:00'),
  (5, 'Transfer received',    'INR 12,500.00 received from Meera Krishnan.',                                                      'transfer',    1, '2026-07-03 14:22:00'),
  (5, 'Loan application received', 'We have received your car loan application LON20260812BB01.',                                 'system',      0, '2026-08-12 10:00:00');

-- ---------------------------------------------------------------------
-- Audit logs
-- ---------------------------------------------------------------------
INSERT INTO audit_logs (user_id, actor_email, action, entity_type, entity_id, description, status, ip_address, created_at) VALUES
  (4, 'meera@nexbank.com',    'auth.login',        'user',        '4', 'Customer signed in',                              'success', '203.0.113.24', '2026-08-20 21:14:00'),
  (4, 'meera@nexbank.com',    'transfer.create',   'transfer',    '1', 'Transferred INR 12,500.00 to NEX1000000003',      'success', '203.0.113.24', '2026-07-03 14:22:00'),
  (4, 'meera@nexbank.com',    'transfer.create',   'transfer',    '3', 'Transfer of INR 15,000.00 rejected',              'failure', '203.0.113.24', '2026-08-14 13:02:00'),
  (4, 'meera@nexbank.com',    'wallet.convert',    'conversion',  '1', 'Converted USD 500.00 to INR 41,600.00',           'success', '203.0.113.24', '2026-08-01 10:12:00'),
  (2, 'manager@nexbank.com',  'loan.approve',      'loan',        '1', 'Approved home loan LON20240115AA01',              'success', '198.51.100.7', '2024-01-18 11:00:00'),
  (1, 'admin@nexbank.com',    'role.permission.update', 'role',   '3', 'Updated permissions for role employee',           'success', '198.51.100.2', '2026-08-18 10:45:00'),
  (1, 'admin@nexbank.com',    'user.status.update','user',        '6', 'Suspended user divya@nexbank.com',                'success', '198.51.100.2', '2026-08-19 15:20:00'),
  (NULL, 'unknown@example.com','auth.login.failed','user',        NULL,'Failed sign-in attempt for unknown@example.com',   'failure', '192.0.2.55',   '2026-08-23 02:11:00');
