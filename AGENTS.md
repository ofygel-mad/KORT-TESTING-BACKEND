# KORT Project Deep Snapshot

This file is a high-detail engineering map of the repository for future AI agents. It is intended to remove the need for repeated discovery work across the frontend, backend, database, runtime, and deployment layers.

Important rule: treat the code as the source of truth. Some markdown docs in `README.md`, `A-Markdown/`, and `server/ARCHITECTURE.md` are useful context, but parts of them are stale, partially legacy, or affected by historical encoding issues.

## 1. Executive Summary

KORT is a monorepo with:

- A frontend SPA in the repo root using `React 18 + Vite + TypeScript`.
- A backend API in `server/` using `Fastify 5 + Prisma + PostgreSQL`.
- A multi-domain product that combines:
  - CRM (`leads`, `deals`, `customers`, `tasks`)
  - organization and employee management
  - a large `Chapan` workzone for atelier/workshop operations
  - a standard warehouse module
  - a much deeper "Warehouse Foundation" runtime/control-tower/execution engine layer
  - accounting
  - chat
  - internal console/service access

The product is not a simple CRUD app. It contains:

- hard access gating by org plan and employee permissions
- organization-scoped multitenancy
- long-running domain workflows (orders, production, invoices, returns, warehouse routing)
- live updates over SSE
- a WebSocket chat channel
- a background warehouse outbox worker

The single largest domain is `Chapan`. The deepest technical subsystem is `warehouse`.

## 2. Repository Layout

### Runtime directories

- `src/`: frontend application
- `server/src/`: backend application
- `server/prisma/`: schema, migrations, seed
- `tests/e2e/`: Playwright end-to-end tests
- `public/`: static assets, manifest, offline page, legacy service worker file

### Secondary directories

- `A-Markdown/`: audits, guides, implementation notes, mostly operational documentation
- `_database-report/`: exported database snapshots/reports
- `dist/`: frontend build output
- `playwright-report/`, `test-results/`, `server/coverage/`: generated test artifacts
- `docker/`: helper startup scripts
- `.recovery/`: recovery artifacts

### Core root files

- `package.json`: frontend scripts and dependencies
- `vite.config.ts`: frontend bundling, proxy, Vitest config, manual chunking
- `playwright.config.ts`: e2e orchestration
- `docker-compose.yml`: full local stack
- `railway.toml`: frontend deployment
- `server/package.json`: backend scripts/dependencies
- `server/src/app.ts`: Fastify app factory
- `server/src/index.ts`: backend entrypoint, websocket attach, warehouse worker startup
- `server/prisma/schema.prisma`: full database model

## 3. Frontend Architecture

## 3.1 Boot Sequence

Frontend bootstrap lives in `src/main.tsx`.

Responsibilities:

- initializes Sentry when `VITE_SENTRY_DSN` is present
- creates a shared React Query `QueryClient`
- wraps the app in `QueryClientProvider`
- runs `SessionBootstrap`, which synchronizes frontend auth state with `/auth/bootstrap`
- mounts global `sonner` toasts
- mounts `ConsoleRoot`
- conditionally shows the animated `Launch` intro
- installs chunk-load recovery handlers for broken lazy-load chunks
- unregisters legacy service workers and clears caches in production

Key bootstrap behavior:

- React Query defaults are relatively conservative:
  - query `staleTime`: 60s
  - `gcTime`: 2 min
  - `retry`: 1
  - no refetch on window focus
- If a request mutation fails globally, a toast is shown via `readApiErrorMessage`.
- `SessionBootstrap`:
  - reads `token`, `refreshToken`, and membership context from `useAuthStore`
  - calls `/auth/bootstrap/`
  - if bootstrap fails with `401/403`, attempts `/auth/token/refresh/`
  - clears auth if refresh cannot recover session
- The intro is skipped on:
  - mobile devices
  - `/workzone/request`
  - users who already have `kort.workspace:intro-v1` in local storage

## 3.2 Router and Route Gating

Frontend routing is in `src/app/router/index.tsx`.

Gate layers:

- `RequireAuth`: requires `useAuthStore().user`
- `RequireOrg`: requires active org membership
- `RequirePlan`: blocks modules above current org mode
- `RequirePermission`: blocks employee users lacking module access

Org plan tiers:

- `basic`
- `advanced`
- `industrial`

Main route groups:

- `/`: workspace canvas
- `/crm/*`: leads, deals, customers, tasks
- `/warehouse`, `/warehouse/twin`, `/warehouse/control-tower`, `/warehouse/operations`
- `/production`, `/finance`, `/employees`, `/reports`, `/documents`, `/settings`
- `/onboarding`
- `/workzone/chapan/*`
- `/auth/login`, `/auth/register`, `/auth/accept-invite`, `/reset-password`
- `/dev`

Important nuance:

- `src/pages/workzone-request/index.tsx` exists and the UI opens `/workzone/request`, but this route is not registered in `AppRouter` in the current snapshot. `main.tsx` still special-cases that pathname for intro skipping. This is either an incomplete route migration or an externally-served page assumption.

## 3.3 Layout Layer

Main layout files in `src/app/layout/`:

- `AppShell.tsx`: primary authenticated shell
- `Sidebar.tsx`, `Topbar.tsx`, `MobileNav.tsx`: chrome/navigation
- `AuthShell.tsx`, `AuthPresentation.tsx`, `LockedChrome.tsx`: auth and restricted presentations

Navigation metadata lives in `src/shared/navigation/appNavigation.ts`.

The sidebar model defines:

- canvas entry
- settings entry
- grouped shortcut sections:
  - CRM
  - Operations
  - Analytics
- a separate `CHAPAN_NAV_ITEM`

Each shortcut defines:

- route
- icon
- label/description
- color
- required plan tier

## 3.4 Auth, Org, and Permission State

### `src/shared/stores/auth.ts`

This is the main persisted frontend auth store.

Stored state:

- `user`
- `org`
- `token`
- `refreshToken`
- `role`
- `capabilities`
- `membership`
- `inviteContext`
- `userOrgs`
- `selectedOrgId`
- `isUnlocked`

Notable behavior:

- derives active org from membership if membership is active
- persists auth to local storage under `kort-auth`
- supports multi-org switching via `selectedOrgId`, which is sent as `X-Org-Id`

### Permission hooks

- `useRole()`: owner/admin/manager/viewer helper flags
- `useEmployeePermissions()`: decodes checkbox-style employee permissions
- `useChapanPermissions()`: derives Chapan-specific access and action rights
- `usePlan()`: current org mode and plan comparisons

Permission system is layered:

- owners/admins get broad bypasses
- `full_access` acts like near-absolute employee privilege
- otherwise access is derived from granular permissions such as:
  - `sales`
  - `production`
  - `warehouse_manager`
  - `financial_report`
  - `chapan_full_access`
  - `chapan_access_orders`
  - `chapan_access_production`
  - `chapan_access_ready`
  - `chapan_access_archive`
  - `chapan_access_warehouse_nav`
  - `chapan_confirm_invoice`
  - `chapan_manage_settings`

## 3.5 API and Data Access Layer

### `src/shared/api/client.ts`

This is the central Axios client.

Responsibilities:

- computes `API_BASE_URL`
- prefers Vite proxy in local dev if `VITE_API_BASE_URL` points at localhost
- injects:
  - `Authorization`
  - `X-Org-Id`
  - `X-Request-ID`
  - `Idempotency-Key` for mutating methods
- emits request/response/error events into the internal console
- performs access-token refresh retry on `401`
- clears auth and redirects if refresh fails
- suppresses some permission toasts when auth is not fully established

Important note:

- The comment in this file explicitly says mock API is disabled and the app should use the real backend.
- Legacy mock files still exist in `src/shared/api/mock-*`, but the active flow is real API first.

### Entity layer

Domain-specific API/query/type files live under `src/entities/*`.

Pattern:

- `api.ts`: raw HTTP functions
- `queries.ts`: React Query hooks
- `types.ts`: frontend contracts
- `live.ts`: SSE synchronization where needed

Most important entity modules:

- `order`: Chapan orders/production/invoices/settings/attachments/returns/managers
- `warehouse`: classic warehouse + warehouse foundation/foundation-runtime APIs
- `lead`, `deal`, `customer`, `task`, `employee`, `finance`, `alert`

## 3.6 Workspace Canvas System

The canvas/home screen is not a simple dashboard. It is a draggable, persistent workspace.

Core files:

- `src/pages/canvas/index.tsx`
- `src/features/workspace/model/store.ts`
- `src/features/workspace/model/types.ts`
- `src/features/workspace/registry.tsx`
- `src/features/workspace/components/*`
- `src/features/workspace/scene/*`

Key concepts:

- tiles represent module shortcuts/widgets
- tile positions are stored in persisted Zustand state
- workspace has:
  - world bounds larger than viewport (`WORLD_FACTOR = 3`)
  - zoom
  - scene theme
  - terrain mode
  - background mode
  - tile idle/drifting states
- tile data includes:
  - kind
  - title
  - x/y
  - modal size
  - status
  - 3D rotation
  - z-index
  - pinned flag

Behavior:

- desktop uses `WorkspaceCanvas`
- mobile does not use the 3D canvas; it collapses into a card-based menu
- canvas supports:
  - panning
  - wheel zoom with ctrl/cmd
  - scene mode toggle (`surface` vs `flight`)
  - keyboard shortcuts for themes and zoom
  - context menu per tile
  - lazy tile previews

The workspace registry in `registry.tsx` maps navigation items into tile definitions and preview components.

Tile preview source:

- `src/features/workspace/widgets/TileLivePreviews.tsx`

These previews surface lightweight snapshots for:

- leads
- deals
- customers
- tasks
- warehouse
- production
- finance
- employees
- reports
- documents
- chapan

## 3.7 Global Utility/UI Systems

Important cross-cutting frontend systems:

- `src/console/*`: internal developer console, fed by API client events
- `src/widgets/command-palette/*`: command palette UI
- `src/features/chat/*` and `src/shared/stores/chat.ts`: chat UI state and socket hooks
- `src/shared/hooks/useSSE.ts`: generic SSE listener for `/sse/`
- `src/shared/ui/*`: reusable UI primitives
- `src/shared/design/globals.css`: global design tokens/styles

## 3.8 Additional Product Surfaces and Operational Pages

The repository contains several substantial frontend surfaces outside the core canvas/CRM/warehouse/Chapan walkthroughs. Future agents should not treat them as "minor settings pages".

### Settings and team administration

`src/pages/settings/index.tsx` is a large control surface, not a thin profile page.

It owns tabbed sections for:

- profile
- organization
- company access / team
- appearance
- security
- integrations
- webhooks
- templates
- API tokens

Important details:

- organization settings include legal, tax, bank, shipping-signatory, transport, currency, and contact fields
- the page uses `useCompanyAccess`, `useCapabilities`, `usePinStore`, `useUIStore`, and `useProfileStore`
- some sections are fully implemented while others are currently stubs with product-facing placeholders
- the page is a major entry point for org configuration and employee access governance

`src/pages/employees/index.tsx` is a separate dedicated employee admin surface.

It provides:

- add employee drawer with phone normalization/validation
- edit employee drawer
- department presets
- granular permission checklist
- reset password flow
- dismiss/deactivate flow
- permanent remove flow

This means employee management is intentionally split across:

- `settings` for company-access context
- `employees` for dedicated HR/admin operations

### Finance, reports, and documents

`src/pages/finance/index.tsx` is a lightweight accounting journal and summary UI over the accounting backend.

It includes:

- `journal` and `summary` tabs
- period and type filtering
- manual entry creation drawer
- CSV export
- category/account/counterparty/source rendering

`src/pages/reports/index.tsx` is an analytics surface that aggregates multiple domains rather than a pure BI layer.

Tabs:

- `sales`: won deals + Chapan revenue/paid metrics by manager
- `funnel`: lead and deal stage rollups
- `production`: Chapan order totals by production status

It reads from:

- leads
- deals
- Chapan orders

and exports CSV snapshots from each reporting tab.

`src/pages/documents/index.tsx` is currently more of a document catalog and roadmap surface than a fully implemented document factory.

It groups documents into:

- production
- contracts
- acts
- financial

Important nuance:

- the invoice modal is the main active piece
- many other document actions are present as disabled placeholders marked "in development"

### Activity, audit, automations, and imports

`src/pages/feed/index.tsx` is an org-wide activity feed UI backed by `/feed/`, polling every 30 seconds, and linking activity records back into customer/deal pages.

`src/pages/audit/index.tsx` is a gated audit-log surface backed by `/audit/`. It is only enabled when `can('audit.read')` resolves true, which usually means higher plan/capability access.

`src/pages/automations/index.tsx` is a substantial rule-builder UI for trigger -> condition groups -> actions. It models:

- trigger catalogs
- field/operator compatibility by trigger
- grouped conditions with `AND`/`OR`
- action stacks such as task creation, notes, notifications, field updates, stage changes, and webhooks

`src/pages/imports/index.tsx` is a guided import wizard:

- file upload
- preview/mapping
- import start
- polling of active jobs

The frontend expects `/imports/` APIs and a state machine around statuses such as uploaded, analyzing, mapping_required, processing, completed, and failed.

### Onboarding and intro flows

`src/pages/onboarding/index.tsx` is a full first-run flow that writes org setup data back to `/organization/`.

It captures:

- business type
- company size
- selected product mode (`basic`, `advanced`, `industrial`)
- quick-link handoff into first meaningful app actions

`src/pages/launch/index.tsx` is a cinematic intro screen that times a staged reveal and then navigates into the main application. It is presentation-heavy and operationally separate from auth/business logic.

Important architecture nuance:

- the repository contains more page modules than the main router summary alone suggests
- code presence does not guarantee current route registration
- future agents should verify both `src/app/router/index.tsx` and `main.tsx` before assuming a page is reachable in the current build

## 4. Chapan Workzone Frontend

This is the most operationally dense frontend area.

## 4.1 Chapan Shell

Main shell:

- `src/pages/workzone/chapan/ChapanShell.tsx`

Responsibilities:

- separate shell/layout from the main app chrome
- shows only the sections allowed for the current user
- exposes special nav entries:
  - orders
  - production
  - ready
  - archive
  - invoices
  - warehouse
  - returns
  - trash
- supports mobile horizontal rail
- includes iOS-style swipe-back gesture for subpages
- mounts `ChapanInvoicesDrawer` globally

Transient Chapan UI state lives in `src/features/workzone/chapan/store.ts`:

- selected order id
- invoice drawer state
- list filters for orders

Important bugfix note already encoded in comments:

- `selectedOrderId` is intentionally not persisted because persisting it caused redirect loops on returning from order details to the list.

## 4.2 Chapan Data Contracts

Primary type system:

- `src/entities/order/types.ts`

Important model facts:

- order statuses:
  - `new`
  - `confirmed`
  - `in_production`
  - `ready`
  - `transferred`
  - `on_warehouse`
  - `shipped`
  - `completed`
  - `cancelled`
- payment status:
  - `not_paid`
  - `partial`
  - `paid`
- item fulfillment mode:
  - `unassigned`
  - `warehouse`
  - `production`
- priority is legacy, but current logic separates:
  - `urgency`
  - `isDemandingClient`

This split matters throughout the UI and backend. Do not assume `priority` alone is the modern source of truth.

## 4.3 Orders List

Main file:

- `src/pages/workzone/chapan/orders/ChapanOrders.tsx`

Major behaviors:

- loads up to 200 active orders
- supports search, status filter, payment filter, manager filter, calendar filter
- persists view mode and grouping mode in local storage
- supports grid and list presentations
- supports grouping similar orders into batches using item signature + close due dates
- flags urgent orders to the top
- overlays warehouse state badges using:
  - `useOrderWarehouseStates`
  - `useProductsAvailability`
- surfaces unpaid alerts from `useUnpaidAlerts`
- supports "trash" action for users with high permissions
- has internal seed helper to create example orders from the UI

Selection/open behavior:

- list page uses `selectedOrderId`
- drawer/detail navigation exists through `OrderDetailDrawer`
- comments note an earlier auto-redirect loop was intentionally removed

## 4.4 New/Edit Order

Main files:

- `src/pages/workzone/chapan/orders/ChapanNewOrder.tsx`
- `src/pages/workzone/chapan/orders/ChapanEditOrder.tsx`

These pages build and submit `CreateOrderDto` / `UpdateOrderDto`.

Expected order content:

- client identity and phones
- urgency and demanding-client flag
- address, city, postal code, delivery type, source
- pricing and discount fields
- payment method and prepayment
- one or more order items

The form ecosystem uses:

- `react-hook-form`
- Zod validation
- shared helper hook `useChapanOrderDraft`

## 4.5 Order Detail

Main file:

- `src/pages/workzone/chapan/orders/ChapanOrderDetail.tsx`

This page is the operational control center for a single order.

It supports:

- viewing core order meta
- item-by-item route resolution (`warehouse` vs `production`)
- status change
- adding payments
- adding comments/activities
- archive/restore
- cancel/restore
- close order, including unpaid warning
- invoice download
- requires-invoice toggle
- "transfer to warehouse" logic
- route a single item after confirmation
- attach files
- delete attachments
- reassign manager
- view and create returns

Important internal logic:

- per-item routing is resolved from either explicit `fulfillmentMode` or inferred from production tasks / terminal statuses
- warehouse items and production items are displayed as separate sections
- order detail behaves differently depending on URL origin:
  - orders
  - ready
  - archive
  - warehouse

## 4.6 Production Board

Main file:

- `src/pages/workzone/chapan/production/ChapanProduction.tsx`

Modes:

- `ProductionMode = 'manager' | 'workshop'`
- `LayoutMode = 'kanban' | 'list'` — persisted per user in localStorage (`chapan_prod_layout_{userId}`)

Behavior:

- auto-defaults workshop users into workshop mode if their permissions are limited
- loads either:
  - full manager production list
  - workshop-safe task list without client PII
- supports grouping similar tasks into task batches
- search by order number/product/fabric/size
- layout modes:
  - **kanban**: two-column board (Новые заказы / Выполнение)
  - **list**: vertical collapsible sections (Выполнение / Новые заказы)
- columns/sections:
  - `queued` (Новые заказы)
  - `in_progress` (Выполнение)
- task actions:
  - claim
  - mark done
  - return to queue
  - block/unblock
- shows change request alerts from managers and supports approve/reject flows
- workshop-mode cards now display `TaskDetailPanel` inline (always expanded; no toggle button)

Components:

- **`TaskCard`** — kanban card (compact header + meta + actions + detail panel in workshop mode)
- **`BatchTaskCard`** — grouped kanban card with expand/collapse
- **`TaskListCard`** — horizontal list-view card (fields in row, vertical action button)
- **`CollapsibleSection`** — wraps task groups in list view; expand/collapse via chevron
- **`ProductionListView`** — top-level list layout with two collapsible sections
- **`TaskDetailPanel`** — detail grid (item fields, notes, order info, defects)

Frontend production status model is currently simplified to:

- `queued`
- `in_progress`
- `done`

This is more up to date than older docs that describe a more granular cutting/sewing pipeline.

## 4.7 Ready Queue

Main file:

- `src/pages/workzone/chapan/ready/ChapanReady.tsx`

Purpose:

- bridge between production and warehouse
- batch actions for ready and partially ready orders
- invoice preview/create flow
- warehouse handoff
- unpaid warnings and manager notifications

Key behaviors:

- combines:
  - `ready` orders
  - partially completed `confirmed` / `in_production` orders that have warehouse-eligible items
- supports grouping and bulk selection
- blocks transfer if:
  - any item is still unrouted
  - production tasks are still unfinished
- if any selected order requires invoice:
  - generates invoice and opens pending invoice drawer
- if invoice is not required:
  - advances order directly and archives it

## 4.8 Invoices

Main files:

- `src/pages/workzone/chapan/invoices/ChapanInvoices.tsx`
- `src/pages/workzone/chapan/invoices/ChapanInvoicesDrawer.tsx`
- `src/pages/workzone/chapan/invoices/ChapanInvoicePreviewModal.tsx`

Responsibilities:

- filter invoice list by status
- show seamstress/warehouse confirmation state
- download invoice XLSX
- confirm from seamstress side
- confirm from warehouse side
- reject with reason
- show stale invoices where one side confirmed long ago and the other did not

Status values:

- `pending_confirmation`
- `confirmed`
- `rejected`
- `archived`

## 4.9 Chapan Warehouse

Main file:

- `src/pages/workzone/chapan/warehouse/ChapanWarehouse.tsx`

This is a very large hybrid page. It is not just inventory CRUD.

Tabs:

- incoming invoices
- invoice archive
- warehouse orders
- to ship
- shipped
- items
- movements
- alerts
- catalog

Capabilities on this page include:

- warehouse acceptance of invoices
- order shipment
- close order from warehouse
- return order back to ready with reason
- inventory item CRUD
- movement creation
- opening balance import
- CSV export
- alert resolution
- embedding the generic `WarehouseCatalog`
- showing "Warehouse Foundation" site health/control tower summaries and deep links

This page is where old/simple warehouse UX and the newer warehouse foundation stack meet.

## 4.10 Archive, Trash, Returns, Settings

Other Chapan pages:

- `archive/ChapanArchive.tsx`: archived historical orders
- `orders/ChapanTrash.tsx`: soft-deleted orders with restore/permanent delete
- `returns/ChapanReturns.tsx`: return records
- `settings/ChapanSettings.tsx`: catalogs, profile, clients, account settings

### `ChapanSettings.tsx`

Tabs:

- catalogs
- profile
- clients
- account

Highlights:

- catalogs manage:
  - products
  - colors/fabric catalog
  - sizes
  - workers
  - payment methods
- profile manages:
  - display name
  - order prefix
  - public intake enabled
  - delivery fees
- account tab allows:
  - password change for all users
  - email change only for owner/full-access users

## 4.11 Public Request Page

Main files:

- `src/pages/workzone-request/index.tsx`
- `src/pages/workzone-request/chapanApi.ts`

Behavior:

- client-facing intake form
- loads profile and catalogs from backend
- submits public-style workshop requests
- includes polished branded UI and success video flow

Caveat:

- the API helper currently calls authenticated endpoints (`/chapan/settings/profile`, `/chapan/settings/catalogs`, `/chapan/requests`) instead of the explicitly public backend endpoints (`/chapan/requests/public/:orgId` and `/public/:orgId/profile`).
- This likely means the page is unfinished, internally used, or mismatched with backend public API design.

## 5. Warehouse Frontend

Warehouse exists in two layers.

## 5.1 Classic Warehouse UI

Main files:

- `src/pages/warehouse/index.tsx`
- `src/pages/warehouse/WarehouseCatalog.tsx`

This covers:

- stock summary
- items
- categories
- locations
- movements
- BOM/product availability flows
- alerts

## 5.2 Warehouse Foundation / Twin / Operations / Control Tower

Main files:

- `src/pages/warehouse/Twin.tsx`
- `src/pages/warehouse/Operations.tsx`
- `src/pages/warehouse/ControlTower.tsx`
- `src/pages/warehouse/WarehouseTwinSpatialCanvas.tsx`
- `src/pages/warehouse/WarehouseTwinPanel.tsx`
- `src/pages/warehouse/WarehouseTwinTimelineModal.tsx`
- `src/pages/warehouse/WarehouseTwinPublishReviewModal.tsx`

This newer subsystem exposes:

- sites / zones / bins
- layout drafts and publishing
- live feed
- reservation state
- task timelines
- exception timelines
- assignee pools
- control-tower health snapshots
- layout compare and rollback
- SLA escalation hooks

The frontend API surface for this is very large and centered in:

- `src/entities/warehouse/queries.ts`
- `src/entities/warehouse/api.ts`
- `src/entities/warehouse/live.ts`

## 5.3 Live Sync

There are dedicated SSE hooks:

- `useOrderWarehouseLiveSync(orderId)`
- `useWarehouseFoundationLiveSync(siteId)`

They subscribe to:

- `/warehouse-live/order-stream`
- `/warehouse-live/site-stream`

and patch React Query caches directly.

## 6. Backend Architecture

## 6.1 App Factory

`server/src/app.ts` builds the Fastify app.

Registered global plugins:

- compression
- CORS with normalized allowed origins
- rate limit
- sensible
- multipart
- auth plugin
- org-scope plugin

Error handling:

- custom `AppError` hierarchy
- `ZodError` to `400 VALIDATION`
- Fastify validation errors to `400 VALIDATION`
- generic fallback to `500 INTERNAL`

Route prefix convention:

- API lives under `/api/v1`
- health endpoints exist at:
  - `/api/v1/health`
  - `/health`
  - `/healthz`

## 6.2 Backend Startup

`server/src/index.ts`:

- connects Prisma
- builds app
- listens on configured host/port
- attaches chat websocket at `/api/v1/ws/chat`
- injects chat event emitter into chat service
- starts warehouse outbox worker
- handles graceful shutdown

## 6.3 Configuration

`server/src/config.ts` validates env with Zod.

Important env vars:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `PORT`
- `HOST`
- `CORS_ORIGIN`
- `CONSOLE_SERVICE_PASSWORD`
- optional Google Sheets vars
- upload size limit
- optional Cloudflare R2 vars

## 6.4 Auth and Org Scope Plugins

### `server/src/plugins/auth.ts`

Decorates request with:

- `userId`
- `userEmail`
- `userFullName`

Exposes:

- `authenticate`
- `optionalAuth`

### `server/src/plugins/org-scope.ts`

Resolves org context after auth.

Behavior:

- honors `X-Org-Id` if the user is actively a member of that org
- otherwise falls back to the most recently joined active membership
- blocks dismissed employees from org-scoped access
- sets:
  - `request.orgId`
  - `request.orgRole`
  - `request.userFullName`

Also exposes `requireRole(...)`.

## 7. Backend Module Inventory

## 7.1 Identity / Access / Org Modules

- `auth`: login, set-password, company registration, employee registration endpoint placeholder, forgot/reset password, refresh, bootstrap, change password, employee lookup
- `users`: current user profile, team, role changes, activation/deactivation, email change
- `orgs`: get/update organization, company search
- `memberships`: membership requests, invite management, invite acceptance
- `employees`: admin-managed employee lifecycle
- `ownership`: org ownership transfer
- `service`: password-gated service access and org cleaning

Important note:

- `service/access` can bootstrap and impersonate an owner using the service password.
- `service/clean-org` deletes major org data sets in bulk. This is a destructive admin endpoint.

## 7.2 CRM Modules

- `customers`: customer list/detail/create/update, related deals/tasks/activities
- `leads`: list/detail/create/update, history, checklist
- `deals`: list, board, detail, activities, create/update/delete
- `tasks`: list/detail/create/update/status/subtasks/activities/delete

These modules follow a conventional pattern:

- `*.routes.ts`: HTTP/zod/request layer
- `*.service.ts`: business logic + Prisma

## 7.3 Frontend Compatibility Layer

Module:

- `server/src/modules/frontend-compat/*`

Purpose:

- serves older frontend contracts or placeholder endpoints for:
  - notifications
  - dashboard
  - summary
  - feed
  - audit
  - pipelines
  - exchange rates
  - AI chat
  - custom fields
  - search
  - `/sse/`

This exists to preserve frontend expectations even where the backend domain model has changed.

## 7.4 Chat

Files:

- `chat.routes.ts`
- `chat.service.ts`
- `chat.ws.ts`

Capabilities:

- list/create conversations
- list/send messages
- mark conversation read
- broadcast user-targeted websocket events

WebSocket transport is attached manually in `server/src/index.ts`.

## 7.5 Accounting

Files:

- `accounting.service.ts`
- `accounting.routes.ts`
- `accounting.sync.ts`
- `accounting.hash.ts`

Capabilities:

- create/list entries
- summaries
- PnL
- cash flow
- inventory value
- debts
- gap detection
- reconciliation
- integrity verification
- export

The sync layer listens to domain events and syncs:

- Chapan payments
- won deals
- warehouse movements

It uses chained hashes for integrity verification.

## 7.6 Imports Utility Layer

There is also a non-trivial import subsystem under `server/src/modules/imports/`, even though it is not registered in `server/src/app.ts` in the current snapshot.

Subareas:

- `scanner/file.scanner.ts`: parses XLSX/CSV, finds header rows, samples rows, classifies columns, detects likely import target, and returns preview payloads
- `scanner/semantic.matcher.ts`: maps human column names to domain fields and detects targets such as customers, leads, orders, catalog, warehouse items/stock, accounting, and employees
- `adapters/orders.adapter.ts`: imports grouped order rows into Chapan client/order/order-item records and triggers accounting sync on imported payments
- `adapters/warehouse.adapter.ts`: imports warehouse items, stock-like quantities, and catalog-like product definitions; it can also create Chapan catalog primitives
- `templates/templates.service.ts`: CRUD plus "similar template" lookup for saved import mappings

Important nuance:

- the frontend import wizard expects `/imports/*` endpoints
- `server/src/app.ts` does not register an imports router in the current snapshot
- this should be treated as an incomplete or disconnected subsystem until route wiring is confirmed

## 8. Chapan Backend Internals

Chapan backend lives in `server/src/modules/chapan/`.

This is the operational backbone of the system.

## 8.1 Orders

Files:

- `orders.routes.ts`
- `orders.service.ts`
- `status-validator.ts`
- `workflow.ts`

Routes cover:

- list
- warehouse states
- detail
- create
- update
- restore
- archive
- close
- fulfill from stock
- bulk route items
- confirm
- status change
- add payment
- transfer initiate/confirm
- invoice download
- batch invoice
- ship
- add activity
- set requires invoice
- return to ready
- route single item
- request/approve/reject change request
- trash
- restore from trash
- permanent delete
- list trash
- list org managers
- reassign manager

Service responsibilities in `orders.service.ts` include:

- generating order numbers and creating orders
- determining item routing and warehouse side effects
- confirming orders
- updating status with validation
- payment bookkeeping
- warehouse reservation consumption
- transfer lifecycle
- archive/restore/close/ship
- activity log creation
- change request workflow
- trash lifecycle
- manager reassignment
- org manager lookup

Important reality:

- `orders.service.ts` imports warehouse orchestration concepts directly. Chapan orders are deeply coupled to warehouse reservations and handoff/shipment documents.

## 8.2 Production

Files:

- `production.routes.ts`
- `production.service.ts`

Capabilities:

- list tasks
- list workshop-safe tasks
- move status
- claim
- assign worker
- flag/unflag
- set defect
- auto-sync order status from task state

`workflow.ts` contains shared derivation helpers such as:

- normalize production status
- label mapping
- deriving order status from task statuses

## 8.3 Invoices

Files:

- `invoices.routes.ts`
- `invoices.service.ts`
- `invoice.service.ts`
- `invoice-document.ts`
- `invoice-number.ts`
- `z2-invoice-template.service.ts`
- `documents.service.ts` and `documents.routes.ts`

Capabilities:

- create invoice from one or more orders
- preview document payload
- update document payload
- confirm by seamstress
- confirm by warehouse
- reject
- archive
- download XLSX

Document-specific logic:

- invoice payload is structured data, not just a rendered file
- XLSX generation uses branded/default templates
- batch invoice generation exists
- invoice numbering is managed centrally

## 8.4 Returns

Files:

- `returns.routes.ts`
- `returns.service.ts`

Capabilities:

- list/detail
- create draft
- confirm
- delete draft

Confirmation side effects:

- warehouse is replenished
- order state is updated accordingly

## 8.5 Settings / Requests / Attachments / Alerts / Sheets

- `settings.routes.ts` / `settings.service.ts`: profile, catalogs, bank commission, clients
- `requests.routes.ts` / `requests.service.ts`: internal and public request intake
- `attachments.routes.ts` / `attachments.service.ts`: file upload/list/download/delete using R2-compatible object storage
- `alerts.routes.ts` / `alerts.service.ts`: unpaid alerts
- `sheets.sync.ts` and `sheets/row-builder.ts`: Google Sheets synchronization for orders

Public request endpoints really exist on the backend:

- `POST /api/v1/chapan/requests/public/:orgId`
- `GET /api/v1/chapan/requests/public/:orgId/profile`

## 9. Warehouse Backend Internals

Warehouse backend is the deepest technical subsystem in the repository.

Main files:

- `warehouse.service.ts`
- `warehouse-catalog.service.ts`
- `warehouse-foundation.service.ts`
- `warehouse-inventory-core.service.ts`
- `warehouse-runtime.service.ts`
- `warehouse-projections.service.ts`
- `warehouse-execution-engine.service.ts`
- `warehouse-order-orchestration.service.ts`
- `warehouse-operations.service.ts`
- `warehouse-outbox.worker.ts`

Mental model:

- `warehouse.service.ts`: classic inventory CRUD and simpler warehouse behaviors
- `warehouse-catalog.service.ts`: catalog definitions, product schemas, smart import
- `warehouse-foundation.service.ts`: sites, zones, bins, structure, foundation setup
- `warehouse-inventory-core.service.ts`: canonical stock ledger, receipts, transfers, reservations, consumption/release
- `warehouse-runtime.service.ts`: live task/exception runtime, layout drafts, publish/rollback, assignee pools, timelines
- `warehouse-projections.service.ts`: read models, snapshots, control tower, feed, outbox processing
- `warehouse-execution-engine.service.ts`: pool assignment, task creation/update, SLA escalation, route history
- `warehouse-order-orchestration.service.ts`: warehouse side effects bound to order transitions
- `warehouse-operations.service.ts`: operation documents such as handoffs and shipments

Live routes:

- `/api/v1/warehouse-live/site-stream`
- `/api/v1/warehouse-live/order-stream`

Background processing:

- `startWarehouseOutboxWorker()` continuously processes outbox records to refresh projections/read models

## 10. Database Model

The Prisma schema is large. Think in domains rather than raw table count.

## 10.1 Identity and Access

Key models:

- `User`
- `PasswordResetToken`
- `RefreshToken`
- `Organization`
- `Membership`
- `Invite`
- `MembershipRequest`

Important org fields:

- `mode`: `basic | advanced | industrial`
- extended legal/bank/shipping profile fields

Membership also stores employee-specific operational state:

- department
- employee permissions array
- employee account status
- who added the employee

## 10.2 CRM

Key models:

- `Customer`
- `Lead`
- `LeadHistory`
- `Deal`
- `DealActivity`
- `Task`
- task subtasks/activities are also present elsewhere in the schema

## 10.3 Chapan

Key models:

- `ChapanProfile`
- `ChapanClient`
- `ChapanOrder`
- `ChapanOrderItem`
- `ChapanProductionTask`
- `ChapanPayment`
- `ChapanTransfer`
- `ChapanActivity`
- `ChapanRequest`
- `ChapanRequestItem`
- `ChapanWorker`
- `ChapanCatalogProduct`
- `ChapanCatalogFabric`
- `ChapanCatalogSize`
- `ChapanCatalogPaymentMethod`
- `ChapanInvoice`
- invoice junction tables
- `ChapanReturn`
- return item tables
- change request tables
- attachment tables
- alert tables

## 10.4 Warehouse

Warehouse is split between classic inventory and foundation/runtime.

Representative models:

- items, categories, movements, reservations, lots
- sites, zones, aisles, racks, bins
- variants, ledger events, balances, reservation allocations
- tasks, exceptions, assignee pools, task events, exception events
- layout versions and layout nodes
- operation documents
- site/order read models
- outbox and projection inbox
- layout publish audit

## 10.5 Other Domains

- `AccountingEntry`
- `AccountingGap`
- `ImportTemplate`
- `Conversation`
- `ConversationParticipant`
- `Message`

## 11. Testing

## 11.1 Frontend Unit/Component Tests

Vitest is configured in `vite.config.ts`.

Frontend test coverage includes files such as:

- auth store tests
- workspace store tests
- command tests
- Chapan order tests
- financial/navigation/item-line tests
- product moment utilities

## 11.2 End-to-End Tests

Playwright config:

- starts backend on `8001`
- starts frontend on `4173`
- authenticates once in `globalSetup.ts`
- stores auth state under `tests/e2e/.auth/*`

Important suites in `tests/e2e/`:

- auth flows
- create flows
- edit lifecycle
- quick actions
- settings guards
- chapan warehouse smoke
- mock regression
- smoke

Global setup currently logs in using:

- `admin@kort.local`
- `demo1234`

## 11.3 Backend Tests

Backend uses Vitest and has focused tests under:

- `server/src/modules/chapan/__tests__/`

These cover areas like:

- orders service
- integration behavior
- sheets sync/parity

## 12. Build, Run, Deployment

## 12.1 Frontend

Scripts:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run test`
- `npm run test:e2e`

Vite specifics:

- alias `@ -> src`
- manual vendor chunk splitting
- proxy `/api` to backend
- Vitest configuration embedded in Vite config

## 12.2 Backend

Scripts:

- `pnpm run dev`
- `pnpm run build`
- `pnpm run start`
- `pnpm run db:migrate`
- `pnpm run db:seed`
- `pnpm run db:report`
- `pnpm run test`

## 12.3 Docker Compose

`docker-compose.yml` starts:

- PostgreSQL 16
- backend container on `8000`
- frontend container on `80`, exposed as host `5173`

## 12.4 Railway

- root `railway.toml`: frontend deployment
- `server/railway.toml`: backend deployment

Backend Railway start command:

- `npm run start:docker`

## 12.5 CI/CD Workflows

The project has 5 GitHub Actions workflows in `.github/workflows/`:

**test.yml**
- Runs on push/PR to main/develop
- Steps:
  - ESLint linting (frontend)
  - Backend tests (Vitest with PostgreSQL service)
  - Frontend unit tests
  - Build check
- Node 20 runtime
- pnpm 10 package manager

**deploy.yml**
- Deployment workflow
- Infrastructure-specific

**docker.yml**
- Docker image build and test

**performance.yml**
- Lighthouse performance testing

**security.yml**
- Security scanning

## 12.6 External Dependencies Summary

**Frontend key dependencies:**
- React 18, React Router 6, Vite 5, TypeScript 5.6
- TanStack React Query 5 (data fetching/caching)
- Zustand 4 (state management, persisted)
- React Hook Form + Zod (forms/validation)
- Axios (HTTP client)
- Framer Motion + GSAP (animations)
- Three.js + React Three Fiber (3D canvas)
- Recharts (charts)
- dnd-kit (drag and drop)
- Lucide React (icons)
- Sonner (toast notifications)
- date-fns (date utilities)
- Sentry (error tracking)
- Tailwind CSS 3 (via PostCSS, utility classes alongside CSS Modules)

**Backend key dependencies:**
- Fastify 5 (HTTP framework)
- Prisma 6 + PostgreSQL 16
- jsonwebtoken + bcryptjs (auth)
- AWS SDK v3 for S3 (Cloudflare R2 storage)
- googleapis (Google Sheets sync)
- exceljs (XLSX generation)
- papaparse (CSV parsing)
- nodemailer (email)
- ws (WebSocket)
- zod (validation)

## 13. Frontend Cross-Cutting Systems

## 13.1 Capabilities System

The capabilities system (`src/shared/hooks/useCapabilities.ts`) implements role-based feature access separate from employee permissions.

**Role-implied capabilities:**
- `owner`: all of the below
- `admin`: `integrations.manage`, `audit.read`, `team.manage`, `automations.manage`
- `manager`: none
- `viewer`: none

**Derived flags from capabilities:**
- `canManageBilling`
- `canManageIntegrations`
- `canViewAudit`
- `canManageTeam`
- `canRunAutomations`

**Important distinction:**
- Capabilities are coarse-grained role-based features
- Employee permissions are fine-grained checkbox-based module access (via `useEmployeePermissions`)
- Both layers must be satisfied for full feature access

## 13.2 Company Access State Machine

`src/shared/hooks/useCompanyAccess.ts` exposes a state machine for company membership:

**States:**
- `anonymous` → `no_company` → `pending` → `active` (or `rejected`)

This drives:
- `CompanyAccessGate.tsx` UI
- Routing behavior and access control

## 13.3 Internationalization (i18n) System

`src/shared/i18n/` provides a two-language system:

**Languages:**
- `ru` (Russian) -- primary, default
- `kk` (Kazakh)

**Implementation:**
- Zustand store persisted as `kort-locale`
- Not a full i18n framework; typed key-value lookup
- Access via `useT()` and `useI18n()` hooks
- Product-specific terminology in `src/shared/i18n/ru-product.ts`

## 13.4 Design Token System (CSS Custom Properties)

`src/shared/design/globals.css` implements a 3-layer design system using CSS custom properties.

**Layer 1 - Primitive tokens:**
- Color palette: `p-gray-0` through `p-gray-950`, accent, success, warning, danger, info

**Layer 2 - Semantic tokens (light theme):**
- **Background:** `--bg-canvas`, `--bg-surface`, `--bg-surface-elevated`, `--bg-surface-inset`, etc.
- **Text:** `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-placeholder`
- **Borders:** `--border-subtle`, `--border-default`, `--border-strong`, `--border-focus`
- **Fills:** `--fill-accent` (#9A4A1B -- warm copper), `--fill-positive`, `--fill-warning`, `--fill-negative`, `--fill-info`
- **Shadows:** `--shadow-xs` through `--shadow-xl`, `--shadow-focus`, `--shadow-accent`
- **Space:** `--space-page-x` (28px), `--space-page-y` (24px), `--space-page-max` (1160px)
- **Surface:** `--surface-radius`, `--surface-border`, `--surface-shadow-rest`
- **Composite:** `--toolbar-shell-bg`, `--selection-bar-bg`, `--drawer-footer-bg`, state backgrounds

**Dark theme:** Inverted colors in same file

**Typography:**
- Plus Jakarta Sans (primary)
- DM Sans (secondary)
- JetBrains Mono (code)

**CSS approach:** CSS Modules (`.module.css` files alongside components), not CSS-in-JS

## 13.5 Utility Functions and Libraries

### `src/shared/utils/`
- `format.ts` -- number/date formatting
- `itemLine.ts` -- order item line summary builder
- `kz.ts` -- Kazakhstan-specific utilities (phone formatting, BIN/IIN validation)
- `locale.ts` -- locale-aware formatting
- `person.ts` -- person name utilities
- `productMoment.ts` -- product moment calculations (with tests)

### `src/shared/lib/`
- `auth.ts` -- `resolveOnboardingCompleted()` helper
- `browser.ts` -- browser detection, chunk error recovery, redirect helper
- `chapanBranding.ts` -- Chapan branding utilities
- `chapanCatalogDefaults.ts` -- default catalog values
- `demoWorkspace.ts` -- demo workspace helpers
- `export.ts` -- CSV/data export utilities

## 14. Backend Core Library Layer

## 14.1 Core Libraries

Located in `server/src/lib/`:

**prisma.ts**
- Singleton PrismaClient
- `connect()` and `disconnect()` helpers

**jwt.ts**
- Three token types: `access`, `refresh`, `first_login`
- First-login tokens: 30-minute TTL, signed with access secret but discriminated by `type: 'first_login'`
- Token generation and verification

**errors.ts**
- AppError hierarchy:
  - `NotFoundError`
  - `UnauthorizedError`
  - `ForbiddenError`
  - `ConflictError`
  - `ValidationError`
- Error messages in Russian

**hash.ts**
- Password hashing (bcryptjs)

**email.ts**
- Email sending (nodemailer)

**pagination.ts**
- Pagination helpers

**r2.ts**
- Cloudflare R2 S3-compatible storage client
- Optional at boot; required for attachment runtime

## 14.2 Chapan Order Status Transition Graph

The backend `status-validator.ts` defines the exact state machine:

```
new          -> confirmed, cancelled
confirmed    -> in_production, on_warehouse, cancelled
in_production-> ready, cancelled
ready        -> transferred, on_warehouse, cancelled
transferred  -> on_warehouse, cancelled
on_warehouse -> shipped, ready, cancelled
shipped      -> completed, cancelled
completed    -> (none)
cancelled    -> ready
```

**Additional context rules:**
- `ready -> on_warehouse` requires warehouse items; if `requiresInvoice` is true, needs confirmed invoice
- `in_production -> ready` requires all production tasks completed

## 14.3 Idempotency in Order Creation

`orders.routes.ts` implements in-memory idempotency cache for POST `/chapan/orders`:

- **Key:** `${orgId}:${idempotencyKey}`
- **TTL:** 5 minutes
- **Sweep:** Every 50 requests
- **Purpose:** Prevents duplicate orders on network retry

## 14.4 Warehouse Outbox Worker Details

The outbox worker (`warehouse-outbox.worker.ts`):

- **Poll interval:** 4 seconds
- **Batch size:** up to 20 pending records per tick
- **Locking:** Optimistic locking (claim-then-process)
- **Backoff strategy:** Exponential backoff on failure: `min(5000 * 2^retry, 60000)` ms
- **Record states:** pending → processing → (done or back to pending with retry)

## 14.5 Google Sheets Integration

Optional Google Sheets sync for Chapan orders:

**Environment variables:**
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_SHEET_NAME`
- `GOOGLE_SHEETS_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

**Implementation:**
- `server/src/modules/chapan/sheets.sync.ts`
- `sheets/row-builder.ts`

Syncs Chapan order data to external Google Sheets.

## 15. Repository Structure and Build Configuration

## 15.1 tsconfig Exclusions

The `tsconfig.json` excludes many directories that still exist in the repo. Agents should NOT type-check these:

**Obsolete SPA layers:**
- `features/accounting-spa`
- `features/chapan-spa`
- `features/crm-spa`
- `features/warehouse-spa`

**Old workspace widget previews:**
- `features/workspace/widgets`

**Old page tree:**
- `pages/customers`
- `pages/deals`
- `pages/tasks`
- `pages/dashboard`
- `pages/audit`
- `pages/automations`
- `pages/feed`
- `pages/imports`
- `pages/workzone-request`

**Deleted widgets:**
- `widgets/ai-assistant`
- `widgets/daily-focus`
- (others)

**Important:** Files in these directories compile but are NOT type-checked. Treat them as legacy/inactive code.

## 15.2 Vite Build Chunking Strategy

`vite.config.ts` implements manual chunk splitting to optimize loading:

- `vendor-react` (react, react-dom, scheduler)
- `vendor-router` (react-router)
- `vendor-query` (@tanstack/*)
- `vendor-charts` (recharts, d3)
- `vendor-motion` (framer-motion, gsap)
- `vendor-three-core`, `vendor-three-examples`, `vendor-three-postprocessing`
- `vendor-icons` (lucide-react)
- `vendor-date` (date-fns)
- `vendor-forms` (react-hook-form, zod)
- `vendor-dnd` (dnd-kit)
- `vendor-state` (zustand, immer)
- `vendor-sentry`
- `vendor-utils` (axios, nanoid, sonner, clsx, etc.)

**Chunk size warning limit:** 550KB

## 15.3 Dev Access Bypass System

Frontend and backend implement a development bypass system for testing/demos.

**Frontend:**
- `src/shared/config/devAccess.ts`
- `src/console/devAccess.ts`
- When `DEV_AUTH_BYPASS_ENABLED` / `DEV_RUNTIME_BLOCKERS_DISABLED` are true:
  - `useRole()` returns owner
  - `useEmployeePermissions()` returns full access
  - `useCapabilities()` returns all capabilities
  - `useCompanyAccess()` returns active state

**Backend:**
- `server/src/modules/service/demo-access.ts`
- Password-gated service access at `/api/v1/service/access`

## 16. Seed Data and Demo Access

Current actual seed truth is in `server/prisma/seed.ts`.

Seeded records:

- one owner user:
  - `admin@kort.local`
  - phone `+77010000001`
  - password `demo1234`
- one pending-first-login warehouse employee:
  - phone `+77010000003`
  - password initially hashed from phone
- one industrial organization `workspace`
- default Chapan profile
- starter Chapan catalogs
- one sample CRM customer

Important warning:

- `server/ARCHITECTURE.md` still mentions multiple demo accounts (`manager@...`, `viewer@...`, etc.). That is stale relative to the current seed file.

Dev/service access:

- `/api/v1/service/access` can mint an owner session if `CONSOLE_SERVICE_PASSWORD` is known
- this can bootstrap a demo owner if the database is empty

## 17. Known Mismatches, Legacy Areas, and Cautions

These are the most important "do not assume" notes for future agents.

1. Code is fresher than docs.
2. Some repository text output shows mojibake/encoding artifacts; there are repair scripts like `fix-mojibake.cjs`.
3. The frontend still contains legacy mock helpers, but the active app path uses the real backend.
4. `workzone/request` looks partially disconnected:
   - page exists
   - widgets open it
   - intro logic knows about it
   - router does not register it
   - API helper uses authenticated endpoints instead of backend public endpoints
5. Chapan production status model in current frontend/backend usage is simplified compared to some old docs.
6. Chapan and warehouse are tightly coupled. Order changes can create or consume warehouse reservations/documents.
7. Employee permissions matter as much as org role. A `manager` is not automatically omnipotent.
8. `selectedOrgId` affects backend scoping via `X-Org-Id`; do not ignore multi-org behavior.
9. `service/clean-org` is destructive.
10. There is a real background worker in backend startup; warehouse state is not purely request/response.
11. The repo contains several substantial page modules (`feed`, `audit`, `automations`, `imports`, `launch`, `dashboard`) that should be checked for actual router reachability instead of being assumed active just because the files exist.
12. The imports feature is especially mismatch-prone: frontend has a working wizard shape, backend has scanner/adapters/templates code, but `server/src/app.ts` does not register imports routes in the current snapshot.

## 18. Practical Navigation Guide for Future Agents

If the task is about:

- login/session/org switching: start in `src/shared/stores/auth.ts`, `src/shared/api/client.ts`, `server/src/modules/auth/*`, `server/src/plugins/*`
- route access bugs: start in `src/app/router/index.tsx`, `usePlan`, `useEmployeePermissions`, `useChapanPermissions`
- workspace/canvas behavior: start in `src/pages/canvas/index.tsx`, `src/features/workspace/model/store.ts`, `src/features/workspace/components/*`
- Chapan order lifecycle: start in `src/entities/order/*`, `src/pages/workzone/chapan/orders/*`, `server/src/modules/chapan/orders.*`
- Chapan production: start in `src/pages/workzone/chapan/production/*`, `server/src/modules/chapan/production.*`
- invoices: start in `src/pages/workzone/chapan/invoices/*`, `server/src/modules/chapan/invoices.*`, `invoice*.ts`
- returns: start in `src/pages/workzone/chapan/returns/*`, `server/src/modules/chapan/returns.*`
- Chapan settings/catalogs/profile: start in `src/pages/workzone/chapan/settings/*`, `server/src/modules/chapan/settings.*`
- warehouse classic inventory: start in `src/pages/warehouse/index.tsx`, `src/entities/warehouse/*`, `server/src/modules/warehouse/warehouse.service.ts`
- warehouse foundation/twin/runtime: start in `src/pages/warehouse/Twin.tsx`, `ControlTower.tsx`, `Operations.tsx`, `src/entities/warehouse/queries.ts`, `server/src/modules/warehouse/*foundation*`, `*runtime*`, `*projections*`, `*execution-engine*`
- accounting: start in `src/entities/finance/*`, `src/pages/finance/index.tsx`, `server/src/modules/accounting/*`
- settings / org profile / company access: start in `src/pages/settings/index.tsx`, `src/entities/employee/*`, `server/src/modules/orgs/*`, `server/src/modules/employees/*`, `server/src/modules/users/*`
- employee lifecycle: start in `src/pages/employees/index.tsx`, `src/entities/employee/*`, `server/src/modules/employees/*`
- reports/documents/feed/audit/automations: inspect the page file directly first; these are thinner verticals and some rely on compatibility endpoints or partial product scaffolding
- chat: start in `src/features/chat/*`, `src/shared/stores/chat.ts`, `server/src/modules/chat/*`
- console/dev access: start in `src/console/*`, `src/pages/dev/index.tsx`, `server/src/modules/service/*`
- public/workzone request intake: inspect `src/pages/workzone-request/*` and compare it carefully against `server/src/modules/chapan/requests.*`
- imports: compare `src/pages/imports/index.tsx` with `server/src/modules/imports/*` and `server/src/app.ts` before assuming the API is actually wired
- capabilities / roles / permissions: check `src/shared/hooks/useCapabilities.ts`, `useRole()`, `useEmployeePermissions()` for the exact permission hierarchy
- i18n or language support: check `src/shared/i18n/` and `src/shared/hooks/useT.ts`
- design tokens or styling issues: check `src/shared/design/globals.css` for the 3-layer token system
- build/chunking issues: check `vite.config.ts` for manual chunk configuration
- outbox/warehouse async jobs: check `server/src/workers/warehouse-outbox.worker.ts` for polling/backoff behavior
- Google Sheets sync: check `server/src/modules/chapan/sheets.sync.ts` and environment variables
- order status transitions: check `server/src/modules/chapan/status-validator.ts` for exact state machine
- idempotency or retry safety: check `orders.routes.ts` for in-memory cache behavior
- CI/CD or deployment issues: check `.github/workflows/` for exact test/build steps and Node 20 / pnpm 10 requirements

## 19. Bottom Line

This repository is best understood as three overlapping systems:

- a CRM/admin product
- an atelier operations platform centered on `Chapan`
- an increasingly sophisticated warehouse execution platform

The most business-critical flow is:

- auth/bootstrap
- org/permission gating
- Chapan orders
- production completion
- invoice confirmation
- warehouse handoff/shipment
- accounting and audit trail side effects

The most technically complex flow is:

- warehouse foundation
- live streams
- outbox projections
- reservation/task/exception/runtime orchestration

When in doubt, follow the chain:

- frontend page
- entity query hook
- entity API client
- backend route
- backend service
- Prisma model(s)

That chain is consistent across most of the codebase.
