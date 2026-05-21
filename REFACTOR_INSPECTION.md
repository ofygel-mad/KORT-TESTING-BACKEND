# REFACTOR_INSPECTION — продовая инспекция расшивки модуля «Чапан»

> Этот документ — задание для следующей сессии. Цель: жёсткая, строгая
> production-инспекция уже выполненного рефакторинга «расшивки Чапана по KORT».
> Запускается командой: открыть этот файл и выполнить все блоки.

---

## 0. Контекст (что было сделано)

Модуль «Чапан» (изолированная ERP-песочница) был расшит по разделам KORT:
- **Backend**: `server/src/modules/chapan/` удалён, файлы разнесены по доменам
  (`orders/`, `invoices/`, `production/`, `returns/`, `purchase/`, `customers/`,
  `reports/`, `alerts/`, `documents/`, `integrations/sheets/`, `orgs/`). 22 Prisma-модели
  `Chapan*` переименованы в нейтральные. Роли удалены, введена модель прав `scope.action`.
- **Frontend**: ~70 компонентов из `workzone/chapan/` перенесены в `sales/`,
  `production/`, `logistics/`, `products/`, `documents/`, `warehouse/stock/`,
  `warehouse/purchase/`, `reports/`, `crm/customers/`. `ChapanShell`, `chapan-monitor`,
  `workzone/` удалены. Router/sidebar переписаны.

Полная история — в плане `~/.claude/plans/greedy-finding-wolf.md` (секция «ПРОГРЕСС ИСПОЛНЕНИЯ»).

**Текущий статус кода:** `tsc --noEmit` 0 ошибок (бэк и фронт), `vite build` успешен.
БД ещё НЕ мигрирована (`prisma db push` не запускался).

---

## 1. Принципы инспекции (ОБЯЗАТЕЛЬНО прочитать перед стартом)

Рефакторинг делался во многом механическими скриптами замен — поэтому
**основной риск — не ошибки компиляции (их нет), а смысловые/логические дефекты,
которые компилятор не ловит:** битая бизнес-логика, рассинхрон фронт↔бэк,
потерянные фичи, мусор от скриптов.

**Правила для инспектора (Opus и агенты):**

1. **Объективность. Проблема — это то, что реально сломает работу или поведение.**
   НЕ являются проблемами: стилистика, «можно было красивее», отсутствие
   комментариев, длина файла, личные предпочтения по неймингу, существующий
   технический долг, который был ДО рефакторинга.
2. **Не выдумывай проблемы ради галочки.** Если зона проверена и всё корректно —
   так и напиши: «проверено, корректно». Пустой отчёт о ненайденных проблемах —
   это успех, а не повод что-то «доисправить».
3. **Сравнивай с git-историей.** Поведение ПОСЛЕ рефакторинга должно совпадать с
   поведением ДО (кроме того, что намеренно менялось — Чапан-бренд, роли). Если
   сомневаешься, было ли что-то багом ДО рефакторинга — это НЕ твоя зона, не трогай.
4. **Чини только подтверждённые дефекты.** Перед правкой сформулируй: что именно
   сломано, как воспроизводится, почему это дефект рефакторинга (а не legacy).
5. **Не расширяй scope.** Не добавляй фичи, не делай «попутный рефакторинг»,
   не переименовывай ради красоты. Только устранение реальных дефектов.
6. **Каждую найденную проблему классифицируй:**
   - 🔴 BLOCKER — ломает сборку/запуск/ключевой сценарий
   - 🟠 MAJOR — фича работает неверно или недоступна
   - 🟡 MINOR — мелкий дефект, не ломает сценарий (косметика-в-коде, мёртвый код)
   - ⚪ NOT-AN-ISSUE — проверено, проблемы нет (фиксировать, чтобы не перепроверять)

---

## 2. Стартовая проверка (Opus, до запуска агентов)

Выполнить и зафиксировать baseline — если здесь что-то падает, чинить ДО агентов:

- [ ] `cd server && npx tsc --noEmit` → 0 ошибок.
- [ ] `npx tsc --noEmit -p tsconfig.json` (фронт, из корня) → 0 ошибок.
- [ ] `npx vite build` → успех.
- [ ] `cd server && npx prisma validate` → схема валидна.
- [ ] `cd server && npx prisma format` → без изменений (или только форматирование).
- [ ] Grep остаточного: `grep -ri "chapan" server/src src --include=*.ts --include=*.tsx`
  — каждое вхождение классифицировать: косметический комментарий (⚪/🟡) либо
  функциональный остаток (🟠/🔴). Особое внимание: URL-строки, query-keys,
  `sourceType`/`event`-дискриминаторы, localStorage-ключи, импорт-пути.

---

## 3. Задачи для агентов (запускать параллельно, до 3 одновременно)

Каждому агенту дать этот файл + конкретный блок ниже. Агент только ИНСПЕКТИРУЕТ
и пишет отчёт (список находок с классификацией). Исправления — отдельной фазой
(см. §5), чтобы агенты не конфликтовали правками одних файлов.

### Агент A — Backend: Prisma-схема и слой данных

Файлы: `server/prisma/schema.prisma`, миграции, все `*.service.ts`.

- [ ] Все 22 переименованные модели: проверить, что НИ ОДНА не потеряла поля,
  индексы, `@@unique`, `@relation`, `onDelete` относительно git-версии
  (`git show HEAD:server/prisma/schema.prisma`).
- [ ] `Organization`: счётчики `orderCounter/invoiceCounter/requestCounter` +
  delivery-fee поля реально добавлены и используются (`nextOrderNumber`,
  `nextInvoiceNumber`, `nextRequestNumber` — увеличивают именно их, через
  `{ increment: 1 }` или raw SQL по `WHERE id = orgId`, НЕ по `org_id`).
- [ ] `Membership`: поле `role` удалено, `isOwner` добавлено. Проверить, что НЕТ
  ни одного оставшегося обращения к `membership.role` / `.orgRole` в `server/src`.
- [ ] `ChapanClient`→`Customer`: слияние корректно. Проверить, что `Order.clientId`
  ссылается на `Customer`, relation работает, поля (`companyName` vs старое
  `company`) согласованы во всех `.service.ts`.
- [ ] `ChapanProfile` удалён: убедиться, что нигде не осталось `prisma.chapanProfile`
  / `prisma.organization` с обращением к несуществующим полям (`displayName`,
  `orderPrefix`, `publicIntake*`, `supportLabel`, `descriptor`).
- [ ] `ChapanCatalogProduct` удалён, заменён на `WarehouseProductCatalog`:
  **критично** — проверить, что во ВСЕХ местах, где скрипт заменил
  `.chapanCatalogProduct`→`.warehouseProductCatalog`, набор полей при
  `create`/`upsert` валиден (`WarehouseProductCatalog` требует `normalizedName`;
  `@@unique([orgId, normalizedName])` — значит `where: { orgId_normalizedName: ... }`).
- [ ] raw SQL во всех сервисах: имена таблиц в `$queryRaw`/`$executeRaw` совпадают
  с `@@map(...)` новых моделей (`orders`, `invoices`, `order_items` и т.д.).
- [ ] Миграции: сгенерирована ли миграция под новую схему. Если нет — это ожидаемо
  (пользователь запустит `db push`); зафиксировать как «требует runtime», не баг.

### Агент B — Backend: модули, роуты, права, enforcement

Файлы: `server/src/app.ts`, все `*.routes.ts`, `server/src/plugins/`,
`server/src/modules/auth/`, `orgs/operations-settings.*`.

- [ ] `app.ts`: каждый `register(...)` указывает на существующую функцию и реальный
  файл; префиксы URL не конфликтуют (два роутера на один префикс с пересекающимися
  путями — 🟠). Проверить `clients.routes` (`/api/v1/clients`) vs `customers`.
- [ ] `org-scope.ts`: `requirePermission`/`requireCompanyAdmin` — логика корректна
  (owner и `company.admin` проходят всегда; иначе — проверка точного права).
- [ ] **Каждый route**: guard соответствует операции. Read-эндпоинт не должен
  требовать `.admin`; мутация не должна быть без guard. Сверить с git-версией —
  если раньше route был защищён `requireRole('admin','owner')`, сейчас должен быть
  `requireCompanyAdmin()`; если был публичный — остаться публичным (например,
  публичная форма заявок `requests` `/public/:orgId`).
- [ ] `auth.service.ts`: `buildCapabilities` — owner/`company.admin` получают
  `ALL_PERMISSIONS`, остальные — ровно свой массив. Session-ответы (`login`,
  `bootstrap`, `registerCompany`, `acceptInvite`) не содержат битых ссылок на `role`.
- [ ] `Invite.role` / `MembershipRequest.requestedRole` остались в схеме как
  legacy-строки — проверить, что код, который их пишет/читает, не падает и не
  создаёт `Membership` с несуществующим полем `role`.
- [ ] URL-префиксы: собрать полный список бэк-эндпоинтов (`/api/v1/...`) — он нужен
  Агенту E для сверки с фронтом.
- [ ] `warehouse/*`: discriminator-строки `sourceType: 'chapan_order'`,
  `'chapan_order_item'`, `'chapan_order_shipment'` и `startsWith('chapan_order')` —
  producer и consumer ДОЛЖНЫ использовать одну строку. Если так — ⚪ (косметика,
  БД пересоздаётся). Если producer и consumer разошлись — 🔴.
- [ ] `accounting.sync.ts`: event-имена `chapan_order.completed`/`chapan_payment.added`
  — producer и consumer согласованы? Проверить, кто эмитит эти события (возможно
  `orders.service`) — если producer переименован, а consumer нет (или наоборот) — 🔴.

### Агент C — Frontend: перенесённые страницы и компоненты

Файлы: `src/features/auth/pages/{sales,production,logistics,products,documents,
warehouse/stock,warehouse/purchase,reports,crm/customers}/`.

- [ ] Каждый перенесённый компонент: импорты разрешаются, CSS-модули указывают на
  существующие файлы (`tsc` это НЕ ловит для `.module.css` — проверять глазами
  или `vite build`).
- [ ] Внутри-компонентная логика не пострадала от скриптов замены: проверить, что
  массовые замены (`Chapan*`→нейтральные, `useChapanPermissions`→`useOperationsAccess`)
  не задели строковые литералы, которые НЕ должны были меняться (тексты для
  пользователя, ключи localStorage, тестовые данные).
- [ ] **Потерянные фичи**: `ChapanShell` удалён. Он рендерил глобально:
  `ChapanInvoicesDrawer` и `ChapanMonitorWidget`. Monitor удалён намеренно (ОК).
  **`InvoicesDrawer`** — проверить: он где-нибудь рендерится сейчас? Если экраны
  (`ReadyPage`, `OrdersPage`) вызывают `openInvoicesDrawer()`, но сам `<InvoicesDrawer/>`
  нигде не смонтирован — drawer не откроется (🟠 потерянная фича).
- [ ] `OperationsSettingsPage` (бывший `ChapanSettings`, 4 таба): все 4 таба
  (каталоги/профиль/клиенты/аккаунт) рендерятся без падений; таб «Профиль»
  очищен от брендинга, но остался осмысленным (delivery fees).
- [ ] `warehouse/stock/`: бывший chapan-склад. Проверить, что `OrderDetailModal`,
  `AddItemDrawer`, `ItemDetailDrawer` и т.д. целы; конфликт имён с KORT-warehouse
  (`WarehouseCatalog`) разрешён корректно — разные папки, импорты не перекрёстные.
- [ ] Kaspi-канал `sales/channels/kaspi/`: 4 страницы + view-model на месте,
  внутренние ссылки/навигация ведут на новые пути (`/sales/kaspi/...`).
- [ ] `ProductsPage` (бывший `ChapanCatalog`) импортирует CSS из
  `warehouse/stock/WarehouseCatalog.module.css` — это намеренное переиспользование
  стилей; убедиться, что путь рабочий и классы существуют.

### Агент D — Frontend: router, sidebar, навигация

Файлы: `src/app/router/index.tsx`, `src/app/layout/{Sidebar,MobileNav,Topbar}.tsx`,
`src/shared/navigation/appNavigation.ts`.

- [ ] Router: каждый `lazy(() => import(...))` указывает на существующий файл с
  `export default`. Каждый роут обёрнут корректными гардами (`RequireAuth`,
  `RequireOrg`, `RequirePlan`, `RequirePermission`).
- [ ] Полнота роутов: для КАЖДОГО перенесённого экрана есть роут. Особо проверить:
  `OrderTrashPage` (`/sales/trash`), `OperationsSettingsPage` — **есть ли вообще
  роут на OperationsSettingsPage?** (в плане settings «растворялся» — проверить,
  что страница доступна, иначе 🟠 недостижимый экран).
- [ ] `RequirePermission check=...` — значение `check` для каждого роута осмысленно
  (раздел заказов → `orders.read`, не `warehouse.read` и т.п.).
- [ ] `/workzone/*` → redirect на `/` присутствует. Старые внутренние ссылки на
  `/workzone/chapan/...` в коде не остались (Агент C это тоже косвенно ловит).
- [ ] Sidebar/MobileNav: пункты Продажи/Логистика/Продукты ведут на корректные
  пути; секция «Кабинеты» — заглушка «Пока пусто», не кликабельна, не ломает вёрстку.
- [ ] `appNavigation.ts`: `SIDEBAR_NAV_SECTIONS` consistent с `ShortcutNavItemId`;
  `planTier` у новых пунктов осмыслен.
- [ ] `workspace` (canvas-виджеты): `Record<ShortcutNavItemId,...>` в `sceneConfig`,
  `registry`, `model/store` — полные (все ключи), `chapan` не остался. Это
  второстепенная зона (виджеты канваса) — глубоко не копать, только компилируемость
  и отсутствие `chapan`-ключей.

### Агент E — Cross-layer: API-контракт фронт ↔ бэк + права

Самая важная зона. Работает после Агентов B (даёт список бэк-URL) — либо собирает сам.

- [ ] **Сверка URL**: для каждого вызова в `src/entities/**/api.ts`
  (`api.get/post/patch/put/delete('/...')`) есть соответствующий бэк-route с тем же
  методом и путём. Несовпадение префикса/пути → 🔴 (фича не работает в runtime,
  компилятор это не ловит).
- [ ] Особое внимание: `/settings/operations/*` (фронт `operationsSettingsApi`) vs
  бэк `operations-settings.routes.ts` (`/defaults`, `/catalogs`, `/clients`,
  `/bank-commission`) — пути совпадают точно?
- [ ] `attachments` — `/orders/:id/attachments`; `invoices` — `/invoices/...`;
  `documents` — `/documents/...`; `analytics` — `/analytics/...` либо
  `/reports/analytics` — фронт и бэк должны указывать на ОДНО.
- [ ] Query-keys инвалидации: бэк `frontend-compat.service.ts` шлёт entity-имена
  (`orders`, `invoices`, `returns`, `production`, `change_requests`); фронт
  `Topbar.tsx onEntityUpdate` keyMap и `entities/order/queries.ts` queryKeys —
  должны совпадать. Рассинхрон → данные не обновляются в реальном времени (🟠).
- [ ] **Семантика прав**: проверить мост `useOperationsAccess` — маппинг
  `scope.action`→булевы флаги осмыслен (`canConfirmInvoice`=`invoices.confirm`,
  `canAccessShipping`=`logistics.*` и т.д.). Сверить, что компоненты используют
  флаги по назначению. Грубые ошибки маппинга → 🟠.
- [ ] `useEmployeePermissions` legacy-флаги (`canAccessSales`, `canAccessWarehouse`
  и т.д.) и `useRole`-shim — маппинг на новые права не даёт ложных
  «разрешено/запрещено». Например `canAccessFinancial`=`reports.read` — адекватно?
- [ ] Backend `requirePermission('xxx')` для каждого домена ↔ фронт `RequirePermission
  check="xxx"` ↔ `PERMISSION_MATRIX` — один и тот же набор строк прав. Право,
  которое бэк проверяет, но которого нет в `ALL_PERMISSIONS`, или наоборот — 🟠.

---

## 4. Зоны личной проверки Opus (не делегировать)

- [ ] **Архитектурная целостность мостов.** `useRole` (shim), `useOperationsAccess`
  (мост), legacy-флаги в `useEmployeePermissions` — это технический долг,
  введённый осознанно. Проверить: они корректны и не маскируют дыру в правах.
  Решить: оставить как есть или зафиксировать в плане как будущую зачистку
  (НЕ чинить сейчас, если работает).
- [ ] **Permissions end-to-end логика.** Пройти сценарий: сотрудник без прав → не
  видит разделы; с `orders.read` → видит `/sales` read-only; с `orders.write` →
  появляется создание; `company.admin` → видит Settings→Сотрудники; `is_owner` →
  всё. Проверить, что на каждом слое (router guard, sidebar-фильтр, кнопки в
  компонентах, бэк-guard) логика согласована и нет «дыр» (UI прячет, бэк пускает,
  или наоборот).
- [ ] **Потерянная функциональность ChapanShell.** Кроме `InvoicesDrawer` (см.
  Агент C) — был iOS swipe-back, кастомный топбар. Это намеренно удалено вместе с
  отдельным layout — подтвердить, что ничего из этого не было критичной фичей,
  которую нужно перенести в `AppShell`.
- [ ] **Settings/employees дубликат.** В `settings/index.tsx` и `employees/index.tsx`
  скрипт заменил `BASE_PERMISSIONS/CHAPAN_PERMISSIONS`→`ALL_PERMISSIONS` и
  `PERMISSION_DESCRIPTION`→`PERMISSION_LABEL`. Проверить, что итоговый Uf вменяем
  (не показывает 27 чекбоксов дважды, не дублирует label вместо описания так, что
  выглядит сломанным). Если выглядит криво — переписать на `PERMISSION_GROUPS`
  как в модалках. Если приемлемо — ⚪.
- [ ] **Итоговая сверка с планом.** Пройти `greedy-finding-wolf.md` Часть III
  (карта переноса) пункт за пунктом: каждое решение B1–H4 реализовано ИМЕННО так,
  как согласовано. Любое отклонение — зафиксировать (отклонение ≠ всегда баг, но
  должно быть осознанным).

---

## 5. Фаза исправления (после сбора всех отчётов)

1. Свести все находки агентов + Opus в единый список, убрать дубли.
2. Отсортировать: 🔴 → 🟠 → 🟡. ⚪ — не трогать.
3. Чинить по порядку. После каждого блока исправлений — `tsc` (фронт+бэк) + при
   необходимости `vite build`.
4. 🟡 (minor) чинить только если дёшево и безопасно; если рискованно — записать в
   план как известный долг, не трогать.
5. НЕ начинать правку, пока не ясно: что сломано, почему это дефект рефакторинга,
   как проверить, что починка сработала.

---

## 6. Definition of Done инспекции

- `tsc --noEmit` — 0 ошибок (бэк и фронт).
- `vite build` — успех.
- Все 🔴 и 🟠 устранены либо явно обоснованы как «не дефект» / «требует runtime».
- Нет функциональных остатков `chapan` (URL, query-keys, дискриминаторы, импорты).
  Косметические комментарии — допустимо, но лучше вычистить если дёшево.
- Сверка фронт↔бэк API: каждый вызов фронта попадает в существующий бэк-route.
- Отчёт: список находок по классам + что исправлено + что осознанно оставлено.
- Обновить `greedy-finding-wolf.md`: отметить инспекцию пройденной.

---

## 7. Что НЕ входит в инспекцию (не тратить время)

- Качество/архитектура кода, существовавшего ДО рефакторинга.
- Производительность, бандл-сайз, code-splitting (warning Vite о чанках >550 КБ — НЕ баг).
- Стиль, форматирование, комментарии, нейминг (кроме случаев, когда имя реально
  вводит в заблуждение и ведёт к багам).
- UI/UX-улучшения, новые фичи.
- Запуск БД и интеграционных тестов — это runtime-задача пользователя; инспекция
  только фиксирует, что код к ним готов.
