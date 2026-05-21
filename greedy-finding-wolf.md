# План масштабного рефакторинга: расшивка модуля Чапан по всему KORT

## Context

В проекте KORT-TESTING-FRONTEND есть изолированный модуль "Чапан" в [src/features/auth/pages/workzone/chapan/](src/features/auth/pages/workzone/chapan/) (фронт) и [server/src/modules/chapan/](server/src/modules/chapan/) (бэк), внутри которых построена практически полная ERP: заказы, производство, склад, накладные, аналитика, клиенты, закуп, возвраты, доставка, Kaspi-интеграция, мониторинг.

Чапан был первым клиентом и использовался как песочница. Сейчас этот клиент отключён, бизнес-данные тестовые.

**Цель рефакторинга:**
1. Разнести все наработки Чапана по соответствующим разделам KORT верхнего уровня (Sales, Warehouse, Production, Logistics, Products, Documents, Reports, CRM).
2. Полностью удалить `workzone/chapan/` (фронт) и `modules/chapan/` (бэк) как отдельные подсистемы.
3. Глобально переработать систему прав — модель `scope.action` (`orders.read`, `warehouse.manage` и т. д.), матричный UI редактирования.
4. **Сохранить** раздел "Кабинеты" в сайдбаре как пустую секцию-заглушку под будущих клиентов.

Делается одним заходом, без поэтапной миграции (старого клиента на проде нет).

---

## Часть I — Слепок текущего состояния

### 1. Расположение Чапана (фронт)

```
src/features/auth/pages/workzone/chapan/
├── ChapanShell.tsx                    # отдельный layout (свой сайдбар + топбар + drawer + swipe-back)
├── analytics/    → ChapanAnalytics    (дашборды, графики recharts)
├── archive/      → ChapanArchive      (завершённые заказы)
├── catalog/      → ChapanCatalog      (admin: каталог товаров, поля, фото, импорт)
├── clients/      → ChapanClients, ChapanClientDetail
├── invoices/     → ChapanInvoices, ChapanInvoicesDrawer, ChapanInvoicePreviewModal
├── kaspi-orders/ → ChapanKaspiOrders, ChapanKaspiOrderDetail, ChapanKaspiStagePage, ChapanKaspiStockPage, kaspi-view-model
├── orders/       → ChapanOrders, ChapanOrderDetail, ChapanNewOrder, ChapanEditOrder, ChapanTrash, OrderDetailDrawer (+7 тестов)
├── production/   → ChapanProduction, WorkshopTaskCard, WorkshopCardView, workshopSort
├── purchase/     → ChapanPurchase, ManualInvoiceForm, PurchaseInvoicePreviewModal, catalog.ts (+ тесты)
├── ready/        → ChapanReady
├── returns/      → ChapanReturns
├── settings/     → ChapanSettings (4 таба + тест)
├── shipping/     → ChapanShipping
└── warehouse/    → WarehouseCatalog, WarehouseHeader, AddItemDrawer, ItemDetailDrawer, ChapanOrderDetailModal,
                     SetBeginningBalanceModal, WarehouseStats, warehouseGrouping, exportWarehouse
```

Дополнительно (фронт):
- [src/features/chapan-monitor/](src/features/chapan-monitor/) — Widget, Drawer, Dashboard, Alerts, Guide, useChapanMonitor, chapanMonitor.utils
- [src/features/workzone/chapan/store.ts](src/features/workzone/chapan/store.ts) — Zustand UI-стор Чапана (Invoices Drawer state)
- [src/shared/lib/chapanBranding.ts](src/shared/lib/chapanBranding.ts), [chapanCatalogDefaults.ts](src/shared/lib/chapanCatalogDefaults.ts), [chapanFinancials.ts](src/shared/lib/chapanFinancials.ts)

### 2. Расположение Чапана (бэк) — `server/`

Технологии: Fastify v5 + TypeScript + Prisma v6 + PostgreSQL + JWT + S3 + Zod + Vitest.

`server/src/modules/chapan/` — **43 файла**:
- 11 `*.routes.ts`: orders, attachments, production, requests, settings, invoices, returns, alerts, analytics, purchase, clients (+documents)
- 12 `*.service.ts` (параллельно роутам)
- утилиты: `types.ts`, `financials.ts`, `invoice-document.ts`, `invoice-number.ts`, `order-item-number.ts`, `profile-defaults.ts`, `sheets.sync.ts`, `sheets/row-builder.ts`, `status-validator.ts`, `workflow.ts`, `z2-invoice-template.service.ts`
- 6 тестов: orders.integration, orders.service, purchase.routes, purchase.service, sheets.full-parity, sheets.sync

URL-префикс — `/api/v1/chapan/*` (регистрация в [server/src/app.ts](server/src/app.ts#L177)).

### 3. Prisma модели (23 Chapan-моделей)

ChapanProfile, ChapanWorker, ChapanCatalogProduct, ChapanCatalogSize, ChapanCatalogPaymentMethod, ChapanClient, ChapanRequest, ChapanRequestItem, ChapanOrder, ChapanOrderItem, ChapanProductionTask, ChapanChangeRequest, ChapanOrderAttachment, ChapanPayment, ChapanTransfer, ChapanActivity, ChapanUnpaidAlert, ChapanInvoice, ChapanInvoiceOrder, ChapanReturn, ChapanReturnItem, ChapanManualInvoice, ChapanManualInvoiceItem.

**Существующие НЕ-Chapan модели в [server/prisma/schema.prisma](server/prisma/schema.prisma):**
- Без префикса свободны: `Order`, `Invoice`, `ProductionTask`, `Payment`, `Worker` → имена доступны после rename.
- **Конфликты для слияния:**
  - `Customer` (CRM, line 429) ← сюда вливается `ChapanClient`
  - `WarehouseProductCatalog` (line 1336) ↔ `ChapanCatalogProduct` (line 654) — обе системы каталога. Нужно сличить и смержить (вероятно, Warehouse-версия — основная инфраструктура, а Chapan-версия её отражение).
  - `WarehouseItem`, `WarehouseMovement`, `WarehouseReservation`, `WarehouseTransitEntry`, `WarehouseFieldDefinition`, `WarehouseFieldOption`, `WarehouseProductPhoto`, `WarehouseProductField` — богатая warehouse-инфраструктура уже есть; Chapan-warehouse фронт по решению C4 становится "настоящим" складом, надо проверить, что бэк-модели не дублируются.

### 4. Роутер и Shell'ы (фронт)

[src/app/router/index.tsx](src/app/router/index.tsx):
- **AppShell** (KORT core) → `/`, `/crm/*`, `/warehouse`, `/production`, `/finance`, `/employees`, `/reports`, `/documents`, `/settings`. Файлы: [AppShell.tsx](src/app/layout/AppShell.tsx), [Sidebar.tsx](src/app/layout/Sidebar.tsx), [Topbar.tsx](src/app/layout/Topbar.tsx).
- **ChapanShell** → `/workzone/chapan/*`. Свой сайдбар с правами, свой топбар, ChapanInvoicesDrawer, ChapanMonitorWidget, iOS swipe-back.
- `/warehouse/:id` уже редиректит на `ChapanOrderDetailPage` — фактическое пересечение существует.

### 5. Сайдбар и "Кабинеты"

[src/app/layout/Sidebar.tsx](src/app/layout/Sidebar.tsx) — секция "Кабинеты" появляется при `planIncludes(plan, 'industrial')`. Единственный пункт `CHAPAN_NAV_ITEM` из [src/shared/navigation/appNavigation.ts](src/shared/navigation/appNavigation.ts) → `/workzone/chapan`.

Базовый каркас сайдбара: Канвас `/`, CRM (Leads/Deals/Customers/Tasks), Операции (Warehouse/Production/Finance/Employees), Аналитика (Reports/Documents), Кабинеты (Чапан), Настройки.

### 6. Система прав — как сейчас

**Фронт** ([src/entities/employee/types.ts](src/entities/employee/types.ts)) — enum `EmployeePermission`:
- Базовые (6): `full_access`, `financial_report`, `sales`, `production`, `warehouse_manager`, `observer`.
- Чапановские (10): `chapan_full_access`, `chapan_access_orders`, `chapan_access_production`, `chapan_access_ready`, `chapan_access_archive`, `chapan_access_warehouse_nav`, `chapan_manage_production`, `chapan_confirm_invoice`, `chapan_warehouse_operator`, `chapan_manage_settings`.

**Роли** (`Membership.role`): `owner | admin | manager | viewer`. Owner также определяется флагом `User.is_owner`.

**Хуки**: [useEmployeePermissions](src/shared/hooks/useEmployeePermissions.ts), [useChapanPermissions](src/shared/hooks/useChapanPermissions.ts), [useRole](src/shared/hooks/useRole.ts).

**Enforcement (фронт)**: `<RequirePermission check="…">` в роутере; `navItems.filter(…)` в ChapanShell; условный рендер кнопок в компонентах.

**UI редактирования**: [src/features/auth/pages/settings/index.tsx](src/features/auth/pages/settings/index.tsx) — секция "Компания и доступ", AddEmpDrawer/EditEmpDrawer, две группы чекбоксов BASE_PERMISSIONS + CHAPAN_PERMISSIONS.

**Бэк**: `Membership.employeePermissions` (`String[]`). Enforcement: [auth.ts](server/src/plugins/auth.ts) (Bearer), [org-scope.ts](server/src/plugins/org-scope.ts) (`requireRole`), capability-маппинг в [auth.service.ts:buildCapabilities](server/src/modules/auth/auth.service.ts). Конкретные проверки прав — внутри route-handler'ов (например, `FULL_CHAPAN_ORDER_ACCESS_PERMISSIONS` Set в [orders.routes.ts:16](server/src/modules/chapan/orders.routes.ts#L16)).

API: `/company/employees` CRUD, права в payload массивом строк.

### 7. Зависимости извне на Chapan-код (фронт)

- [src/app/router/index.tsx](src/app/router/index.tsx) — импорт `ChapanShell`, `ChapanKaspiStagePage`, `ChapanKaspiStockPage`
- [src/features/auth/pages/documents/InvoiceModal.tsx](src/features/auth/pages/documents/InvoiceModal.tsx), [reports/index.tsx](src/features/auth/pages/reports/index.tsx) — `calculateChapanOrderFinancials`
- [src/shared/ui/ThemeSwitcher.tsx](src/shared/ui/ThemeSwitcher.tsx) — упоминание `--ch-*` CSS-переменных

### 8. Миграции Prisma

Система: Prisma Migrate. ~20+ миграций с префиксом `chapan_*` в [server/prisma/migrations/](server/prisma/migrations/). По решению H1 — данные тестовые, делаем `drop & recreate` через новые миграции.

---

## Часть II — Опросник и принятые решения

### Пакет A — Стратегия рефакторинга ✅
- [x] A1. **Не поэтапно**, миграция одним заходом — старый клиент отключён.
- [x] A2. **Полное переименование в нейтральные имена** (ChapanOrders → Orders, ChapanInvoice → Invoice и т. д.) — везде: компоненты, файлы, типы, CSS-классы, Prisma-модели, эндпоинты.
- [x] A3. **ChapanShell удаляем сразу** — все страницы переезжают в AppShell.
- [x] A4. **Тесты переносим вместе с компонентами и переименовываем**.

### Пакет B — Карта переноса: заказы ✅
- [x] B1. **Orders** → новый верхнеуровневый раздел `/sales` (Продажи). Маршруты: `/sales`, `/sales/new`, `/sales/:id`, `/sales/:id/edit`.
- [x] B2. **Kaspi-orders** → канал/вкладка внутри `/sales` (фильтр по источнику = Kaspi, sub-tabs под этапы).
- [x] B3. **Ready** → финальный этап в `/production`.
- [x] B4. **Archive** → вкладка "Завершённые" внутри `/sales`.

### Пакет C — Производство/логистика ✅
- [x] C1. **Production** — полностью заменяет текущий `/production`.
- [x] C2. **Invoices** → `/documents` (страница + глобальный Drawer, открывается из топбара).
- [x] C3. **Shipping** → новый раздел `/logistics`.
- [x] C4. **Warehouse** Чапана → заменяет текущий `/warehouse`.

### Пакет D — Справочники и финансы ✅
- [x] D1. **Catalog** → новый верхнеуровневый раздел `/products`.
- [x] D2. **Purchase** → `/warehouse/purchase`.
- [x] D3. **Returns** → вкладка в `/sales/returns`.
- [x] D4. **Analytics** → растворить в `/reports`.

### Пакет E — CRM, мониторинг, настройки модуля ✅
- [x] E1. **Clients** → слить с `/crm/customers` (ChapanClientDetail → профиль с вкладкой "Заказы").
- [x] E2. **chapan-monitor** → удалить полностью.
- [x] E3. **ChapanSettings** табы разнести: размеры/оплата → `/products`, скидки → `/sales`, работники → `/employees`. Профиль и аккаунт растворить в `/settings`.
- [x] E4. **shared/lib** переименовать: `chapanBranding` → `companyBranding`, `chapanCatalogDefaults` → `productCatalogDefaults`, `chapanFinancials` → `orderFinancials`.

### Пакет F — Система прав ✅
- [x] F1. Модель — **scope.action** (`orders.read`, `warehouse.manage`).
- [x] F2. **Удалить все 10 chapan_* прав**, бэк тоже выбрасывает.
- [x] F3. **UI — матрица модуль × действие** (строки = модули, колонки = read/edit/admin).
- [x] F4. **Убрать роли вообще**. Остаётся только `User.is_owner` + массив прав. Право `company.admin` заменяет роль admin.

### Пакет G — Кабинеты, навигация, бэк ✅
- [x] G1. **"Кабинеты"** остаются в сайдбаре с placeholder-заглушкой "Пока пусто".
- [x] G2. **Роуты `/workzone/chapan/*` удаляем**. Catch-all `/workzone/*` → редирект на `/`.
- [x] G3. **Брендирование удалить** — display name, order prefix, descriptor больше не нужны.
- [x] G4. **Бэкенд тоже обновляем** одним заходом — папка `server/` в этом же репозитории.

### Пакет H — Бэк-специфика ✅
- [x] H1. **Drop & recreate** — данные тестовые, дата-миграции не нужны.
- [x] H2. **URL-префикс** — переименовать по доменам: `/api/v1/orders`, `/api/v1/invoices`, `/api/v1/production`, `/api/v1/warehouse`, `/api/v1/products`, …
- [x] H3. Конфликты имён — проверил: `Order`, `Invoice`, `ProductionTask`, `Payment` свободны после rename. `Customer` существует — `ChapanClient` сливается в него. `WarehouseProductCatalog` существует — `ChapanCatalogProduct` мержим с ним при исполнении.
- [x] H4. **Бэк раскидать по сущностям**: `server/src/modules/orders/`, `/invoices/`, `/production/`, `/warehouse/` (уже есть), `/purchase/`, `/returns/`, `/customers/` (уже есть), `/products/`.

---

## Часть III — Финальная карта переноса

### A. Фронт: маппинг страниц

| Текущее место (Chapan) | Куда переезжает | Новое имя |
|---|---|---|
| `chapan/orders/ChapanOrders.tsx` | `src/features/auth/pages/sales/` | `OrdersPage.tsx` |
| `chapan/orders/ChapanOrderDetail.tsx` | `src/features/auth/pages/sales/` | `OrderDetailPage.tsx` |
| `chapan/orders/ChapanNewOrder.tsx` | `src/features/auth/pages/sales/` | `NewOrderPage.tsx` |
| `chapan/orders/ChapanEditOrder.tsx` | `src/features/auth/pages/sales/` | `EditOrderPage.tsx` |
| `chapan/orders/ChapanTrash.tsx` | `src/features/auth/pages/sales/` | `OrderTrashPage.tsx` (или таб) |
| `chapan/orders/OrderDetailDrawer.tsx` | `src/features/auth/pages/sales/` | `OrderDetailDrawer.tsx` |
| `chapan/orders/__tests__/*.test.ts` | `src/features/auth/pages/sales/__tests__/` | без `Chapan` префикса |
| `chapan/archive/ChapanArchive.tsx` | `src/features/auth/pages/sales/` | таб/фильтр `archive` в OrdersPage |
| `chapan/returns/ChapanReturns.tsx` | `src/features/auth/pages/sales/returns/` | `ReturnsPage.tsx` |
| `chapan/kaspi-orders/*` | `src/features/auth/pages/sales/channels/kaspi/` | каналы внутри sales |
| `chapan/ready/ChapanReady.tsx` | `src/features/auth/pages/production/` | вкладка `ReadyTab.tsx` в ProductionPage |
| `chapan/production/*` | `src/features/auth/pages/production/` | заменяет текущий ProductionPage целиком |
| `chapan/shipping/ChapanShipping.tsx` | `src/features/auth/pages/logistics/` | `LogisticsPage.tsx` (новый раздел) |
| `chapan/invoices/*` | `src/features/auth/pages/documents/` | `InvoicesTab.tsx` + `InvoicesDrawer.tsx` (глобальный) + `InvoicePreviewModal.tsx` |
| `chapan/warehouse/*` | `src/features/auth/pages/warehouse/` | заменяет текущий WarehousePage |
| `chapan/catalog/ChapanCatalog.tsx` | `src/features/auth/pages/products/` | `ProductsPage.tsx` (новый раздел) |
| `chapan/purchase/*` | `src/features/auth/pages/warehouse/purchase/` | `PurchasePage.tsx` под warehouse |
| `chapan/clients/*` | `src/features/auth/pages/crm/customers/` | объединить с существующим CRM Customers (добавить вкладку "Заказы" в детали клиента) |
| `chapan/analytics/ChapanAnalytics.tsx` | `src/features/auth/pages/reports/` | расширить ReportsPage графиками/KPI |
| `chapan/settings/ChapanSettings.tsx` | разнести: размеры/оплата → `/products`, скидки → `/sales/settings`, работники → `/employees`. Профиль/аккаунт → `/settings`. | удалить ChapanSettings как файл |

### B. Фронт: удалить полностью

| Файл/папка | Причина |
|---|---|
| [src/features/auth/pages/workzone/chapan/](src/features/auth/pages/workzone/chapan/) | весь модуль расшит |
| [src/features/auth/pages/workzone/](src/features/auth/pages/workzone/) | пустая папка |
| [src/features/chapan-monitor/](src/features/chapan-monitor/) | решение E2 |
| [src/features/workzone/chapan/](src/features/workzone/chapan/) | UI-стор Chapan (Invoices Drawer переносим в глобальный стор) |
| [src/shared/hooks/useChapanPermissions.ts](src/shared/hooks/useChapanPermissions.ts) | решение F2 |
| [src/shared/lib/chapanBranding.ts](src/shared/lib/chapanBranding.ts) | решение G3 (брендирование удалено) |

### C. Фронт: переименовать (rename + edit imports)

| Сейчас | Станет |
|---|---|
| [src/shared/lib/chapanCatalogDefaults.ts](src/shared/lib/chapanCatalogDefaults.ts) | `src/shared/lib/productCatalogDefaults.ts` |
| [src/shared/lib/chapanFinancials.ts](src/shared/lib/chapanFinancials.ts) | `src/shared/lib/orderFinancials.ts` (экспорты: `calculateOrderFinancials`, `getOrderBalance`) |
| `ChapanOrder` (тип в entities/order) | `Order` |
| `ChapanInvoice` | `Invoice` |
| `ChapanCatalogs` | `OrgCatalogs` или `OperationsCatalogs` |
| `ChapanChangeRequest` | `ChangeRequest` |
| `ChapanShell.module.css` и все Chapan*.module.css | без префикса, переезжают вместе с компонентами |
| CSS-переменные `--ch-*` | переименовать в нейтральные (`--app-*` или удалить упоминания в [ThemeSwitcher.tsx](src/shared/ui/ThemeSwitcher.tsx)) |

### D. Фронт: правки роутера и сайдбара

[src/app/router/index.tsx](src/app/router/index.tsx):
- Удалить весь блок `/workzone/chapan/*` (~40 строк роутов).
- Удалить импорты `ChapanShell`, `ChapanKaspiStagePage`, `ChapanKaspiStockPage`.
- Удалить из `RequirePermission` PermissionCheck-юниона все `chapan_*` значения.
- Добавить новые роуты: `/sales`, `/sales/new`, `/sales/:id`, `/sales/:id/edit`, `/sales/returns`, `/sales/archive`, `/logistics`, `/logistics/:id`, `/products`, `/products/:id`, `/warehouse/purchase`, `/documents` (если ещё нет — расширить под invoices).
- Добавить catch-all: `<Route path="workzone/*" element={<Navigate to="/" replace />} />`.
- Удалить `/warehouse/:id → ChapanOrderDetailPage` (вернётся как `/sales/:id`).

[src/app/layout/Sidebar.tsx](src/app/layout/Sidebar.tsx) и [src/shared/navigation/appNavigation.ts](src/shared/navigation/appNavigation.ts):
- Добавить пункты: **Продажи** (`/sales`), **Логистика** (`/logistics`), **Продукты** (`/products`).
- Секция "Кабинеты" — оставить, но заменить `CHAPAN_NAV_ITEM` на placeholder-пункт "Пока пусто" (disabled, серый, иконка-замок или папка). Убрать условие `planIncludes(plan, 'industrial')` — секция видна всегда (или по новому правилу — на выбор владельца на исполнении).

### E. Фронт: новая система прав

[src/entities/employee/types.ts](src/entities/employee/types.ts) — переписать enum:
```ts
export type Permission =
  | 'orders.read' | 'orders.write' | 'orders.admin'
  | 'invoices.read' | 'invoices.write' | 'invoices.confirm'
  | 'warehouse.read' | 'warehouse.write' | 'warehouse.admin'
  | 'production.read' | 'production.write' | 'production.manage'
  | 'logistics.read' | 'logistics.write'
  | 'customers.read' | 'customers.write'
  | 'products.read' | 'products.write' | 'products.admin'
  | 'purchase.read' | 'purchase.write'
  | 'returns.read' | 'returns.write'
  | 'reports.read'
  | 'documents.read' | 'documents.write'
  | 'company.admin';
```
(точный список финализируется при исполнении на основе реальных guard-точек)

- Удалить `BASE_PERMISSIONS` и `CHAPAN_PERMISSIONS`. Заменить на `PERMISSION_MATRIX` — { module: { read, write, admin } }.
- Удалить `PERMISSION_LABEL` и `PERMISSION_DESCRIPTION` в текущей форме, переписать под модули.

[src/shared/hooks/useEmployeePermissions.ts](src/shared/hooks/useEmployeePermissions.ts):
- Переписать под scope.action. Экспорт: `can(permission)` — простая функция-проверка.
- `useRole` удаляется (по F4 ролей нет).
- `useChapanPermissions` удаляется.

[src/features/auth/pages/settings/index.tsx](src/features/auth/pages/settings/index.tsx):
- AddEmpDrawer / EditEmpDrawer — заменить две группы чекбоксов на матрицу. Строки = модули (Заказы, Накладные, Склад, Производство, Логистика, Клиенты, Продукты, Закуп, Возвраты, Отчёты, Документы). Колонки = `Просмотр / Изменение / Администрирование`. Дополнительная отдельная строка/чекбокс: `Администратор компании` (= право `company.admin`).
- Удалить переключатель `Membership.role` (ролей больше нет). Owner = read-only бейдж (определяется `user.is_owner`).

`<RequirePermission>` в роутере: единственный `check` теперь — конкретное право (`orders.read`, …).

### F. Бэк: маппинг модулей

| Текущее место | Куда |
|---|---|
| `server/src/modules/chapan/orders.routes.ts`, `orders.service.ts`, `orders.service.test.ts`, `orders.integration.test.ts` | `server/src/modules/orders/` |
| `chapan/invoices.routes.ts`, `invoices.service.ts`, `invoice.service.ts`, `invoice-document.ts`, `invoice-number.ts`, `z2-invoice-template.service.ts` | `server/src/modules/invoices/` |
| `chapan/production.routes.ts`, `production.service.ts`, `requests.routes.ts`, `requests.service.ts` | `server/src/modules/production/` |
| `chapan/returns.routes.ts`, `returns.service.ts` | `server/src/modules/returns/` |
| `chapan/purchase.routes.ts`, `purchase.service.ts`, тесты | `server/src/modules/purchase/` |
| `chapan/clients.routes.ts`, `clients.service.ts` | смержить в существующий `server/src/modules/customers/` |
| `chapan/analytics.routes.ts`, `analytics.service.ts` | `server/src/modules/reports/` (новый или существующий) |
| `chapan/alerts.routes.ts`, `alerts.service.ts` | `server/src/modules/alerts/` |
| `chapan/attachments.routes.ts`, `attachments.service.ts` | в `orders/attachments/` (под /orders) |
| `chapan/documents.routes.ts`, `documents.service.ts` | `server/src/modules/documents/` |
| `chapan/settings.routes.ts`, `settings.service.ts` | разнести: размеры/оплата → `products/catalog`, скидки → `sales/pricing`, профиль → `orgs/` |
| `chapan/financials.ts`, `order-item-number.ts`, `status-validator.ts`, `workflow.ts` | `server/src/modules/orders/` |
| `chapan/profile-defaults.ts` | удалить (брендирование сброшено) |
| `chapan/sheets.sync.ts`, `sheets/row-builder.ts`, `sheets.sync.test.ts`, `sheets.full-parity.test.ts` | `server/src/modules/integrations/sheets/` |
| `chapan/types.ts` | поделить: типы заказов → orders/types.ts, инвойсов → invoices/types.ts и т. д. |
| `chapan/orders.routes.ts:16` — `FULL_CHAPAN_ORDER_ACCESS_PERMISSIONS` Set | заменить guard'ы на новый permission-чекер `requirePermission('orders.read'|'orders.admin')` |

URL-префиксы (регистрация в `server/src/app.ts`):
- `/api/v1/chapan/orders` → `/api/v1/orders`
- `/api/v1/chapan/invoices` → `/api/v1/invoices`
- `/api/v1/chapan/production` → `/api/v1/production`
- `/api/v1/chapan/returns` → `/api/v1/returns`
- `/api/v1/chapan/purchase` → `/api/v1/purchase`
- `/api/v1/chapan/clients` → растворить под `/api/v1/customers` (расширить контроллер `customers`)
- `/api/v1/chapan/analytics` → `/api/v1/reports/analytics`
- `/api/v1/chapan/alerts` → `/api/v1/alerts`
- `/api/v1/chapan/settings` → разнести по соответствующим модулям

### G. Бэк: Prisma миграция

Стратегия — **drop existing chapan tables + create new tables with neutral names в одной миграции**.

Rename'ы моделей в [server/prisma/schema.prisma](server/prisma/schema.prisma):

| Сейчас | Станет | Примечание |
|---|---|---|
| `ChapanOrder` | `Order` | главная сущность заказа |
| `ChapanOrderItem` | `OrderItem` | |
| `ChapanOrderAttachment` | `OrderAttachment` | |
| `ChapanProductionTask` | `ProductionTask` | |
| `ChapanChangeRequest` | `ChangeRequest` | |
| `ChapanRequest`, `ChapanRequestItem` | `MaterialRequest`, `MaterialRequestItem` | внутренние заявки на материалы |
| `ChapanPayment` | `Payment` | |
| `ChapanTransfer` | `WarehouseTransfer` или `OrderTransfer` (уточнить семантику) | |
| `ChapanActivity` | `OrderActivity` или `ActivityLog` | |
| `ChapanUnpaidAlert` | `UnpaidAlert` | |
| `ChapanInvoice` | `Invoice` | |
| `ChapanInvoiceOrder` | `InvoiceOrder` | связочная |
| `ChapanReturn`, `ChapanReturnItem` | `Return`, `ReturnItem` | |
| `ChapanManualInvoice`, `ChapanManualInvoiceItem` | `ManualInvoice`, `ManualInvoiceItem` | |
| `ChapanCatalogProduct` | смержить с `WarehouseProductCatalog` (проверить состав полей) | |
| `ChapanCatalogSize` | `ProductSize` или поле каталога — решить при исполнении | |
| `ChapanCatalogPaymentMethod` | `PaymentMethod` | |
| `ChapanClient` | смержить с `Customer` (расширить Customer полями client_type, retail/wholesale) | |
| `ChapanWorker` | `Worker` (или поле "тип сотрудника" в Membership/Employee — решить) | |
| `ChapanProfile` | **удалить полностью** (брендирование сброшено, G3) |

Удалить из модели `Organization` (поля на line 182–192) все `chapan*` relations, добавить новые (`orders`, `invoices`, `customers` уже частично есть и т. д.).

`Membership` (line 358):
- Поле `employeePermissions: String[]` — формат значений меняется со строк типа `chapan_access_orders` на `orders.read`. Старые значения сносим миграцией (всё в `[]`).
- Поле `role` — по решению F4 ролей нет. Удалить (либо оставить с дефолтным значением для бэк-совместимости в плагине `org-scope.ts`, но не использовать в логике). **Принимаемое решение**: удалить, переписать `org-scope.ts` под `is_owner + employeePermissions`. Право `company.admin` заменяет старое `role=admin`.

Plan для миграций:
1. Одна big migration `drop_chapan_models_and_recreate.sql` — DROP всех ChapanXxx-таблиц, удаление chapan-related foreign keys из Organization и других моделей.
2. Вторая миграция `create_neutral_models.sql` — CREATE новых таблиц с правильными именами и связями.
3. Третья миграция `permission_model_rewrite.sql` — обнуление `Membership.employeePermissions` (или очистка), удаление `Membership.role`.

Все старые `chapan_*` миграции остаются в [server/prisma/migrations/](server/prisma/migrations/) — они уже применены и идут в истории, новые накатываются поверх.

### H. Бэк: правка enforcement

[server/src/plugins/auth.ts](server/src/plugins/auth.ts): без изменений (Bearer-токены).

[server/src/plugins/org-scope.ts](server/src/plugins/org-scope.ts):
- Удалить `requireRole(roles[])` и `ROLE_HIERARCHY`.
- Добавить `requirePermission(perm)` — резолвит membership, проверяет `is_owner || has('company.admin') || has(perm)`.
- Удалить `request.orgRole`, заменить на `request.permissions: string[]`.

[server/src/modules/auth/auth.service.ts:buildCapabilities](server/src/modules/auth/auth.service.ts):
- Переписать. Capabilities = массив scope.action из employeePermissions (плюс полный набор, если `is_owner`).
- Удалить упоминания `chapan:read`, `chapan:write` и других chapan-related capability'ев.

В каждом маршруте (например, [orders.routes.ts](server/src/modules/chapan/orders.routes.ts)):
- Заменить `FULL_CHAPAN_ORDER_ACCESS_PERMISSIONS.has(p)`-логику на `requirePermission('orders.read')` / `('orders.write')` / `('orders.admin')`.
- Удалить `resolveOrderAccessScope` (managerId-фильтрацию) — заменить на единый guard.

API `/company/employees`:
- Payload `permissions: string[]` — формат меняется со строк `chapan_*` на `scope.action`. Бэк не валидирует список (просто сохраняет массив); валидация против актуального enum — на стороне фронта при сохранении формы матрицы.

---

## Часть IV — Критические файлы для исполнения

### Фронт — на удаление
- [src/features/auth/pages/workzone/chapan/](src/features/auth/pages/workzone/chapan/) (вся папка)
- [src/features/auth/pages/workzone/](src/features/auth/pages/workzone/) (после переноса — пустая)
- [src/features/chapan-monitor/](src/features/chapan-monitor/)
- [src/features/workzone/chapan/store.ts](src/features/workzone/chapan/store.ts) (перенести Drawer-state в глобальный shared/stores)
- [src/shared/hooks/useChapanPermissions.ts](src/shared/hooks/useChapanPermissions.ts)
- [src/shared/hooks/useRole.ts](src/shared/hooks/useRole.ts) (ролей нет)
- [src/shared/lib/chapanBranding.ts](src/shared/lib/chapanBranding.ts)

### Фронт — на переименование/перенос
- [src/shared/lib/chapanCatalogDefaults.ts](src/shared/lib/chapanCatalogDefaults.ts) → `productCatalogDefaults.ts`
- [src/shared/lib/chapanFinancials.ts](src/shared/lib/chapanFinancials.ts) → `orderFinancials.ts`
- [src/entities/order/types.ts](src/entities/order/types.ts) — `ChapanOrder` → `Order` и пр.
- [src/entities/employee/types.ts](src/entities/employee/types.ts) — новая Permission модель
- [src/entities/order/queries.ts](src/entities/order/queries.ts) — URL'ы API меняются с `/chapan/orders` на `/orders`
- Аналогично для entities/warehouse, entities/purchase, entities/kaspi, entities/analytics, entities/alert

### Фронт — на серьёзную правку
- [src/app/router/index.tsx](src/app/router/index.tsx) — удалить chapan-блок, добавить новые роуты, переписать `<RequirePermission>`
- [src/app/layout/Sidebar.tsx](src/app/layout/Sidebar.tsx) — добавить пункты Продажи/Логистика/Продукты, обновить Кабинеты с placeholder
- [src/shared/navigation/appNavigation.ts](src/shared/navigation/appNavigation.ts) — новые `NAV_ITEM` константы
- [src/shared/hooks/useEmployeePermissions.ts](src/shared/hooks/useEmployeePermissions.ts) — переписать под scope.action
- [src/features/auth/pages/settings/index.tsx](src/features/auth/pages/settings/index.tsx) — матрица прав в AddEmpDrawer / EditEmpDrawer / CompanyAccessSection
- [src/features/auth/pages/documents/InvoiceModal.tsx](src/features/auth/pages/documents/InvoiceModal.tsx), [reports/index.tsx](src/features/auth/pages/reports/index.tsx) — обновить импорты `orderFinancials`
- [src/shared/ui/ThemeSwitcher.tsx](src/shared/ui/ThemeSwitcher.tsx) — убрать `--ch-*` упоминания

### Бэк — на переименование/перенос
- [server/src/modules/chapan/](server/src/modules/chapan/) — раскидать по `orders/`, `invoices/`, `production/`, `purchase/`, `returns/`, `customers/`, `products/`, `alerts/`, `documents/`, `reports/`, `integrations/sheets/`
- [server/prisma/schema.prisma](server/prisma/schema.prisma) — переименовать 22 модели, удалить `ChapanProfile`
- [server/src/app.ts](server/src/app.ts) — изменить URL-префиксы регистраций

### Бэк — на серьёзную правку
- [server/src/plugins/org-scope.ts](server/src/plugins/org-scope.ts) — удалить `requireRole`, добавить `requirePermission`, убрать `request.orgRole`
- [server/src/modules/auth/auth.service.ts](server/src/modules/auth/auth.service.ts) — переписать `buildCapabilities`
- Каждый `*.routes.ts` в chapan/ — заменить permission Set'ы на `requirePermission(scope.action)`
- Новые Prisma migration файлы: drop chapan, create neutral, rewrite permission storage

---

## Часть V — Верификация

После исполнения проверить end-to-end:

### Фронт
1. **TypeCheck**: `pnpm tsc --noEmit` или `npx tsc -b` — без ошибок.
2. **Tests**: `pnpm test` — все перенесённые тесты проходят с новыми именами.
3. **Build**: `pnpm build` (Vite) — без unused-imports/missing-modules.
4. **Lint**: `pnpm lint` — чисто.
5. **Smoke в браузере** (`pnpm dev`):
   - `/` загружается без ошибок, AppShell работает.
   - Сайдбар: Продажи, Логистика, Продукты, Кабинеты (placeholder) — пункты есть и кликабельны.
   - `/sales`, `/sales/new`, `/sales/:id` открываются, рендерится список заказов.
   - `/production`, `/warehouse`, `/products`, `/logistics`, `/documents`, `/reports` — каждая страница загружает данные.
   - `/workzone/chapan` → редирект на `/`.
   - Settings → Сотрудники → AddEmp: видна матрица прав (модули × read/edit/admin), сохранение работает.
   - DevTools network: запросы идут на `/api/v1/orders`, `/api/v1/invoices` и т. д., НЕ на `/api/v1/chapan/*`.

### Бэк
1. **TypeCheck**: `pnpm -C server tsc --noEmit` — без ошибок.
2. **Tests**: `pnpm -C server test` (Vitest) — все интеграционные и unit-тесты проходят, никаких импортов из `modules/chapan/`.
3. **Prisma**: `pnpm -C server db:migrate` накатывается на чистую БД без ошибок. `pnpm -C server db:status` — все миграции applied.
4. **Запуск**: `pnpm -C server dev` стартует, `/health` отвечает, `GET /api/v1/orders` возвращает 200 (с авторизацией).
5. **Grep**: `grep -ri "chapan" server/src/` и `grep -ri "Chapan" src/` — должны давать пустой результат (за исключением README/CHANGELOG).

### Регрессия прав
- Создать тестового сотрудника без прав → не видит ни одной страницы (только заглушки).
- Дать `orders.read` → видит `/sales` (список read-only), но кнопки "Создать заказ" нет.
- Дать `orders.write` → появляется "Создать заказ".
- Дать `company.admin` → видит секцию "Компания и доступ" в Settings, может редактировать сотрудников.
- `user.is_owner = true` → видит и может всё, независимо от массива прав.

---

## Часть VI — Открытые на этапе исполнения вопросы

Не блокируют план, решаются по ходу:

1. **WarehouseProductCatalog ↔ ChapanCatalogProduct** — определить, какие поля у обеих моделей, мержить или одна заменяет другую. Если Warehouse-каталог уже базовый — Chapan-каталог сносится, его UI-расширения мигрируют в `/products`.
2. **WarehouseItem vs Chapan warehouse-фронт** — на бэке `WarehouseItem` уже есть. Решение C4 (Chapan-склад = настоящий) относится к UI; бэк-сущности скорее всего уже корректны, нужно убедиться при исполнении.
3. **ChapanWorker → Worker / поле в Membership** — на бэке `ChapanWorker` хранит цеховых работников. Решить: остаётся отдельная модель `Worker`, или это просто `Membership` с флагом "цеховой".
4. **Customer vs ChapanClient** — Customer уже существует. Сравнить поля, добавить недостающие из ChapanClient (история заказов будет через relation `customer.orders[]`).
5. **`Membership.role` — full drop или soft-keep?** — для безопасности можно оставить колонку с default `'member'` на время, но не использовать в коде. Решить при подготовке миграции.
6. **CSS-переменные `--ch-*` в [ThemeSwitcher.tsx](src/shared/ui/ThemeSwitcher.tsx)** — найти конкретное место и обновить (упомянуто в комментарии, нужно проверить runtime-usage).
7. **PermissionDenied UI** — текущий компонент в роутере привязан к фразе про Chapan, обновить под нейтральное "Доступ запрещён".
8. **Тесты с DOM/MSW** — некоторые Chapan-тесты, возможно, мокают эндпоинты `/api/v1/chapan/*`; их надо обновить под новые URL.

---

## Часть VII — Порядок исполнения (для следующего PR/агента)

1. **Бэк → Prisma**: новая schema.prisma с rename'ами. Сгенерировать миграцию drop+recreate. Применить локально.
2. **Бэк → модули**: раскидать `modules/chapan/*` по новым папкам, переименовать классы/функции/типы.
3. **Бэк → плагины и permissions**: переписать `org-scope.ts`, `auth.service.ts:buildCapabilities`, каждый `*.routes.ts` обновить guard'ы.
4. **Бэк → URL'ы**: обновить регистрации в `app.ts`.
5. **Бэк → тесты**: пройтись по всем сломанным тестам, починить импорты и Prisma-обращения.
6. **Фронт → entities**: переименовать типы и API-клиенты под новые URL'ы и новые имена.
7. **Фронт → shared**: переименовать lib/, удалить chapan-hooks, обновить ThemeSwitcher.
8. **Фронт → страницы**: перенести компоненты Chapan в целевые папки, переименовать.
9. **Фронт → роутер и сайдбар**: добавить новые роуты, удалить старые, обновить сайдбар.
10. **Фронт → Settings (матрица прав)**: переписать AddEmpDrawer/EditEmpDrawer.
11. **Фронт → удалить ChapanShell и chapan-monitor**.
12. **Полная проверка**: typecheck, tests, build, smoke в браузере, ручная регрессия прав.
