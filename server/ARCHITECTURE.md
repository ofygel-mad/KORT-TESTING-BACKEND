# Kort Server — Architecture

Backend for the Kort ERP/CRM system. Serves the React SPA frontend.

## Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **Framework**: Fastify 5
- **ORM**: Prisma (PostgreSQL)
- **Auth**: JWT (access + refresh tokens, rotation on refresh)
- **Validation**: Zod
- **Password hashing**: bcryptjs

## Directory Structure

```
server/
├── prisma/
│   ├── schema.prisma            # Database schema (28 tables)
│   └── seed.ts                  # Demo data seeder
├── src/
│   ├── index.ts                 # Entry point — starts Fastify on :8000
│   ├── app.ts                   # App factory — registers plugins, routes, error handler
│   ├── config.ts                # Env validation via Zod (DATABASE_URL, JWT secrets, etc.)
│   ├── lib/                     # Shared utilities (no business logic)
│   │   ├── prisma.ts            # Prisma client singleton + connect/disconnect
│   │   ├── jwt.ts               # signAccessToken, signRefreshToken, verify*
│   │   ├── hash.ts              # hashPassword, verifyPassword (bcrypt)
│   │   ├── errors.ts            # AppError hierarchy (NotFound, Forbidden, etc.)
│   │   └── pagination.ts        # paginate(), paginatedResponse() + Zod schema
│   ├── plugins/                 # Fastify plugins (decorators on request/instance)
│   │   ├── auth.ts              # authenticate / optionalAuth → sets request.userId
│   │   └── org-scope.ts         # resolveOrg → sets request.orgId, orgRole
│   ├── types/
│   │   └── fastify.d.ts         # FastifyRequest augmentation (userId, orgId, etc.)
│   └── modules/                 # Feature modules (each has routes + service)
│       ├── auth/
│       ├── users/
│       ├── orgs/
│       ├── memberships/
│       ├── customers/
│       ├── leads/
│       ├── deals/
│       └── tasks/
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## Module Pattern

Every module follows the same pattern:

- `<module>.routes.ts` — Fastify route definitions. Handles HTTP layer: parsing params/body with Zod, calling service, returning response. No business logic here.
- `<module>.service.ts` — Business logic. Calls Prisma directly. Throws `AppError` subclasses on failures. Returns plain objects (no Fastify coupling).

This separation means services can be reused (e.g. from a future CLI, background jobs, or tests) without importing Fastify.

## Authentication & Authorization Flow

Every protected request goes through a preHandler chain:

```
request
  → authenticate         (plugins/auth.ts)      — verifies JWT, sets request.userId
  → resolveOrg           (plugins/org-scope.ts)  — finds active membership, sets request.orgId + orgRole
  → requireRole(...)     (plugins/org-scope.ts)  — checks orgRole against required minimum
  → route handler
```

### Roles (global, per-org membership)

| Role    | Level | Can do |
|---------|-------|--------|
| owner   | 4     | Everything + billing |
| admin   | 3     | Everything except billing |
| manager | 2     | Core CRM features |
| viewer  | 1     | Read-only |

### Token Flow

- Login/register returns `{ access, refresh }`.
- Access token: short-lived (15m default), contains `{ sub: userId, email }`.
- Refresh token: long-lived (7d), stored in DB. On refresh, old token is deleted and new pair is issued (rotation).
- Frontend sends `Authorization: Bearer <access>` on every request.
- On 401, frontend calls `POST /api/v1/auth/token/refresh` with the refresh token.

## Multitenancy

All data is scoped to an organization (`orgId`). The `resolveOrg` plugin reads the user's active membership and injects `orgId` into the request. Every service method takes `orgId` as its first parameter and includes it in all Prisma queries. There is no way to access another org's data.

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | No | Login with email + password |
| POST | `/auth/register/employee` | No | Register as employee (optionally with invite token) |
| POST | `/auth/register/company` | No | Register + create new organization |
| POST | `/auth/token/refresh` | No | Exchange refresh token for new pair |
| GET | `/auth/bootstrap` | Optional | Get current session (user, org, role, capabilities) |
| GET | `/auth/me` | Optional | Alias for bootstrap |

### Users (`/users`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | Yes | Get current user profile |
| GET | `/users/team` | Yes+Org | List team members in current org |
| PATCH | `/users/:id/role` | Admin+ | Change a member's role |
| POST | `/users/:id/activate` | Admin+ | Activate a user account |
| POST | `/users/:id/deactivate` | Admin+ | Deactivate a user account |

### Organization

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/organization` | Yes+Org | Get current org details |
| PATCH | `/organization` | Admin+ | Update org settings |
| GET | `/companies/search?q=` | No | Search orgs by name/slug |

### Memberships & Invites

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/membership-requests` | Yes | Submit request to join an org |
| GET | `/membership-requests/me` | Yes | List own membership requests |
| GET | `/admin/membership-requests` | Admin+ | List pending requests for the org |
| POST | `/admin/membership-requests/:id/approve` | Admin+ | Approve a request |
| POST | `/admin/membership-requests/:id/reject` | Admin+ | Reject a request |
| POST | `/admin/invites` | Admin+ | Create an invite link |
| GET | `/admin/invites` | Admin+ | List invites for the org |
| GET | `/invites/:token` | No | Get invite details by token |

### CRM: Customers (`/customers`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/customers?page=&limit=` | Yes+Org | Paginated customer list |
| GET | `/customers/:id` | Yes+Org | Get customer by ID |
| POST | `/customers` | Yes+Org | Create customer |
| PATCH | `/customers/:id` | Yes+Org | Update customer |

### CRM: Leads (`/leads`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/leads?pipeline=&stage=&page=&limit=` | Yes+Org | Filtered/paginated leads |
| GET | `/leads/:id` | Yes+Org | Get lead with history |
| POST | `/leads` | Yes+Org | Create lead |
| PATCH | `/leads/:id` | Yes+Org | Update lead (auto-logs stage changes) |
| POST | `/leads/:id/history` | Yes+Org | Add history entry (comment, note) |
| POST | `/leads/:id/checklist` | Yes+Org | Toggle checklist item { itemId, done } |

### CRM: Deals (`/deals`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/deals?page=&limit=` | Yes+Org | Paginated deals |
| GET | `/deals/:id` | Yes+Org | Get deal with activities + tasks |
| POST | `/deals` | Yes+Org | Create deal |
| PATCH | `/deals/:id` | Yes+Org | Update deal (auto-logs stage changes) |
| POST | `/deals/:id/activities` | Yes+Org | Add activity (note, call, etc.) |
| DELETE | `/deals/:id` | Yes+Org | Delete deal |

### CRM: Tasks (`/tasks`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/tasks?status=&priority=&page=&limit=` | Yes+Org | Filtered/paginated tasks (with subtasks + activities) |
| GET | `/tasks/:id` | Yes+Org | Get task with subtasks + activities |
| POST | `/tasks` | Yes+Org | Create task (auto-creates system activity) |
| PATCH | `/tasks/:id` | Yes+Org | Update task fields |
| PATCH | `/tasks/:id/status` | Yes+Org | Move task status (auto-logs, auto-sets completedAt) |
| POST | `/tasks/:id/subtasks` | Yes+Org | Add subtask |
| PATCH | `/tasks/:id/subtasks/:subtaskId` | Yes+Org | Toggle subtask done |
| POST | `/tasks/:id/activities` | Yes+Org | Add activity (comment, etc.) |
| DELETE | `/tasks/:id` | Yes+Org | Delete task |

### Sales, Production, Warehouse, Returns, Integrations

Module-specific route tables have been removed from this doc as they go stale fast.
The source of truth for current route registrations is `src/index.ts` (buildApp)
and the per-module `*.routes.ts` files.

### Utility

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |

## Database Schema Overview

### Identity & Access (5 tables)

- `users` — user accounts (email, password hash, status)
- `refresh_tokens` — stored refresh tokens (for rotation/revocation)
- `organizations` — companies/workspaces
- `memberships` — user ↔ org link with role + status
- `invites` — invite tokens for joining an org
- `membership_requests` — pending join requests

### CRM (6 tables)

- `customers` — contacts (scoped to org)
- `leads` — sales leads with pipeline/stage
- `lead_history` — audit trail for lead changes
- `deals` — deals with stage, value, probability
- `deal_activities` — deal event log
- `tasks` — to-do items, optionally linked to deals

### Sales / Production

- `orders` — orders with status/payment/priority axes
- `order_items` — line items
- `production_tasks` — 1:1 with order items, tracks production pipeline
- `payments` — payment records per order
- `order_transfers` — two-party handoff confirmation
- `order_activities` — full audit log with author
- `workers`, `product_sizes`, `payment_methods` — per-org catalogs

(Full inventory: see `prisma/schema.prisma`.)

## Key Behaviors

### Order Lifecycle

```
new → confirmed → in_production → ready → transferred → completed
                                       ↘ cancelled
```

- **Confirm** auto-creates `production_tasks` from `order_items`.
- **All tasks done** → order auto-transitions to `ready`.
- **Transfer** requires both manager + client confirmation.

### Production Pipeline (per task)

```
pending → cutting → sewing → finishing → quality_check → done
```

Tasks can be blocked/unblocked with a reason at any stage.

### Payment Tracking

- Each payment is a separate record.
- `paidAmount` is accumulated. `paymentStatus` auto-computed: `not_paid | partial | paid`.

### Data Isolation (Workshop Console)

The production workshop endpoint returns tasks **without** `clientName` and `clientPhone`. This is the endpoint used by workshop_lead/worker roles who should not see client PII.

### Activity Log

Every significant action (status change, payment, production update, comment, transfer) creates an `order_activities` record with `authorId` + `authorName`. No more hardcoded "Менеджер".

## Running

```bash
cd server
cp .env.example .env              # configure DATABASE_URL and JWT secrets
npm install
npx prisma migrate dev             # create tables
npm run db:seed                    # seed demo data
npm run dev                        # start dev server on :8000
```

The frontend Vite dev server proxies `/api/*` → `http://localhost:8000` (configured in `vite.config.ts`). To switch from mock to real backend, set `VITE_MOCK_API=false` in the frontend `.env.local`.

## Demo Accounts

All passwords: `demo1234`

| Email | Role | Purpose |
|-------|------|---------|
| admin@kort.local | owner | Full access |
| manager@kort.local | admin | Manager access |
| lead@kort.local | manager | Workshop lead |
| worker@kort.local | manager | Workshop worker |
| viewer@kort.local | viewer | Read-only |

## Extending

To add a new module:

1. Create `src/modules/<name>/<name>.service.ts` — business logic
2. Create `src/modules/<name>/<name>.routes.ts` — Fastify routes
3. Register in `src/app.ts` with `app.register(routes, { prefix: '/api/v1/<name>' })`
4. Add Prisma models to `prisma/schema.prisma`, run `npx prisma migrate dev`

The module pattern (routes ↔ service ↔ Prisma) keeps each feature self-contained. Services never import Fastify, routes never import Prisma directly.
