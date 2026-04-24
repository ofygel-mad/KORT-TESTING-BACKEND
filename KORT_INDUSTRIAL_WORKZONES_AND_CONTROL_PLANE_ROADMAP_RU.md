# KORT: промышленные кабинеты, доступ Чапан и глобальная админка

Дата: 2026-04-24

---

## Как читать этот документ

Каждая задача в этом roadmap имеет уникальный ссылочный код вида `ФАЗА-NN`.

| Аббревиатура | Фаза          | Смысл                                          |
|---|---|---|
| `FIX`        | Fix           | Срочные исправления безопасности и доступа     |
| `FOUND`      | Foundation    | Правильная архитектура доступа и provisioning  |
| `CTRL`       | Control Plane | Внутренний инструментарий команды KORT         |
| `PLAT`       | Platform      | Подписки, лимиты, флаги, интеграции            |
| `H`          | Horizon       | Долгосрочный enterprise-горизонт               |

**Как ссылаться на задачи:**

В PR title:
```
feat(entitlement): workzone gate на роуте [FIX-05, FIX-06]
```

В commit message:
```
fix: убрать авто-создание ChapanProfile closes FIX-02
```

В задаче трекера:
```
[FIX-04] Sidebar скрывает Чапан по entitlement, а не по плану
```

В комментарии к коду:
```ts
// Проверка entitlement обязательна на backend — требование FIX-06
```

**Правила кодов:** коды фиксированы и не меняются. При добавлении новых задач новый код получает следующий свободный номер в конце своей фазы.

---

## О чём этот документ

Документ описывает, как правильно развести три разные вещи, которые сейчас частично смешаны:

1. тариф компании в KORT;
2. доступ к индивидуальным кабинетам вроде "Чапан";
3. внутреннюю платформу управления KORT для владельцев продукта.

**Главная мысль:** тариф "Промышленный" должен давать право на подключение индивидуальных кабинетов, но не должен автоматически включать каждый существующий кабинет. Кабинет "Чапан" должен быть доступен только конкретной организации Чапан или тем организациям, которым команда KORT явно выдала такой доступ.

---

## 1. Текущее состояние

По текущему коду видно несколько важных фактов.

### 1.1. Чапан сейчас завязан на industrial

В `src/app/router/index.tsx` маршрут `/workzone/chapan` закрыт через:

```tsx
<RequirePlan tier="industrial">
  <RequirePermission check="chapan">
    <ChapanShell />
  </RequirePermission>
</RequirePlan>
```

В `src/app/layout/Sidebar.tsx` и `src/app/layout/MobileNav.tsx` кабинет Чапан показывается, если:

```ts
planIncludes(plan, 'industrial')
```

Из-за этого любая компания, выбравшая "Промышленный", видит кабинет Чапан в навигации.

### 1.2. Backend создает ChapanProfile для каждой новой компании

В `server/src/modules/auth/auth.service.ts` внутри `registerCompany()` после создания организации вызывается:

```ts
await tx.chapanProfile.create({ data: { orgId: org.id } });
```

`ChapanProfile` создается для каждой зарегистрированной компании, даже если компания не является Чапаном.

### 1.3. Демо-аккаунт admin@kort.local в seed

В `server/prisma/seed.ts` есть:

```ts
const OWNER_EMAIL = 'admin@kort.local';
const OWNER_PASSWORD = await bcrypt.hash('demo1234', 10);
```

Это нормально для локального seed/demo режима, но в production доступ к кабинету нельзя определять через email. Доступ должен определяться через организацию, подписку, entitlement, module assignment и audit trail.

### 1.4. Права Чапан есть, но entitlement уровня организации нет

Сейчас есть employee permissions:

- `chapan_full_access`
- `chapan_access_orders`
- `chapan_access_production`
- `chapan_access_ready`
- `chapan_access_archive`
- `chapan_access_warehouse_nav`
- `chapan_confirm_invoice`
- `chapan_manage_settings`

И есть frontend hook `src/shared/hooks/useChapanPermissions.ts`.

Это права пользователя внутри кабинета. Но отсутствует право организации: "этой компании вообще подключен кабинет chapan". Нужно добавить недостающий слой.

---

## 2. Целевая модель доступа

KORT должен разделять доступ на несколько уровней.

### 2.1. Уровень 1: план

- `basic` — базовые CRM/складские возможности;
- `advanced` — продажи, задачи, финансы, сотрудники, отчеты;
- `industrial` — сложные процессы, кастомные кабинеты, интеграции, расширенный аудит, внедрение.

Правильная трактовка:

```
industrial = компания может покупать/получать кастомные кабинеты
industrial ≠ компания автоматически получает кабинет Чапан
```

### 2.2. Уровень 2: entitlement организации

Entitlement — выданное организации право на модуль, кабинет, интеграцию или лимит.

Примеры:

- `module:crm`
- `module:warehouse`
- `module:finance`
- `workzone:chapan`
- `integration:whatsapp`
- `limit:users:50`

Ключевой entitlement для Чапана: `workzone:chapan`.
Только если у организации есть этот entitlement, Чапан появляется в sidebar, routes, API и bootstrap payload.

### 2.3. Уровень 3: экземпляр кабинета

Кабинет — не просто React route, а продуктовая сущность:

```
WorkzoneDefinition:    шаблон кабинета (что такое Чапан как модуль)
OrgWorkzoneInstance:   подключенный экземпляр для конкретной организации
```

### 2.4. Уровень 4: права пользователя внутри кабинета

После того как организация получила кабинет, конкретные пользователи получают доступ к разделам через `useChapanPermissions()` и `employeePermissions`. Этот слой уже частично есть — его нужно сохранить, но подчинить entitlement организации.

### 2.5. Уровень 5: runtime gates на backend

Frontend скрывает интерфейс, но backend обязан проверять доступ самостоятельно. Каждый `/api/v1/chapan/*` endpoint проверяет:

1. пользователь аутентифицирован;
2. пользователь состоит в организации;
3. организация имеет `workzone:chapan`;
4. статус workzone instance — `active`;
5. пользователь имеет нужную роль или permission.

**Итоговая ось:**

```
Organization → Subscription/Plan → Entitlements → Workzone Instance → User Permissions
```

---

## 3. Рекомендуемая архитектура данных

Ниже рабочая модель для переноса в `schema.prisma`.

### 3.1. OrgEntitlement

Факт, что организации выдано право.

Поля: `id`, `orgId`, `key`, `source` (plan | addon | manual | contract | trial | migration), `status` (active | suspended | expired | revoked), `startsAt`, `expiresAt`, `grantedByUserId`, `revokedByUserId`, `notes`, `metadataJson`, `createdAt`, `updatedAt`.

Пример:
```
orgId = org_chapan
key = workzone:chapan
status = active
source = contract
```

### 3.2. WorkzoneDefinition

Описание типа кабинета.

Поля: `id`, `key`, `title`, `description`, `route`, `minPlan`, `icon`, `status`, `permissionsJson`, `sectionsJson`, `createdAt`, `updatedAt`.

Пример:
```
key = chapan
title = Чапан
route = /workzone/chapan
minPlan = industrial
```

### 3.3. OrgWorkzoneInstance

Подключение кабинета к конкретной организации.

Поля: `id`, `orgId`, `definitionKey`, `status` (provisioning | active | suspended | archived), `enabledAt`, `enabledByUserId`, `disabledAt`, `disabledByUserId`, `settingsJson`, `provisioningLogJson`, `createdAt`, `updatedAt`.

### 3.4. ProductModule

Справочник модулей KORT. Поля: `id`, `key`, `title`, `type` (core | workzone | integration | addon), `minPlan`, `defaultEnabled`, `status`, `metadataJson`, `createdAt`, `updatedAt`.

### 3.5. InternalAdminUser

Отдельный слой внутренних пользователей KORT. Использует существующий `User` как identity, но добавляет отдельную таблицу для platform-role.

Поля: `id`, `userId`, `role` (super_admin | support | implementation | finance | readonly), `status`, `allowedIpRanges`, `mfaRequired`, `createdAt`, `updatedAt`.

### 3.6. InternalAdminAuditLog

Audit log действий команды KORT.

Поля: `id`, `actorUserId`, `action`, `targetType`, `targetId`, `orgId`, `beforeJson`, `afterJson`, `reason`, `requestId`, `ip`, `userAgent`, `createdAt`.

Примеры actions: `org.module.enable`, `org.suspend`, `support.impersonation.start`, `workzone.provision`.

### 3.7. FeatureFlag + OrgFeatureFlagOverride

`FeatureFlag`: `key`, `description`, `enabledGlobally`, `rulesJson`, `createdAt`, `updatedAt`.

`OrgFeatureFlagOverride`: `orgId`, `flagKey`, `enabled`, `reason`, `expiresAt`.

### 3.8. IntegrationConnection

Поля: `id`, `orgId`, `provider`, `status`, `credentialsRef`, `scopes`, `lastSyncAt`, `lastError`, `settingsJson`, `createdAt`, `updatedAt`.

Важно: секреты не хранить в JSON. Хранить ссылку на secret storage или зашифрованное значение.

---

## 4. Что принято в других SaaS-продуктах

### 4.1. Plan, entitlement, feature flag — разные сущности

- **План** определяет коммерческий пакет.
- **Entitlement** определяет, что куплено или выдано конкретному tenant.
- **Feature flag** определяет, кому временно включена новая функция.

Это разделение нужно, чтобы продавать add-ons отдельно от плана, включать функции пилотным клиентам, быстро отключать проблемные модули и вести понятный audit.

### 4.2. Tenant first

В B2B SaaS доступ привязан к организации, а не к email пользователя. Причины: email может поменяться, владелец может смениться, сотрудник может уволиться. KORT уже движется в эту сторону через `Organization`, `Membership`, `X-Org-Id`. Нужно продолжать эту модель.

### 4.3. Internal admin отделен от customer app

В зрелых продуктах internal admin не является "секретной страницей" в клиентском приложении. Минимум:

- отдельный маршрут `/internal`;
- отдельная проверка platform role;
- audit log;
- запрет доступа обычным клиентам.

### 4.4. Support impersonation делается осторожно

Правильная модель: оператор KORT нажимает "Start support session", указывает причину, система создает временный impersonation token, в UI явно видно что это support mode, все действия пишутся в audit log, клиент видит историю support sessions.

---

## 5. Что НЕ делаем

Явные ограничения текущего scope, чтобы исключить расползание задач:

- Не автоматизируем биллинг и оплату до завершения `PLAT-02`.
- Не делаем self-service provisioning для клиента (клиент сам подключает кабинет) до завершения `CTRL`.
- Не строим Workzone Marketplace до завершения `H-01–H-06`.
- Не переносим фичи Чапана в KORT Core до проверки на реальном клиенте.
- Не делаем separate frontend app для Control Plane на старте — достаточно `/internal` route с правильными backend guards.
- Не удаляем данные при отключении кабинета — только suspend.

---

## 6. Roadmap

### [FIX] — Закрыть утечку

**Срок:** ~2 недели. **Приоритет:** немедленно.

**Проблема:** любая industrial компания видит Чапан в sidebar и может вызвать Chapan API.

**Acceptance criteria:**
1. Новая industrial компания не видит "Чапан" в sidebar.
2. Новая industrial компания получает 403 на `/api/v1/chapan/orders`.
3. Существующая организация Чапан видит кабинет и может работать с заказами.
4. Смена email владельца Чапан не ломает доступ к кабинету.
5. `ChapanProfile` не создается при обычной регистрации.
6. `admin@kort.local` остается только как dev/seed login.

**Rollback:** migration обратима — строки из `OrgEntitlement` удаляются, авто-создание ChapanProfile возвращается через временный фиче-флаг.

---

**FIX-01** — Создать таблицу `OrgEntitlement` в `server/prisma/schema.prisma`.

Минимальная схема: `id`, `orgId`, `key`, `status`, `source`, `createdAt`, `updatedAt`.
Позже расширяется полями из раздела 3.1.

**FIX-02** — Убрать авто-создание `ChapanProfile` при регистрации компании.

В `server/src/modules/auth/auth.service.ts` в `registerCompany()` удалить:
```ts
await tx.chapanProfile.create({ data: { orgId: org.id } });
```
Создание профиля переносится в provisioning service (FOUND-02).

**FIX-03** — Migration: выдать `workzone:chapan` существующей Chapan-организации.

Алгоритм:
1. Найти seed/demo организацию по slug или email владельца.
2. Создать `OrgEntitlement(workzone:chapan, active, source: migration)`.
3. Убедиться что `ChapanProfile` для неё существует (upsert).
4. Для всех остальных org — не выдавать entitlement.
5. Аудит: найти все org с `ChapanProfile` из-за авто-создания — это задача FOUND-07.

**FIX-04** — Frontend: sidebar и MobileNav показывают Чапан по entitlement.

В `Sidebar.tsx` и `MobileNav.tsx` заменить:
```ts
planIncludes(plan, 'industrial')
```
на:
```ts
planIncludes(plan, 'industrial') && hasEntitlement('workzone:chapan')
```

**FIX-05** — Frontend: `RequireEntitlement` на роуте `/workzone/chapan`.

Создать компонент `RequireEntitlement`. Маршрут должен проверять: auth → active org → industrial plan → `workzone:chapan` entitlement → chapan user permissions.

**FIX-06** — Backend: `assertOrgEntitlement(orgId, 'workzone:chapan')` на всех Chapan route groups.

Применить на: orders, production, requests, settings, invoices, returns, alerts, analytics, purchase, attachments.

Коды ответов:
```
403 MODULE_NOT_ENABLED   — нет entitlement
403 PLAN_REQUIRED        — план ниже industrial
403 PERMISSION_DENIED    — нет секционного права пользователя
```

**FIX-07** — Auth bootstrap `/auth/bootstrap` возвращает entitlements организации.

```ts
// В session response добавить:
entitlements: string[]
workzones: Array<{ key: string; status: string; route: string }>
```

Frontend хранит это в auth store.

**FIX-08** — Smoke-тесты для критичных сценариев.

- industrial org без entitlement → sidebar не показывает Чапан;
- industrial org без entitlement → 403 на `/api/v1/chapan/orders`;
- org с entitlement → кабинет доступен;
- user без chapan permission → нет доступа к внутренним секциям;
- смена email владельца → доступ к Чапану сохранен.

---

### [FOUND] — Правильная модель доступа

**Срок:** ~1 месяц после FIX. **Зависимость:** FIX-01–FIX-07 завершены.

**Цель:** Чапан становится управляемым workzone instance, а не хардкодом.

**Метрика успеха:** подключение нового workzone-клиента не требует ручных SQL-правок.

---

**FOUND-01** — Схема `WorkzoneDefinition` + `OrgWorkzoneInstance`.

Добавить в `schema.prisma` согласно разделу 3.2 и 3.3.

**FOUND-02** — Provisioning service.

```ts
provisionWorkzone(orgId: string, key: 'chapan', actorUserId: string): Promise<OrgWorkzoneInstance>
```

Шаги: проверить план → создать entitlement → создать instance → upsert ChapanProfile → создать дефолтные каталоги → записать audit.

**FOUND-03** — Suspend / resume flow.

Suspend: скрывает UI, блокирует API, не удаляет данные.
Resume: возвращает доступ, не создает дублей профиля и каталогов.

**FOUND-04** — Убрать все привязки к `admin@kort.local` из продуктовой логики.

Проверить весь код на: `admin@kort.local`, `demo1234`, seed-only assumptions, миграции ищущие user email. Оставить только в dev/seed контексте.

**FOUND-05** — Frontend hooks `useEntitlements()` и `useWorkzones()`.

Расширить или заменить текущие capability-хуки. `useWorkzones()` возвращает список активных workzone instances организации.

**FOUND-06** — Lazy loading ChapanShell.

ChapanShell и весь chapan-бандл не должны попадать в main bundle для организаций без entitlement. Использовать `React.lazy` + динамический import.

**FOUND-07** — Аудит существующих org с авто-созданным ChapanProfile.

Найти все org, у которых есть `ChapanProfile` из-за авто-создания при регистрации. Для каждой принять решение: выдать `workzone:chapan` (если реальный Chapan-клиент) или пометить profile как orphaned. Написать migration-скрипт с явным списком.

---

### [CTRL] — Control Plane MVP

**Срок:** ~2–3 месяца. **Зависимость:** FOUND-01–FOUND-03 завершены.

**Цель:** команда KORT управляет клиентами без ручных SQL-правок.

**Метрика успеха:** среднее время provisioning нового Chapan-клиента < 5 минут без SQL.

---

**CTRL-01** — Роли платформы.

Добавить `InternalAdminUser` (раздел 3.5) с ролями: `super_admin | support | implementation | finance | readonly`.

**CTRL-02** — Backend guard: обычный owner организации не получает platform role.

Разделить guards: `requireAuth()` для клиентов, `requirePlatformRole()` для операторов KORT.

**CTRL-03** — Auth для `/internal`.

С самого начала: отдельная проверка platform role + IP allowlist для `/internal/*`. Не откладывать на P8.

**CTRL-04** — UI `/internal`: список организаций.

Поиск по названию, slug, email владельца. Колонки: план, статус, подключенные модули, дата создания, последняя активность.

**CTRL-05** — Карточка организации.

Показывать: профиль компании, владельцы/администраторы, сотрудники, план, entitlements, workzones, интеграции, audit log, заметки команды KORT.

**CTRL-06** — UI управления Чапаном из Control Plane.

Кнопки: Подключить Чапан / Отключить / Возобновить / Посмотреть audit.

**CTRL-07** — `InternalAdminAuditLog`.

Каждое действие оператора пишет: кто сделал, что сделал, для какой организации, причина, before/after state.

**CTRL-08** — Internal notes по клиенту.

Свободный текст от команды KORT по организации (история внедрения, особые договорённости, контакты).

---

### [PLAT] — Platform Foundation

**Срок:** ~6 месяцев, может идти параллельно с CTRL. **Зависимость:** FOUND завершен.

**Цель:** планы, лимиты, флаги и интеграции управляются данными, а не хардкодом.

**Метрика успеха:** смена плана клиента не требует ручного обновления entitlements.

---

**PLAT-01** — `PlanDefinition`.

Описать планы `basic | advanced | industrial` как данные: core modules, default entitlements, limits, доступные add-ons.

**PLAT-02** — `Subscription`.

Организация имеет subscription: plan, status, period, trial, billing customer id, contract notes.

**PLAT-03** — Plan → entitlement sync.

При смене плана система синхронизирует plan-based entitlements. Manual/contract entitlements не удаляются при даунгрейде — только деактивируются plan-derived.

**PLAT-04** — Лимиты.

Добавить: пользователи, storage, API requests, workzone count, integrations count, import size. Хранить в `OrgEntitlement` с `key = limit:users:50`.

**PLAT-05** — `FeatureFlag` + `OrgFeatureFlagOverride`.

Справочник флагов с rollout rules. Org override: включить фичу одной организации с указанием причины и срока истечения.

**PLAT-06** — Kill switches для критичных модулей.

Быстрый выключатель для: импорта, публичных форм, интеграций, warehouse worker, workzone route.

**PLAT-07** — `IntegrationConnection`.

Registry интеграций: WhatsApp, Telegram, Google Sheets, 1C, Kaspi, email, external webhooks.

**PLAT-08** — Secret storage для integration credentials.

Не хранить secrets в JSON-поле. Минимум: encryption at rest + masked display + rotation + audit access.

**PLAT-09** — Integration health в Control Plane.

Показывать: last sync, error rate, retry count, queue depth, token expiry.

---

### [HORIZON] — Enterprise Horizon

Открытый горизонт. Задачи имеют смысл только после стабилизации PLAT. Приоритет внутри фазы уточняется при входе в неё.

**Входной критерий:** PLAT-01–PLAT-06 завершены и прошли production soak (минимум 4 недели).

---

**H-01** — Support impersonation.

Временный токен, banner в UI клиента ("Сейчас в аккаунте работает оператор KORT"), audit всех действий, запрет на удаление данных и смену пароля клиента в support mode.

**H-02** — Прозрачность support-сессий для клиента.

Клиент видит: кто из KORT заходил, когда, с какой причиной, какие действия делал.

**H-03** — Workzone SDK conventions.

Новый кабинет появляется только через definition + entitlement + instance + user permission. Не через прямой импорт и `if plan industrial`. Каждый кабинет имеет manifest.

**H-04** — Multi-tenant lifecycle.

Полный lifecycle организации: lead → trial → onboarding → active → suspended → churned → archived → deleted after retention.

**H-05** — Data retention.

Настройки: срок хранения данных, export before deletion, soft delete, legal hold, backup restore.

**H-06** — Contract-driven entitlements.

Доступы и лимиты соответствуют договору: contract id, start/end, SLA, included modules, custom terms.

**H-07** — Implementation playbooks.

Для внедрения клиента: discovery checklist, process mapping, data import checklist, UAT checklist, go-live checklist, post-launch support checklist.

**H-08** — Workzone marketplace.

Каталог: industry templates, paid add-ons, partner integrations, custom workflows. Только после стабилизации H-03.

---

## 7. Риски

**R-01: Сломать текущую demo-базу**
Если просто убрать `ChapanProfile`, можно сломать seed/demo flow.
Решение: FIX-03 явно выдает entitlement seed-организации и upsert-ит profile перед удалением авто-создания.

**R-02: Скрыть UI, но оставить API открытым**
Частичный фикс опаснее полного отсутствия фикса — создает ложное ощущение безопасности.
Решение: FIX-06 обязателен одновременно с FIX-04 и FIX-05.

**R-03: Смешать internal admin и owner компании**
Если owner организации получит доступ к Control Plane — критическая security ошибка.
Решение: CTRL-01 и CTRL-02 как первые задачи Control Plane, CTRL-03 (IP allowlist) не откладывается.

**R-04: Orphaned ChapanProfile у не-Chapan клиентов**
Из-за авто-создания в production могут быть org с ChapanProfile, которые не являются Chapan-клиентами.
Решение: FOUND-07 — явный аудит и migration-скрипт.

**R-05: Слишком большой scope upfront**
Не нужно строить enterprise admin platform за один квартал.
Решение: FIX закрывает утечку, FOUND делает правильный provisioning, CTRL делает MVP — каждая фаза полезна сама по себе.

---

## 8. Целевое состояние

Для организации Чапан:

```
org_chapan
  plan:               industrial
  entitlement:        workzone:chapan — active, source: contract
  workzone instance:  chapan — active
  users:              owner / admin / employees with chapan section permissions
```

Для новой промышленной компании:

```
org_new_factory
  plan:               industrial
  entitlement:        нет workzone:chapan
  workzone instance:  нет
  результат:          Chapan не виден в UI, Chapan API возвращает 403
```

Для команды KORT в Control Plane:

```
operator@kort.team
  platform role:      implementation
  действие:           выбирает org_new_factory → нажимает "Подключить кабинет" → выбирает chapan
  результат:          provisioning service создает entitlement + instance + profile + audit log
                      клиент видит кабинет при следующем bootstrap
```
