# CLAUDE.md — NexBank

Guidance for Claude Code when working in this repository.

## Project

**NexBank** — an online banking / digital banking SaaS platform.
Repository: https://github.com/Sahithya74/NexBank (work on `main`).

Developer credit: **Designed and Developed by Sahithya K.**
Place it subtly — application footer, login page footer, About/system info panel.
Never a large overlay, never a banner, never on top of dashboard content.

The product must read as a real banking SaaS tool, not a template or a demo.

## Stack (non-negotiable)

- **Frontend:** React (Vite), component-based, responsive CSS.
- **Backend:** Node.js + Express.
- **Database:** MySQL.

Do not substitute another framework, ORM-first architecture, or database. If a
substitution seems genuinely required, raise it before implementing it.

## Architecture

```
React client  →  Express REST API  →  MySQL
```

Target tree:

```
NexBank/
├── client/
│   └── src/{components,pages,layouts,hooks,services,utils,context,assets}/
├── server/
│   └── {controllers,routes,models,middleware,services,utils,config}/ + server.js
├── database/
│   ├── schema.sql
│   └── seed.sql
├── README.md
├── CLAUDE.md
└── .gitignore
```

Keep new files inside this structure. No business logic in route files — routes
wire to controllers, controllers call services, services own DB access.

## Modules

| Module | Responsibility |
| --- | --- |
| Auth | Register, login, logout, password management, token/session handling |
| RBAC | Roles, permissions, backend authorization middleware |
| Accounts | Bank accounts, masked account numbers, balances, statements |
| Wallet | Multi-currency balances, conversion, rates, conversion history |
| Transfers | Own-account, internal, beneficiary management, multi-step flow |
| Transactions | Full ledger with search, filter, sort, status |
| Bills | Billers, pending bills, payment, payment history |
| Cards | Debit/credit cards, masked numbers, block/unblock, controls |
| Loans | Products, application, EMI calculation, repayment tracking |
| Notifications | Read/unread states, filtering, mark-all-read |
| Admin | Users, roles, accounts, monitoring, reports, system config |
| Audit logs | Immutable record of security- and money-relevant actions |

## RBAC

Four roles:

- **Customer** — own profile, accounts, balances, wallet, transfers,
  beneficiaries, transactions, bills, cards, notifications.
- **Bank Employee** — assigned customer info, process requests, review
  transactions, assist with account operations.
- **Manager** — review sensitive operations, approve/reject eligible requests,
  monitor transactions, review reports.
- **Administrator** — users, roles, permissions, accounts, transaction
  monitoring, system settings, analytics, reports.

**Hard rule:** authorization is enforced in Express middleware on every protected
route. Hiding a button in React is presentation, never protection. Every endpoint
declares the permission it requires; an unauthorized call returns `403`, not data.

Permissions live in the database (`roles`, `permissions`, `role_permissions`) so
they can be changed without redeploying.

## Multi-currency wallet

Flagship feature. Supported at launch: **INR, USD, EUR, GBP, JPY, AED**.

Currencies are **data, not code** — stored in a `currencies` table with code,
symbol, name, and decimal precision. Adding a currency must require no schema
change and no frontend hardcoding. Never hardcode a currency list in a component.

Wallet balances live in `wallet_balances` (one row per wallet × currency), never
as columns per currency.

## Money and data consistency

- Store monetary values as `DECIMAL`, never `FLOAT`/`DOUBLE`. Do the same in JS —
  no floating-point arithmetic on balances.
- Any operation touching more than one balance row (transfer, conversion, bill
  payment, loan repayment) runs inside a **MySQL transaction** with commit/rollback.
- Verify sufficient balance inside the transaction, not before it.
- Guard against duplicate submission (idempotency key or reference number).
- The UI shows success **only after** the API confirms it. No optimistic success
  for financial operations.
- Every financial operation writes a transaction record and an audit log entry.

## API conventions

Routes: `/api/auth`, `/api/users`, `/api/accounts`, `/api/wallets`,
`/api/currencies`, `/api/transfers`, `/api/transactions`, `/api/beneficiaries`,
`/api/cards`, `/api/bills`, `/api/loans`, `/api/notifications`, `/api/admin`,
`/api/audit-logs`.

Use correct verbs: `GET` read, `POST` create, `PUT`/`PATCH` update, `DELETE` remove.

One response envelope everywhere:

```json
{ "success": true,  "data": {}, "message": "" }
{ "success": false, "error": { "code": "INSUFFICIENT_FUNDS", "message": "" } }
```

Errors carry a stable machine code plus a user-safe message. Never leak SQL text,
stack traces, or driver errors to the client.

## Database conventions

Normalized schema. Core entities: `users`, `roles`, `permissions`,
`role_permissions`, `accounts`, `wallets`, `currencies`, `wallet_balances`,
`transactions`, `beneficiaries`, `cards`, `bills`, `bill_payments`, `loans`,
`loan_payments`, `notifications`, `audit_logs`.

Every table: primary key, appropriate foreign keys with sensible `ON DELETE`
behaviour, indexes on lookup and join columns, unique constraints where the domain
demands them, `created_at` / `updated_at` timestamps. No catch-all tables.

Schema changes go into `database/schema.sql`; sample data into `database/seed.sql`.

## Security

- Hash passwords with bcrypt (or argon2). Never store or log plaintext passwords.
- Authentication middleware on every non-public route; RBAC middleware after it.
- Validate and sanitize all input server-side. Client validation is UX only.
- **Parameterized queries only** — never build SQL by string concatenation.
- Configure CORS explicitly with an allowlist; no wildcard in production.
- All secrets via environment variables. Ship `.env.example` with keys only.
- Rate-limit auth endpoints and other sensitive routes.
- Mask account numbers, card numbers, and CVVs in every API response. Full values
  never leave the server.
- **Never commit** `.env`, credentials, JWT secrets, or API keys.

## Error handling

Handle gracefully with user-friendly messages: invalid login, unauthorized access,
insufficient balance, invalid or unsupported currency, failed transfer, database
errors, invalid form input, network failure, expired session. A user should always
learn what happened and what to do next — never see a raw server error.

## UI/UX

Palette:

- Primary: deep navy / dark blue
- Secondary: professional blue, white, light neutral surfaces
- Status only: green = success, amber = pending, red = failed/danger

Status colors carry meaning — never use them decoratively.

**Avoid:** heavy gradients, glassmorphism, cartoon illustrations, neon or overly
bright colors, oversized decorative elements, excessive animation, generic
AI-looking hero layouts.

**Prefer:** clean cards, structured grids, strong typography, generous and
consistent spacing, subtle shadows, clear hierarchy, financial charts, dense data
tables, elegant navigation.

Every data-driven page implements four states: **loading, empty, error, success.**
No blank screen while fetching.

Responsive means real layouts for desktop, laptop, tablet, and mobile — not shrunk
desktop components. The sidebar collapses appropriately; tables stay usable on
small screens (horizontal scroll container or a card view).

## Components

Reuse before creating. Shared components live in `client/src/components/`:
`Sidebar`, `Navbar`, `DashboardCard`, `AccountCard`, `WalletCard`, `CurrencyCard`,
`TransactionTable`, `TransactionStatus`, `Modal`, `ConfirmationDialog`, `FormField`,
`Button`, `NotificationPanel`, `UserAvatar`, `DataTable`, `ChartCard`, `EmptyState`,
`LoadingState`, `ErrorState`.

If a UI pattern appears twice, extract it. Do not duplicate markup or styles.

## Accessibility

Semantic HTML. Labels bound to inputs. Full keyboard navigation. Sufficient
contrast. Accessible buttons (real `<button>`, never a clickable `<div>`). Form
errors announced and tied to their field.

## Git workflow

- Work on `main`.
- Conventional prefixes: `feat:`, `fix:`, `ui:`, `refactor:`, `docs:`, `chore:`.
- **Banned messages:** `update`, `changes`, `final`, `done`, `test`.
- Before pushing: the app builds, no secrets are staged, `.env` is ignored, and the
  repo is not left broken.
- Commit and push after each completed, tested stage — not mid-refactor.

## Working agreement

- Inspect what exists before changing it. Improve working code; do not rewrite it
  wholesale.
- Finish incomplete features rather than starting parallel ones.
- Every UI affordance connects to real logic. No mock-only screens: a "Transfer"
  button validates, authorizes, checks balance, writes the transaction, updates
  balances, records an audit entry, and reports the real result.
- Do not add dependencies without a clear reason.
- Keep naming, structure, and styling consistent across the whole application.

---

Designed and Developed by Sahithya K.
