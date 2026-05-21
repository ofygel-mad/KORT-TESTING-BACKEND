# Product Platform API — Contract v1

> Источник истины для интеграции «продукт ↔ Control Plane». Часть фазы R4
> (см. `greedy-finding-wolf.md`). KORT реализует контракт в R4.2.

## Назначение

Стандартный интерфейс, который **каждый управляемый продукт** KORT-платформы
выставляет для **Control Plane (CP)** — мозгового центра компании.

Ключевой принцип — **развязка**: CP управляет продуктами ТОЛЬКО через этот
контракт. CP никогда не обращается к БД продукта напрямую. Продукт автономен.

## Версионирование

Префикс `/platform/v1`. Несовместимые изменения → `/platform/v2`. Добавление
опциональных полей — без смены версии. Этот документ — источник истины для v1.

## Аутентификация

Service-to-service, два независимых уровня:

1. **Bearer service-token** — `Authorization: Bearer <token>`. Токен —
   подписанный (HMAC-SHA256) JWT: `iss=control-plane`, `aud=<product code>`,
   короткий TTL. Секрет — `PLATFORM_SERVICE_SECRET` (свой у каждого продукта;
   CP хранит его в `ProductCredential`).
2. **IP allowlist** — `PLATFORM_ALLOWED_IPS` (CIDR-список). Запрос вне списка →
   `403` ещё до проверки токена.

Клиентские JWT-секреты приложения для этого контракта НЕ используются.

## Эндпоинты

### `GET /platform/v1/health`
Статус продукта.
→ `{ status: 'ok'|'degraded'|'down', version, uptimeSec, db: 'ok'|'down', tenantCount }`

### `GET /platform/v1/tenants`
Список организаций (тенантов). Query: `search, status, plan, page, limit`.
→ `{ count, results: [{ id, name, slug, plan, status, userCount, ownerEmail, createdAt, lastActivityAt }] }`

### `GET /platform/v1/tenants/:id`
Карточка тенанта: профиль, владельцы, сотрудники (кратко), подписка/план, счётчики.
→ `{ id, name, slug, plan, subscription, owners[], userCount, employees[], createdAt, ... }`

### `PATCH /platform/v1/tenants/:id`
Управление тенантом. Body: `{ planCode?, status? }` (`status`: `active|suspended`).
Продукт логирует изменение у себя и возвращает применённое состояние.

### `POST /platform/v1/tenants`
Provisioning новой организации с владельцем.
Body: `{ companyName, ownerEmail, ownerFullName, planCode? }`.
→ созданный тенант + одноразовый bootstrap-токен для первого входа владельца.

### `POST /platform/v1/tenants/:id/impersonate`
Выдаёт **ограниченный** impersonation-токен для входа оператора CP в аккаунт
клиента. Body: `{ actorPlatformUserId, reason, ttlSec? }`.
Токен: короткий TTL, помечен `impersonated=true`. Продукт обязан показать баннер
в UI клиента, запретить деструктивные операции и смену пароля/почты. Каждая
выдача логируется у продукта и в CP.

### `GET /platform/v1/metrics`
Агрегаты использования за период. Query: `from, to`.
→ счётчики активных пользователей, входов, ключевых действий по тенантам.

## Телеметрия — push-модель

Продукт не ждёт опроса от CP. Продукт пишет события в локальный outbox, шиппер
батчами отправляет их в ingestion-эндпоинт CP:

`POST <CP>/ingest/v1/events` — Body: `{ productCode, events: AuditEvent[] }`.

Конверт `AuditEvent`:

```
{
  eventId:     string          // uuid — идемпотентность приёма
  productCode: string
  tenantId:    string | null
  userId:      string | null
  type:        string          // login | login_failed | request | business | security
  action:      string          // 'order.created' | 'GET /api/v1/orders' | ...
  ip:          string | null
  userAgent:   string | null
  metadata:    object           // тип-специфичные поля (before/after, statusCode, ...)
  occurredAt:  string           // ISO-8601
}
```

CP хранит канонический долгий аудит у себя; продукт держит локально короткое окно
(для разбора и повторной отправки при сбое доставки).

## Модель ошибок

JSON `{ error: { code, message } }`. Коды:
`401 unauthorized` · `403 forbidden_ip` · `404 not_found` · `409 conflict` ·
`422 validation` · `503 unavailable`.

## Реализация

- **KORT** реализует контракт в R4.2 — модуль `server/src/modules/platform/`.
- **Control Plane** вызывает контракт в R4.4.
- Слой телеметрии/аудита KORT (источник `AuditEvent`) — фаза R4.1.
