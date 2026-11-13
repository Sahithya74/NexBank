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
  'transaction.review','request.process','user.view','loan.view.all','notification.view',
  'account.view.own','wallet.view.own','wallet.convert');

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

-- ---------------------------------------------------------------------
-- Additional customers assigned to the bank employee (Rahul Verma, id 3)
-- Gives the employee workspace a realistic review queue.
-- ---------------------------------------------------------------------
INSERT INTO users (id, full_name, email, phone, password_hash, role_id, status, address, managed_by) VALUES
  (7,  'Karthik Subramanian', 'karthik@nexbank.com', '+91 98400 22004', '__PASSWORD_HASH__', 4, 'active',  '27 TTK Road, Alwarpet, Chennai',     3),
  (8,  'Ananya Iyer',         'ananya@nexbank.com',  '+91 98400 22005', '__PASSWORD_HASH__', 4, 'active',  '9 Race Course Road, Coimbatore',      3),
  (9,  'Vikram Shetty',       'vikram@nexbank.com',  '+91 98400 22006', '__PASSWORD_HASH__', 4, 'pending', '41 Lalbagh Road, Mangaluru',          3),
  (10, 'Fatima Sheikh',       'fatima@nexbank.com',  '+91 98400 22007', '__PASSWORD_HASH__', 4, 'active',  '12 Banjara Hills, Hyderabad',         3);

INSERT INTO accounts (id, user_id, account_number, account_type, currency_code, balance, status, ifsc_code, branch, opened_at) VALUES
  (7,  7,  'NEX1000000007', 'savings',       'INR', 268450.50, 'active', 'NEXB0001234', 'Anna Nagar, Chennai',   '2022-11-03'),
  (8,  7,  'NEX1000000008', 'current',       'INR',  94120.00, 'active', 'NEXB0001234', 'Anna Nagar, Chennai',   '2024-05-14'),
  (9,  8,  'NEX1000000009', 'savings',       'INR', 156780.00, 'active', 'NEXB0003456', 'RS Puram, Coimbatore',  '2023-07-21'),
  (10, 8,  'NEX1000000010', 'fixed_deposit', 'INR', 500000.00, 'active', 'NEXB0003456', 'RS Puram, Coimbatore',  '2026-09-15'),
  (11, 9,  'NEX1000000011', 'savings',       'INR',  25000.00, 'frozen', 'NEXB0007890', 'Hampankatta, Mangaluru', '2026-10-27'),
  (12, 10, 'NEX1000000012', 'salary',        'INR',  60110.75, 'active', 'NEXB0004567', 'Banjara Hills, Hyderabad', '2025-02-10');

INSERT INTO wallets (id, user_id, status) VALUES (4, 7, 'active'), (5, 8, 'active');

INSERT INTO wallet_balances (wallet_id, currency_code, balance) VALUES
  (4, 'INR', 18000.0000),
  (4, 'USD',   640.0000),
  (4, 'AED',  1250.0000),
  (5, 'INR',  9500.0000),
  (5, 'EUR',   420.0000);

INSERT INTO beneficiaries (user_id, nickname, account_number, holder_name, bank_name, ifsc_code, currency_code, is_internal) VALUES
  (8,  'Fatima - Salary', 'NEX1000000012', 'Fatima Sheikh',       'NexBank', 'NEXB0004567', 'INR', 1),
  (10, 'Karthik',         'NEX1000000007', 'Karthik Subramanian', 'NexBank', 'NEXB0001234', 'INR', 1);

INSERT INTO transactions (reference, user_id, account_id, wallet_id, type, direction, description, counterparty_name, amount, currency_code, balance_after, status, created_at) VALUES
  ('TXN20261001CC01', 7, 7, NULL, 'deposit',        'credit', 'Salary credit - Zenith Infotech',        'Zenith Infotech',      142000.0000, 'INR', 302000.0000, 'completed', '2026-10-01 09:00:00'),
  ('TXN20261004CC02', 7, 7, NULL, 'bill_payment',   'debit',  'Electricity bill - TNEB',                'TNEB',                   2860.0000, 'INR', 299140.0000, 'completed', '2026-10-04 11:25:00'),
  ('TXN20261008CC03', 7, 7, NULL, 'transfer_out',   'debit',  'Rent payment',                           'Alwarpet Residency',    25000.0000, 'INR', 274140.0000, 'completed', '2026-10-08 08:15:00'),
  ('TXN20261015CC04', 7, 7, NULL, 'card_payment',   'debit',  'Card purchase - Croma',                  'Croma',                  5689.5000, 'INR', 268450.5000, 'completed', '2026-10-15 18:42:00'),
  ('TXN20261022CC05', 7, 7, NULL, 'transfer_out',   'debit',  'High-value transfer to new payee',       'Sterling Motors',       75000.0000, 'INR',        NULL, 'pending',   '2026-10-22 16:05:00'),
  ('TXN20261010CC06', 7, 8, NULL, 'deposit',        'credit', 'Client payment - Orbit Retail',          'Orbit Retail',          60000.0000, 'INR',  94120.0000, 'completed', '2026-10-10 12:30:00'),
  ('TXN20261020CC07', 7, 8, NULL, 'withdrawal',     'debit',  'Cash withdrawal - limit exceeded',       'NexBank Branch',       100000.0000, 'INR',        NULL, 'failed',    '2026-10-20 14:10:00'),
  ('TXN20261002DD01', 8, 9, NULL, 'deposit',        'credit', 'Salary credit - Kovai Textiles',         'Kovai Textiles',        78500.0000, 'INR', 176500.0000, 'completed', '2026-10-02 09:00:00'),
  ('TXN20261006DD02', 8, 9, NULL, 'bill_payment',   'debit',  'Broadband bill - Jio Fiber',             'Jio Fiber',               999.0000, 'INR', 175501.0000, 'completed', '2026-10-06 10:05:00'),
  ('TXN20261012DD03', 8, 9, NULL, 'withdrawal',     'debit',  'ATM withdrawal - RS Puram',              'NexBank ATM',           15000.0000, 'INR', 160501.0000, 'completed', '2026-10-12 19:20:00'),
  ('TXN20261018DD04', 8, 9, NULL, 'card_payment',   'debit',  'Card purchase - Big Bazaar',             'Big Bazaar',             3721.0000, 'INR', 156780.0000, 'completed', '2026-10-18 17:48:00'),
  ('TXN20261025DD05', 8, 9, NULL, 'transfer_out',   'debit',  'Transfer to Fatima Sheikh',              'Fatima Sheikh',         40000.0000, 'INR',        NULL, 'pending',   '2026-10-25 11:30:00'),
  ('TXN20260915DD06', 8, 10, NULL, 'deposit',       'credit', 'Fixed deposit booked - 24 months',       'NexBank',              500000.0000, 'INR', 500000.0000, 'completed', '2026-09-15 10:00:00'),
  ('TXN20261027EE01', 9, 11, NULL, 'deposit',       'credit', 'Initial deposit - account opening',      'Vikram Shetty',         25000.0000, 'INR',  25000.0000, 'completed', '2026-10-27 15:40:00'),
  ('TXN20261001FF01', 10, 12, NULL, 'deposit',      'credit', 'Salary credit - Deccan Health Systems',  'Deccan Health Systems', 64000.0000, 'INR',  76000.7500, 'completed', '2026-10-01 09:00:00'),
  ('TXN20261007FF02', 10, 12, NULL, 'loan_repayment','debit', 'Car loan EMI',                           'NexBank Loans',         10890.0000, 'INR',  65110.7500, 'completed', '2026-10-07 06:00:00'),
  ('TXN20261014FF03', 10, 12, NULL, 'bill_payment', 'debit',  'Insurance premium - NexBank Life Cover', 'NexBank Life Cover',     5000.0000, 'INR',  60110.7500, 'completed', '2026-10-14 10:20:00'),
  ('TXN20261021FF04', 10, 12, NULL, 'transfer_out', 'debit',  'Transfer to external account',           'Unverified Payee',      18500.0000, 'INR',        NULL, 'failed',    '2026-10-21 21:55:00');

INSERT INTO transfers (reference, idempotency_key, sender_user_id, sender_account_id, receiver_account_id, beneficiary_id, amount, currency_code, remarks, status, failure_reason, created_at) VALUES
  ('TRF20261022CC01', NULL, 7,  7,  NULL, NULL, 75000.00, 'INR', 'Vehicle booking advance',   'pending', NULL,                         '2026-10-22 16:05:00'),
  ('TRF20261025DD01', NULL, 8,  9,  12,   NULL, 40000.00, 'INR', 'Family support',            'pending', NULL,                         '2026-10-25 11:30:00'),
  ('TRF20261021FF01', NULL, 10, 12, NULL, NULL, 18500.00, 'INR', 'Online purchase',           'failed',  'Beneficiary not verified',   '2026-10-21 21:55:00');

INSERT INTO cards (user_id, account_id, card_type, network, last_four, card_holder, expiry_month, expiry_year, status, daily_limit, credit_limit, online_enabled, intl_enabled, contactless) VALUES
  (7,  7,  'debit',  'visa',       '7714', 'KARTHIK SUBRAMANIAN', 6, 2030, 'active',   60000.00,      NULL, 1, 1, 1),
  (8,  9,  'credit', 'mastercard', '2045', 'ANANYA IYER',         9, 2029, 'active',  100000.00, 200000.00, 1, 0, 1),
  (10, 12, 'debit',  'rupay',      '6631', 'FATIMA SHEIKH',       2, 2028, 'blocked',  40000.00,      NULL, 0, 0, 0);

INSERT INTO bills (user_id, biller_id, consumer_number, label, amount, currency_code, due_date, status) VALUES
  (7,  1, 'TNEB-66120458', 'Home electricity', 2940.00, 'INR', '2026-11-10', 'pending'),
  (8,  5, 'JIO-55019231',  'Home broadband',    999.00, 'INR', '2026-10-30', 'overdue'),
  (10, 6, '9840022007',    'Postpaid mobile',   649.00, 'INR', '2026-11-12', 'pending');

INSERT INTO loans (id, reference, user_id, product_id, account_id, principal, interest_rate, tenure_months, emi_amount, outstanding, currency_code, purpose, status, decided_by, decided_at) VALUES
  (4, 'LON20261020CC01', 7,  2, 7,   500000.00, 11.75,  48, 13106.00,  500000.00, 'INR', 'Wedding expenses',      'under_review', NULL, NULL),
  (5, 'LON20261024DD01', 8,  4, 9,  1200000.00,  7.90, 120, 14496.00, 1200000.00, 'INR', 'MBA - overseas campus', 'applied',      NULL, NULL),
  (6, 'LON20250310FF01', 10, 3, 12,  600000.00,  9.25,  72, 10890.00,  452380.00, 'INR', 'New hatchback',         'active',       2, '2025-03-12 12:00:00');

INSERT INTO loan_payments (reference, loan_id, user_id, account_id, amount, status, paid_at) VALUES
  ('LPY20260807FF01', 6, 10, 12, 10890.00, 'completed', '2026-08-07 06:00:00'),
  ('LPY20260907FF02', 6, 10, 12, 10890.00, 'completed', '2026-09-07 06:00:00'),
  ('LPY20261007FF03', 6, 10, 12, 10890.00, 'completed', '2026-10-07 06:00:00');

INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES
  (3,  'New customer assigned',       'Vikram Shetty has been assigned to you. KYC verification is pending and account NEX1000000011 is frozen until it is complete.', 'system',   0, '2026-10-27 15:45:00'),
  (3,  'High-value transfer pending', 'Karthik Subramanian initiated a transfer of INR 75,000.00 to a new payee. Review required.',                                  'transfer', 0, '2026-10-22 16:06:00'),
  (3,  'Transfer awaiting review',    'Ananya Iyer initiated a transfer of INR 40,000.00 to Fatima Sheikh.',                                                         'transfer', 0, '2026-10-25 11:31:00'),
  (3,  'Loan documents to verify',    'Education loan application LON20261024DD01 from Ananya Iyer needs document verification.',                                    'system',   0, '2026-10-24 10:15:00'),
  (3,  'Loan forwarded for review',   'Personal loan LON20261020CC01 for Karthik Subramanian has moved to manager review.',                                          'system',   1, '2026-10-21 09:40:00'),
  (3,  'Card blocked by customer',    'Fatima Sheikh reported card ending 6631 as lost and blocked it.',                                                              'security', 1, '2026-10-19 08:12:00'),
  (3,  'Failed transfer reported',    'A transfer of INR 18,500.00 from Fatima Sheikh failed: beneficiary not verified.',                                            'transfer', 1, '2026-10-21 22:00:00'),
  (7,  'Transfer under review',       'Your transfer of INR 75,000.00 is being reviewed by your relationship manager.',                                              'transfer', 0, '2026-10-22 16:06:00'),
  (8,  'Loan application received',   'We have received your education loan application LON20261024DD01.',                                                          'system',   0, '2026-10-24 10:00:00'),
  (9,  'Complete your KYC',           'Upload your identity and address proof to activate account NEX1000000011.',                                                  'security', 0, '2026-10-27 15:45:00'),
  (10, 'Transfer failed',             'Your transfer of INR 18,500.00 could not be completed because the beneficiary is not verified.',                              'transfer', 0, '2026-10-21 22:00:00');

INSERT INTO audit_logs (user_id, actor_email, action, entity_type, entity_id, description, status, ip_address, created_at) VALUES
  (1,  'admin@nexbank.com',    'user.assign',      'user',     '9',  'Assigned vikram@nexbank.com to employee@nexbank.com',  'success', '198.51.100.2', '2026-10-27 15:44:00'),
  (3,  'employee@nexbank.com', 'account.open',     'account',  '11', 'Opened savings account NEX1000000011 (KYC pending)',   'success', '198.51.100.9', '2026-10-27 15:40:00'),
  (3,  'employee@nexbank.com', 'loan.forward',     'loan',     '4',  'Forwarded personal loan LON20261020CC01 to manager',   'success', '198.51.100.9', '2026-10-21 09:40:00'),
  (10, 'fatima@nexbank.com',   'card.block',       'card',     NULL, 'Blocked card ending 6631 (reported lost)',             'success', '203.0.113.61', '2026-10-19 08:12:00'),
  (10, 'fatima@nexbank.com',   'transfer.create',  'transfer', NULL, 'Transfer of INR 18,500.00 rejected',                   'failure', '203.0.113.61', '2026-10-21 21:55:00'),
  (7,  'karthik@nexbank.com',  'transfer.create',  'transfer', NULL, 'Transfer of INR 75,000.00 held for review',            'success', '203.0.113.40', '2026-10-22 16:05:00');

-- ---------------------------------------------------------------------
-- Bank employee's own banking (Rahul Verma, id 3): salary and savings
-- accounts, a multi-currency wallet and conversion history.
-- ---------------------------------------------------------------------
INSERT INTO accounts (id, user_id, account_number, account_type, currency_code, balance, status, ifsc_code, branch, opened_at) VALUES
  (13, 3, 'NEX1000000013', 'salary',  'INR', 102979.50, 'active', 'NEXB0001234', 'Anna Nagar, Chennai', '2021-06-14'),
  (14, 3, 'NEX1000000014', 'savings', 'INR', 216725.00, 'active', 'NEXB0001234', 'Anna Nagar, Chennai', '2021-06-14');

INSERT INTO wallets (id, user_id, status) VALUES (6, 3, 'active');

INSERT INTO wallet_balances (wallet_id, currency_code, balance) VALUES
  (6, 'INR', 20841.7391),
  (6, 'USD',   250.0000),
  (6, 'EUR',   149.9230),
  (6, 'GBP',    79.0000),
  (6, 'AED',   550.8750);

INSERT INTO conversions (reference, wallet_id, user_id, from_currency, to_currency, from_amount, to_amount, rate, created_at) VALUES
  ('CNV20261004RV01', 6, 3, 'INR', 'USD', 41600.0000,  500.0000,  0.01201923, '2026-10-04 11:20:00'),
  ('CNV20261012RV02', 6, 3, 'INR', 'EUR', 18080.0000,  199.9230,  0.01105769, '2026-10-12 18:05:00'),
  ('CNV20261020RV03', 6, 3, 'USD', 'AED',   150.0000,  550.8750,  3.67250000, '2026-10-20 09:40:00'),
  ('CNV20261026RV04', 6, 3, 'USD', 'GBP',   100.0000,   79.0000,  0.79000000, '2026-10-26 20:15:00'),
  ('CNV20261102RV05', 6, 3, 'EUR', 'INR',    50.0000, 4521.7391, 90.43478261, '2026-11-02 13:30:00');

INSERT INTO transactions (reference, user_id, account_id, wallet_id, type, direction, description, counterparty_name, amount, currency_code, balance_after, status, created_at) VALUES
  ('TXN20260901RV01', 3, 13, NULL, 'deposit',       'credit', 'Salary credit - NexBank Payroll',       'NexBank Payroll',     68500.0000, 'INR',  86750.0000, 'completed', '2026-09-01 09:00:00'),
  ('TXN20260905RV02', 3, 13, NULL, 'bill_payment',  'debit',  'Electricity bill - TNEB',               'TNEB',                 1980.0000, 'INR',  84770.0000, 'completed', '2026-09-05 10:30:00'),
  ('TXN20260910RV03', 3, 13, NULL, 'self_transfer', 'debit',  'Transfer to savings NEX1000000014',     'Rahul Verma',         20000.0000, 'INR',  64770.0000, 'completed', '2026-09-10 08:00:00'),
  ('TXN20260910RV04', 3, 14, NULL, 'self_transfer', 'credit', 'Transfer from salary NEX1000000013',    'Rahul Verma',         20000.0000, 'INR', 230000.0000, 'completed', '2026-09-10 08:00:00'),
  ('TXN20260918RV05', 3, 13, NULL, 'card_payment',  'debit',  'Card purchase - Reliance Digital',      'Reliance Digital',     4349.0000, 'INR',  60421.0000, 'completed', '2026-09-18 19:12:00'),
  ('TXN20260930RV06', 3, 14, NULL, 'deposit',       'credit', 'Interest credit',                       'NexBank',              1725.0000, 'INR', 231725.0000, 'completed', '2026-09-30 00:05:00'),
  ('TXN20261001RV07', 3, 13, NULL, 'deposit',       'credit', 'Salary credit - NexBank Payroll',       'NexBank Payroll',     68500.0000, 'INR', 128921.0000, 'completed', '2026-10-01 09:00:00'),
  ('TXN20261003RV08', 3, 13, NULL, 'self_transfer', 'debit',  'Wallet top-up',                         'Rahul Verma',         75000.0000, 'INR',  53921.0000, 'completed', '2026-10-03 10:15:00'),
  ('TXN20261009RV09', 3, 13, NULL, 'withdrawal',    'debit',  'ATM withdrawal - Anna Nagar',           'NexBank ATM',          6000.0000, 'INR',  47921.0000, 'completed', '2026-10-09 18:30:00'),
  ('TXN20261014RV10', 3, 13, NULL, 'card_payment',  'debit',  'Card purchase declined - international', 'Booking.com',          8200.0000, 'INR',        NULL, 'failed',    '2026-10-14 23:10:00'),
  ('TXN20261016RV11', 3, 13, NULL, 'bill_payment',  'debit',  'Mobile bill - Airtel Postpaid',         'Airtel',                599.0000, 'INR',  47322.0000, 'completed', '2026-10-16 09:45:00'),
  ('TXN20261024RV12', 3, 13, NULL, 'transfer_out',  'debit',  'Transfer to Sunita Verma',              'Sunita Verma',        12000.0000, 'INR',  35322.0000, 'completed', '2026-10-24 17:20:00'),
  ('TXN20261028RV13', 3, 14, NULL, 'transfer_out',  'debit',  'Transfer to Sunita Verma - college fees', 'Sunita Verma',       15000.0000, 'INR', 216725.0000, 'completed', '2026-10-28 12:00:00'),
  ('TXN20261101RV14', 3, 13, NULL, 'deposit',       'credit', 'Salary credit - NexBank Payroll',       'NexBank Payroll',     68500.0000, 'INR', 103822.0000, 'completed', '2026-11-01 09:00:00'),
  ('TXN20261103RV15', 3, 13, NULL, 'card_payment',  'debit',  'Card purchase - Swiggy',                'Swiggy',                842.5000, 'INR', 102979.5000, 'completed', '2026-11-03 20:35:00'),
  ('TXN20260920RW01', 3, NULL, 6, 'deposit',        'credit', 'Wallet opening credit',                 'NexBank',              1000.0000, 'INR',   1000.0000, 'completed', '2026-09-20 10:00:00'),
  ('TXN20261003RW02', 3, NULL, 6, 'self_transfer',  'credit', 'Top-up from salary NEX1000000013',      'Rahul Verma',         75000.0000, 'INR',  76000.0000, 'completed', '2026-10-03 10:15:00'),
  ('TXN20261004RW03', 3, NULL, 6, 'conversion',     'debit',  'Converted INR to USD',                  NULL,                  41600.0000, 'INR',  34400.0000, 'completed', '2026-10-04 11:20:00'),
  ('TXN20261004RW04', 3, NULL, 6, 'conversion',     'credit', 'Converted INR to USD',                  NULL,                    500.0000, 'USD',    500.0000, 'completed', '2026-10-04 11:20:05'),
  ('TXN20261012RW05', 3, NULL, 6, 'conversion',     'debit',  'Converted INR to EUR',                  NULL,                  18080.0000, 'INR',  16320.0000, 'completed', '2026-10-12 18:05:00'),
  ('TXN20261012RW06', 3, NULL, 6, 'conversion',     'credit', 'Converted INR to EUR',                  NULL,                    199.9230, 'EUR',    199.9230, 'completed', '2026-10-12 18:05:05'),
  ('TXN20261020RW07', 3, NULL, 6, 'conversion',     'debit',  'Converted USD to AED',                  NULL,                    150.0000, 'USD',    350.0000, 'completed', '2026-10-20 09:40:00'),
  ('TXN20261020RW08', 3, NULL, 6, 'conversion',     'credit', 'Converted USD to AED',                  NULL,                    550.8750, 'AED',    550.8750, 'completed', '2026-10-20 09:40:05'),
  ('TXN20261026RW09', 3, NULL, 6, 'conversion',     'debit',  'Converted USD to GBP',                  NULL,                    100.0000, 'USD',    250.0000, 'completed', '2026-10-26 20:15:00'),
  ('TXN20261026RW10', 3, NULL, 6, 'conversion',     'credit', 'Converted USD to GBP',                  NULL,                     79.0000, 'GBP',     79.0000, 'completed', '2026-10-26 20:15:05'),
  ('TXN20261102RW11', 3, NULL, 6, 'conversion',     'debit',  'Converted EUR to INR',                  NULL,                     50.0000, 'EUR',    149.9230, 'completed', '2026-11-02 13:30:00'),
  ('TXN20261102RW12', 3, NULL, 6, 'conversion',     'credit', 'Converted EUR to INR',                  NULL,                   4521.7391, 'INR',  20841.7391, 'completed', '2026-11-02 13:30:05');

INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES
  (3, 'Salary credited',      'INR 68,500.00 has been credited to account ending 0013.',                    'transaction', 0, '2026-11-01 09:00:00'),
  (3, 'Currency converted',   'EUR 50.00 converted to INR 4,521.74 in your wallet.',                         'transaction', 0, '2026-11-02 13:30:05'),
  (3, 'Card payment declined', 'An international card payment of INR 8,200.00 to Booking.com was declined.', 'security',    1, '2026-10-14 23:10:00');

INSERT INTO audit_logs (user_id, actor_email, action, entity_type, entity_id, description, status, ip_address, created_at) VALUES
  (3, 'employee@nexbank.com', 'wallet.convert', 'conversion', NULL, 'Converted INR 41,600.00 to USD 500.00', 'success', '198.51.100.9', '2026-10-04 11:20:00'),
  (3, 'employee@nexbank.com', 'wallet.convert', 'conversion', NULL, 'Converted INR 18,080.00 to EUR 199.92', 'success', '198.51.100.9', '2026-10-12 18:05:00'),
  (3, 'employee@nexbank.com', 'wallet.convert', 'conversion', NULL, 'Converted USD 150.00 to AED 550.88',   'success', '198.51.100.9', '2026-10-20 09:40:00'),
  (3, 'employee@nexbank.com', 'wallet.convert', 'conversion', NULL, 'Converted USD 100.00 to GBP 79.00',    'success', '198.51.100.9', '2026-10-26 20:15:00'),
  (3, 'employee@nexbank.com', 'wallet.convert', 'conversion', NULL, 'Converted EUR 50.00 to INR 4,521.74',  'success', '198.51.100.9', '2026-11-02 13:30:00');

-- ---------------------------------------------------------------------
-- Administrator wallet: opened with the INR opening credit and one
-- small INR -> AED conversion (the admin activity below builds on it).
-- ---------------------------------------------------------------------
INSERT INTO wallets (user_id, status) VALUES (1, 'active');
SET @admin_wallet := LAST_INSERT_ID();

INSERT INTO wallet_balances (wallet_id, currency_code, balance) VALUES
  (@admin_wallet, 'INR', 800.0000),
  (@admin_wallet, 'AED',   8.8300);

INSERT INTO conversions (reference, wallet_id, user_id, from_currency, to_currency, from_amount, to_amount, rate, created_at) VALUES
  ('CNV20261003AD00', @admin_wallet, 1, 'INR', 'AED', 200.0000, 8.8300, 0.04414063, '2026-10-03 12:00:00');

INSERT INTO transactions (reference, user_id, account_id, wallet_id, type, direction, description, counterparty_name, amount, currency_code, balance_after, status, created_at) VALUES
  ('TXN20261003AW00', 1, NULL, @admin_wallet, 'deposit',    'credit', 'Wallet opening credit', 'NexBank', 1000.0000, 'INR', 1000.0000, 'completed', '2026-10-03 11:55:00'),
  ('TXN20261003AX01', 1, NULL, @admin_wallet, 'conversion', 'debit',  'Converted INR to AED',  NULL,       200.0000, 'INR',  800.0000, 'completed', '2026-10-03 12:00:00'),
  ('TXN20261003AX02', 1, NULL, @admin_wallet, 'conversion', 'credit', 'Converted INR to AED',  NULL,         8.8300, 'AED',    8.8300, 'completed', '2026-10-03 12:00:05');

-- ---------------------------------------------------------------------
-- Administrator's own banking (user id 1): INR salary and savings
-- accounts, a USD current account, wallet top-up and conversions.
-- ---------------------------------------------------------------------
INSERT INTO accounts (id, user_id, account_number, account_type, currency_code, balance, status, ifsc_code, branch, opened_at) VALUES
  (15, 1, 'NEX1000000015', 'salary',  'INR', 224881.00, 'active', 'NEXB0000001', 'Corporate Office, Chennai', '2019-04-01'),
  (16, 1, 'NEX1000000016', 'savings', 'INR', 857880.00, 'active', 'NEXB0000001', 'Corporate Office, Chennai', '2019-04-01'),
  (17, 1, 'NEX1000000017', 'current', 'USD',   7050.00, 'active', 'NEXB0000001', 'Corporate Office, Chennai', '2023-01-16');

SET @admin_wallet := (SELECT id FROM wallets WHERE user_id = 1);

INSERT INTO wallet_balances (wallet_id, currency_code, balance) VALUES
  (@admin_wallet, 'INR', 39683.4783),
  (@admin_wallet, 'USD',   250.0000),
  (@admin_wallet, 'EUR',   299.8461),
  (@admin_wallet, 'GBP',   237.0000),
  (@admin_wallet, 'JPY', 31500.0000),
  (@admin_wallet, 'AED',   918.1250)
ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance);

INSERT INTO conversions (reference, wallet_id, user_id, from_currency, to_currency, from_amount, to_amount, rate, created_at) VALUES
  ('CNV20261005AD01', @admin_wallet, 1, 'INR', 'USD', 83200.0000,  1000.0000,  0.01201923, '2026-10-05 10:10:00'),
  ('CNV20261009AD02', @admin_wallet, 1, 'USD', 'GBP',   300.0000,   237.0000,  0.79000000, '2026-10-09 15:25:00'),
  ('CNV20261014AD03', @admin_wallet, 1, 'INR', 'EUR', 36160.0000,   399.8461,  0.01105769, '2026-10-14 12:40:00'),
  ('CNV20261022AD04', @admin_wallet, 1, 'USD', 'JPY',   200.0000, 31500.0000, 157.50000000, '2026-10-22 08:55:00'),
  ('CNV20261027AD05', @admin_wallet, 1, 'USD', 'AED',   250.0000,   918.1250,  3.67250000, '2026-10-27 17:30:00'),
  ('CNV20261103AD06', @admin_wallet, 1, 'EUR', 'INR',   100.0000,  9043.4783, 90.43478261, '2026-11-03 11:05:00');

INSERT INTO transactions (reference, user_id, account_id, wallet_id, type, direction, description, counterparty_name, amount, currency_code, balance_after, status, created_at) VALUES
  ('TXN20260901AD01', 1, 15, NULL, 'deposit',       'credit', 'Salary credit - NexBank Payroll',          'NexBank Payroll',        185000.0000, 'INR', 230600.0000, 'completed', '2026-09-01 09:00:00'),
  ('TXN20260904AD02', 1, 15, NULL, 'transfer_out',  'debit',  'Rent payment',                             'Boat Club Residences',    42000.0000, 'INR', 188600.0000, 'completed', '2026-09-04 08:10:00'),
  ('TXN20260908AD03', 1, 15, NULL, 'bill_payment',  'debit',  'Electricity bill - TNEB',                  'TNEB',                     3870.0000, 'INR', 184730.0000, 'completed', '2026-09-08 10:00:00'),
  ('TXN20260912AD04', 1, 15, NULL, 'self_transfer', 'debit',  'Transfer to savings NEX1000000016',        'Own account',             60000.0000, 'INR', 124730.0000, 'completed', '2026-09-12 07:30:00'),
  ('TXN20260912AD05', 1, 16, NULL, 'self_transfer', 'credit', 'Transfer from salary NEX1000000015',       'Own account',             60000.0000, 'INR', 880000.0000, 'completed', '2026-09-12 07:30:00'),
  ('TXN20260915AD06', 1, 17, NULL, 'deposit',       'credit', 'Consulting fee - Westbridge Partners',     'Westbridge Partners',      4500.0000, 'USD',   7700.0000, 'completed', '2026-09-15 14:00:00'),
  ('TXN20260921AD07', 1, 15, NULL, 'card_payment',  'debit',  'Card purchase - Apple Store',              'Apple Store',             89900.0000, 'INR',  34830.0000, 'completed', '2026-09-21 16:45:00'),
  ('TXN20260930AD08', 1, 16, NULL, 'deposit',       'credit', 'Interest credit',                          'NexBank',                  6420.0000, 'INR', 886420.0000, 'completed', '2026-09-30 00:05:00'),
  ('TXN20261001AD09', 1, 15, NULL, 'deposit',       'credit', 'Salary credit - NexBank Payroll',          'NexBank Payroll',        185000.0000, 'INR', 219830.0000, 'completed', '2026-10-01 09:00:00'),
  ('TXN20261003AD10', 1, 15, NULL, 'self_transfer', 'debit',  'Wallet top-up',                            'Own wallet',             150000.0000, 'INR',  69830.0000, 'completed', '2026-10-03 18:00:00'),
  ('TXN20261011AD11', 1, 15, NULL, 'bill_payment',  'debit',  'Broadband bill - ACT Fibernet',            'ACT Fibernet',             1499.0000, 'INR',  68331.0000, 'completed', '2026-10-11 09:20:00'),
  ('TXN20261015AD12', 1, 16, NULL, 'transfer_out',  'debit',  'Mutual fund SIP - Nippon India',           'Nippon India MF',         25000.0000, 'INR', 861420.0000, 'completed', '2026-10-15 06:00:00'),
  ('TXN20261017AD13', 1, 15, NULL, 'withdrawal',    'debit',  'ATM withdrawal - Nungambakkam',            'NexBank ATM',             10000.0000, 'INR',  58331.0000, 'completed', '2026-10-17 19:05:00'),
  ('TXN20261019AD14', 1, 17, NULL, 'transfer_out',  'debit',  'Conference registration - FinTech Summit', 'FinTech Summit',             650.0000, 'USD',   7050.0000, 'completed', '2026-10-19 13:15:00'),
  ('TXN20261023AD15', 1, 15, NULL, 'transfer_out',  'debit',  'Property booking advance',                 'Prestige Estates',       250000.0000, 'INR',        NULL, 'pending',   '2026-10-23 11:40:00'),
  ('TXN20261029AD16', 1, 17, NULL, 'transfer_out',  'debit',  'Wire transfer - returned by bank',         'Harbor Supplies LLC',      2000.0000, 'USD',        NULL, 'failed',    '2026-10-29 22:10:00'),
  ('TXN20261030AD17', 1, 16, NULL, 'fee',           'debit',  'Locker rental fee',                        'NexBank',                  3540.0000, 'INR', 857880.0000, 'completed', '2026-10-30 10:00:00'),
  ('TXN20261101AD18', 1, 15, NULL, 'deposit',       'credit', 'Salary credit - NexBank Payroll',          'NexBank Payroll',        185000.0000, 'INR', 243331.0000, 'completed', '2026-11-01 09:00:00'),
  ('TXN20261104AD19', 1, 15, NULL, 'card_payment',  'debit',  'Card purchase - Taj Hotels',               'Taj Hotels',              18450.0000, 'INR', 224881.0000, 'completed', '2026-11-04 21:30:00'),
  ('TXN20261003AW01', 1, NULL, @admin_wallet, 'self_transfer', 'credit', 'Top-up from salary NEX1000000015', 'Own account', 150000.0000, 'INR', 150800.0000, 'completed', '2026-10-03 18:00:00'),
  ('TXN20261005AW02', 1, NULL, @admin_wallet, 'conversion', 'debit',  'Converted INR to USD', NULL, 83200.0000, 'INR',  67600.0000, 'completed', '2026-10-05 10:10:00'),
  ('TXN20261005AW03', 1, NULL, @admin_wallet, 'conversion', 'credit', 'Converted INR to USD', NULL,  1000.0000, 'USD',   1000.0000, 'completed', '2026-10-05 10:10:05'),
  ('TXN20261009AW04', 1, NULL, @admin_wallet, 'conversion', 'debit',  'Converted USD to GBP', NULL,   300.0000, 'USD',    700.0000, 'completed', '2026-10-09 15:25:00'),
  ('TXN20261009AW05', 1, NULL, @admin_wallet, 'conversion', 'credit', 'Converted USD to GBP', NULL,   237.0000, 'GBP',    237.0000, 'completed', '2026-10-09 15:25:05'),
  ('TXN20261014AW06', 1, NULL, @admin_wallet, 'conversion', 'debit',  'Converted INR to EUR', NULL, 36160.0000, 'INR',  31440.0000, 'completed', '2026-10-14 12:40:00'),
  ('TXN20261014AW07', 1, NULL, @admin_wallet, 'conversion', 'credit', 'Converted INR to EUR', NULL,   399.8461, 'EUR',    399.8461, 'completed', '2026-10-14 12:40:05'),
  ('TXN20261022AW08', 1, NULL, @admin_wallet, 'conversion', 'debit',  'Converted USD to JPY', NULL,   200.0000, 'USD',    500.0000, 'completed', '2026-10-22 08:55:00'),
  ('TXN20261022AW09', 1, NULL, @admin_wallet, 'conversion', 'credit', 'Converted USD to JPY', NULL, 31500.0000, 'JPY',  31500.0000, 'completed', '2026-10-22 08:55:05'),
  ('TXN20261027AW10', 1, NULL, @admin_wallet, 'conversion', 'debit',  'Converted USD to AED', NULL,   250.0000, 'USD',    250.0000, 'completed', '2026-10-27 17:30:00'),
  ('TXN20261027AW11', 1, NULL, @admin_wallet, 'conversion', 'credit', 'Converted USD to AED', NULL,   918.1250, 'AED',    926.9550, 'completed', '2026-10-27 17:30:05'),
  ('TXN20261103AW12', 1, NULL, @admin_wallet, 'conversion', 'debit',  'Converted EUR to INR', NULL,   100.0000, 'EUR',    299.8461, 'completed', '2026-11-03 11:05:00'),
  ('TXN20261103AW13', 1, NULL, @admin_wallet, 'conversion', 'credit', 'Converted EUR to INR', NULL,  9043.4783, 'INR',  40483.4783, 'completed', '2026-11-03 11:05:05');

INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES
  (1, 'Salary credited',         'INR 185,000.00 has been credited to account ending 0015.',                         'transaction', 0, '2026-11-01 09:00:00'),
  (1, 'Currency converted',      'EUR 100.00 converted to INR 9,043.48 in your wallet.',                              'transaction', 0, '2026-11-03 11:05:05'),
  (1, 'Transfer pending',        'Your transfer of INR 250,000.00 to Prestige Estates is awaiting verification.',     'transfer',    0, '2026-10-23 11:41:00'),
  (1, 'Wire transfer returned',  'Your wire transfer of USD 2,000.00 to Harbor Supplies LLC was returned by the receiving bank.', 'transfer', 1, '2026-10-29 22:15:00');

INSERT INTO audit_logs (user_id, actor_email, action, entity_type, entity_id, description, status, ip_address, created_at) VALUES
  (1, 'admin@nexbank.com', 'wallet.convert',  'conversion', NULL, 'Converted INR 83,200.00 to USD 1,000.00',      'success', '198.51.100.2', '2026-10-05 10:10:00'),
  (1, 'admin@nexbank.com', 'wallet.convert',  'conversion', NULL, 'Converted USD 300.00 to GBP 237.00',           'success', '198.51.100.2', '2026-10-09 15:25:00'),
  (1, 'admin@nexbank.com', 'wallet.convert',  'conversion', NULL, 'Converted INR 36,160.00 to EUR 399.85',        'success', '198.51.100.2', '2026-10-14 12:40:00'),
  (1, 'admin@nexbank.com', 'wallet.convert',  'conversion', NULL, 'Converted USD 200.00 to JPY 31,500',           'success', '198.51.100.2', '2026-10-22 08:55:00'),
  (1, 'admin@nexbank.com', 'wallet.convert',  'conversion', NULL, 'Converted USD 250.00 to AED 918.13',           'success', '198.51.100.2', '2026-10-27 17:30:00'),
  (1, 'admin@nexbank.com', 'wallet.convert',  'conversion', NULL, 'Converted EUR 100.00 to INR 9,043.48',         'success', '198.51.100.2', '2026-11-03 11:05:00'),
  (1, 'admin@nexbank.com', 'transfer.create', 'transfer',   NULL, 'Transfer of INR 250,000.00 held for verification', 'success', '198.51.100.2', '2026-10-23 11:40:00');
