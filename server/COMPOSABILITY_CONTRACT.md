# Composability Contract — Конфигурируемые поверхности v1

> Источник истины для интеграции «композиционная студия Control Plane ↔ KORT».
> Часть ЧАСТИ X (см. план `kort-parallel-sphinx.md` / `greedy-finding-wolf.md`).
> KORT реализует контракт в фазах P0–P3. Образец стиля — `PLATFORM_API_CONTRACT.md`.

## Назначение

Конечный, явный список UI-поверхностей KORT, осознанно сделанных настраиваемыми.
Каждая поверхность — обычный закодированный компонент, читающий **типизированный
конфиг**. Кастомизация делается оператором ТОЛЬКО через Control Plane; у KORT нет
собственного UI самонастройки — он лишь читает и применяет присланный конфиг.

Объём v1 — **случай A**: каталог заранее закодированных блоков. Конфиг управляет
видимостью / порядком / группировкой блоков и доступностью секций. Конфиг
**НИКОГДА** не меняет схему БД. Поверхности v1: сайдбар, форма нового заказа, Склад.
Случай B (произвольные поля, динамический JSONB) — НЕ в v1.

## Принцип владения

- **KORT** владеет **активным** конфигом и применяет его автономно — работает,
  даже если Control Plane недоступен.
- **Control Plane** — редактор и история: черновики, версии, preview/publish/rollback.
- CP **не** обращается к БД KORT — только через composition-эндпоинты Platform API.

## Версионирование

Composition-эндпоинты — под префиксом `/platform/v1/composition` (часть Product
Platform API v1). Несовместимые изменения → `/platform/v2`. `schemaVersion` —
версия типизированной схемы конфиг-объекта (бамп при breaking-изменении формы
конфига). `MANIFEST_VERSION` — стабильный хэш каталога; меняется при правке манифеста.

## Аутентификация

Те же два независимых уровня, что у Product Platform API (см.
`PLATFORM_API_CONTRACT.md` § Аутентификация):

1. **IP allowlist** — `PLATFORM_ALLOWED_IPS`, проверяется первым.
2. **Bearer service-token** — подписанный (HMAC-SHA256) JWT, `iss=control-plane`,
   `aud=<product code>`, короткий TTL.

Отдельных секретов для composition не вводится. Composition-роуты монтируются
вместе с остальным Platform API — только при заданном `PLATFORM_SERVICE_SECRET`.

## Модель данных

Сторона **KORT** (`server/prisma/schema.prisma`):

- `TenantConfig` — один **активный** конфиг на организацию (`orgId @unique`,
  `revision`, `schemaVersion`, `config` Json, `manifestVersion`, `source`).
- `TenantConfigRevision` — **append-only** журнал применённых ревизий
  (`@@unique([orgId, revision])`); позволяет KORT откатиться самостоятельно.
- `TenantConfigPreview` — стейджинг preview (`orgId @unique`, `expiresAt` TTL);
  не попадает в журнал ревизий.

Сторона **Control Plane** (`control-plane/api/prisma/schema.prisma`):

- `SurfaceConfigDraft` — изменяемая рабочая копия редактора (`@@unique([productId,
  tenantId])`); существует только в CP.
- `SurfaceConfigVersion` — неизменяемая история публикаций (`@@unique([productId,
  tenantId, version])`, `kortRevision` — ссылка на ревизию KORT).

## Манифест блоков и секций

`COMPOSITION_MANIFEST` (бэкенд KORT, `server/src/modules/composition/manifest.ts`) —
единственный источник истины. Каталог:

- `sections[]` — секции верхнего уровня (гейтят навигацию + роуты + API).
- `surfaces[]` — конфигурируемые поверхности, каждая с массивом `blocks`.

Каждый блок: `{ id, label, surface, group?, defaultOrder, removable, planTier?,
permission? }`. `planTier` / `permission` зеркалят гейтинг, уже enforce-имый
`appNavigation.ts` и роутером.

Бэкенд валидирует входящий конфиг против манифеста и отдаёт манифест в CP. Фронт
KORT получает **сгенерированную** копию (`src/shared/composition/manifest.generated.ts`,
через `server/scripts/export-manifest.ts`); parity-тесты ловят дрейф.

## Форма конфиг-объекта

Хранится в `TenantConfig.config`:

```
{
  schemaVersion: number,
  sections: { <sectionId>: { enabled: boolean } },
  surfaces: {
    <surfaceId>: {
      blocks: { <blockId>: { visible: boolean, order: number, group?: string } }
    }
  }
}
```

Конфиг ссылается **только** на id из манифеста; выражает только `visible` / `order`
/ `group`. Никаких free-form полей, никаких определений компонентов.

## Эндпоинты

Все — под `/platform/v1/composition`, за теми же гейтами, что Product Platform API.
Контрактный конверт ошибок — `{ error: { code, message } }`.

### `GET /platform/v1/composition/manifest`
Каталог секций / поверхностей / блоков.
→ `{ version, sections: [...], surfaces: [...] }`

### `GET /platform/v1/composition/config`
Активный конфиг тенанта. Query: `tenantId` (обяз.).
→ `{ tenantId, revision, schemaVersion, manifestVersion, source, config, appliedAt }`

### `POST /platform/v1/composition/publish`
Публикация нового конфига. Body: `{ tenantId, config, manifestVersion, note? }`.
KORT валидирует (Zod + манифест) → новая `TenantConfigRevision`, `TenantConfig`
обновлён, совпавший preview очищен.
→ `201 { tenantId, revision, appliedAt }` · невалидный → `422 validation`.

### `POST /platform/v1/composition/preview`
Стейджинг preview. Body: `{ tenantId, config, manifestVersion, ttlSec? }`
(`ttlSec` 60–3600, дефолт 1800). KORT валидирует → запись в `TenantConfigPreview`.
→ `{ tenantId, expiresAt }` · невалидный → `422`.

### `DELETE /platform/v1/composition/preview`
Сброс стейджинг-preview. Query: `tenantId` (обяз.).
→ `{ tenantId, cleared: boolean }`

### `GET /platform/v1/composition/revisions`
Список применённых ревизий, новые сверху. Query: `tenantId` (обяз.), `page`, `limit`.
→ `{ count, results: [{ revision, schemaVersion, manifestVersion, source, note,
actor, appliedAt }] }`

### `POST /platform/v1/composition/rollback`
Откат на ревизию. Body: `{ tenantId, revision, reason? }`. KORT грузит ту ревизию,
**ре-валидирует против ТЕКУЩЕГО манифеста**, пишет НОВУЮ ревизию (`source:
'rollback'`).
→ `{ tenantId, revision, appliedAt }` · ревизия не найдена → `404` · устаревший
конфиг → `422`.

## Preview → Publish → Rollback

- **Правка.** CP-оператор грузит манифест и активный конфиг, правит
  `SurfaceConfigDraft` целиком внутри CP. Во время правки KORT не дёргается.
- **Preview.** CP `POST .../preview`. KORT кладёт конфиг в `TenantConfigPreview`.
  Оператор открывает KORT по impersonation-токену с заголовком `X-Config-Preview: 1`
  → `bootstrap()` отдаёт preview вместо активного конфига. Обычные пользователи
  тенанта всегда видят активный. Preview не попадает в журнал ревизий, авто-истекает.
- **Publish.** CP `POST .../publish`. KORT пишет новую `TenantConfigRevision`,
  обновляет `TenantConfig`, очищает preview. CP записывает `SurfaceConfigVersion`
  (`action: 'publish'`, `kortRevision` из ответа) и зовёт `logCpAction`.
- **Rollback.** CP `POST .../rollback`. KORT ре-валидирует целевую ревизию против
  текущего манифеста и пишет новую ревизию (`source: 'rollback'`). KORT может
  откатиться сам, без CP, если плохой конфиг «окирпичил» тенанта.

## Дефолтный конфиг

Дефолт = сегодняшний UI, **вычисляется кодом** из манифеста (все секции `enabled`,
все блоки `visible`, порядок = `defaultOrder`, без групп-оверрайдов) — не пишется
руками. Сеется лениво: в `bootstrap()`, если у орг нет строки `TenantConfig`; и в
`provisionOrganization()` для новых орг. Нулевая регрессия для существующих тенантов.

## Гарантии и инварианты

- Конфиг **никогда** не меняет схему БД. Новые блоки — обычная кодовая задача
  (компонент + запись манифеста + миграция при нужде в колонке).
- KORT не «окирпичить»: невалидный конфиг → `422`, никогда не применяется;
  `TenantConfigRevision` — журнал для само-отката.
- KORT работает без Control Plane — активный конфиг лежит в его собственной БД.
- **План — потолок:** конфиг может скрывать/переставлять/группировать секции,
  которые план уже даёт, но не может включить секцию вне плана (`planTier` /
  `PlanDefinition.features` остаются источником entitlements).

## Модель ошибок

JSON `{ error: { code, message } }`. Коды:
`401 unauthorized` · `403 forbidden_ip` · `404 not_found` · `409 conflict` ·
`422 validation` · `503 unavailable`.

## Реализация

- **KORT** — модуль `server/src/modules/composition/` (`manifest.ts`,
  `composition.schema.ts`, `composition.defaults.ts`, `composition.service.ts`) +
  суб-роутер `server/src/modules/platform/composition.platform.routes.ts`.
- **Control Plane** — модуль `control-plane/api/src/modules/composition/` +
  студия `control-plane/web/src/pages/CompositionPage.tsx`.
- Фазы: P0 (контракт + каркас) → P1 (сайдбар) → P2 (форма заказа) → P3 (Склад).
