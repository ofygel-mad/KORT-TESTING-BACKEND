# TEST REPORT: CI/CD, Security и Runtime Checks

Дата проверки: 2026-04-24  
Среда проверки: Windows, Node.js `22.16.0`, pnpm `10.13.1`  
Важно: GitHub Actions в проекте используют `ubuntu-latest` и Node.js `20`, поэтому часть результатов ниже отмечена как "локально не воспроизведено" или "среда отличается".

## Краткий итог

Главный реальный риск падения CI сейчас не frontend lint/build, а E2E/Playwright pipeline:

- `.github/workflows/test.yml` запускает E2E на `ubuntu-latest`.
- `playwright.config.ts` при этом стартует web servers через Windows-команды `powershell ... tests/e2e/start-*.ps1`.
- Workflow вручную стартует backend на порту `8000`, а Playwright config ожидает backend `8002` и frontend `4174`.
- Workflow строит frontend, но не стартует preview server; запуск frontend сейчас спрятан в Playwright `webServer`.

Это создает конфликт: CI одновременно частично подготавливает окружение сам и частично полагается на Windows-ориентированный Playwright startup. Это наиболее вероятная причина "проваливания" test job в GitHub.

Security-находки есть, но текущий `security.yml` помечает `pnpm audit`, Snyk и Gitleaks как `continue-on-error: true`. То есть эти сообщения могут выглядеть тревожно, но сами по себе не должны валить workflow, если branch protection не требует отдельный security signal.

## Что было запущено

| Проверка | Команда | Результат |
|---|---:|---|
| Root install | `pnpm install --frozen-lockfile` | PASS, но warning про ignored build scripts: `esbuild` |
| Server install | `pnpm install --frozen-lockfile` в `server/` | PASS, Prisma Client сгенерирован |
| Frontend lint | `pnpm lint` | PASS |
| Frontend unit/component coverage | `pnpm run test:coverage` | PASS: 13 files, 97 passed, 1 skipped |
| Frontend build | `pnpm build` | PASS, есть Vite chunk warning |
| Backend build | `pnpm run build` в `server/` | PASS |
| Backend coverage | `pnpm run test:coverage` в `server/` | FAIL локально: нет PostgreSQL на `localhost:5432` |
| E2E list | `pnpm test:e2e -- --list` | PASS: найдено 45 тестов |
| E2E smoke | `pnpm test:e2e -- tests/e2e/smoke.spec.ts --project=chromium` | FAIL локально: Docker daemon/Postgres недоступны |
| Root audit | `pnpm audit --audit-level=high` | FAIL exit code 1, но в CI этот step non-blocking |
| Server audit | `pnpm audit --audit-level=high` в `server/` | FAIL exit code 1, но в CI этот step non-blocking |
| Deploy files check | Проверка наличия файлов | PASS: `server/Dockerfile`, `docker-compose.yml`, `server/.env.example`, `README.md` есть |
| Bundle size | Анализ `dist/` после build | PASS условно: 118 файлов, ~11.04 MB |
| Docker jobs | Docker CLI check | NOT RUN: Docker daemon локально не запущен |
| Prisma migrate status | `pnpm exec prisma migrate status` | FAIL локально: нет PostgreSQL |
| Gitleaks local | `gitleaks version` | NOT RUN: gitleaks не установлен локально |

## Подробные проблемы и исправления

### 1. E2E/Playwright pipeline несовместим с GitHub Ubuntu

Файлы:

- `.github/workflows/test.yml`
- `playwright.config.ts`
- `tests/e2e/start-backend.ps1`
- `tests/e2e/start-frontend.ps1`

Симптомы:

- Локальный smoke E2E упал до запуска тестов: Playwright `webServer` вышел раньше времени.
- Причина локально: `start-backend.ps1` пытается поднять `docker compose up -d postgres`, но Docker daemon не запущен.
- В GitHub риск другой: workflow работает на `ubuntu-latest`, а Playwright config вызывает `powershell`, не `pwsh` и не cross-platform Node script.
- В workflow backend стартует на `PORT=8000`, а Playwright config по умолчанию использует `E2E_BACKEND_PORT=8002`.
- Frontend preview в workflow явно не стартует; он ожидается через Playwright `webServer`, который сейчас Windows-specific.

Как исправить без поломки проекта:

1. Выбрать один источник запуска E2E окружения:
   - либо workflow сам стартует backend и frontend preview;
   - либо Playwright `webServer` стартует оба сервиса.
2. Для CI я бы сделал проще:
   - в workflow оставить setup DB/build/seed;
   - стартовать backend через Bash-compatible команду;
   - стартовать frontend через `pnpm preview --host 127.0.0.1 --port 4173`;
   - в `playwright.config.ts` отключать `webServer` при `process.env.CI === 'true'`.
3. Выровнять порты:
   - backend: `8000` или `8002`, но один и тот же в workflow, `VITE_PROXY_TARGET`, `E2E_BACKEND_PORT`;
   - frontend: `4173` или `4174`, но один и тот же в workflow и Playwright `baseURL`.
4. Если Playwright должен сам стартовать окружение, заменить `.ps1` scripts на cross-platform Node scripts или отдельные `*.sh` для Linux CI.
5. Не запускать `docker compose` внутри Playwright startup на CI, если GitHub job уже предоставляет `services.postgres`.

Приоритет: P0, потому что это может валить `frontend-e2e`, а значит и финальный `tests-passed` gate.

### 2. Backend tests зависят от PostgreSQL и локально не стартуют без него

Файлы:

- `server/vitest.global-setup.ts`
- `server/.env.test`

Симптом:

- `pnpm run test:coverage` в `server/` падает в global setup на `pnpm exec prisma migrate deploy`.
- Prisma не может подключиться к `postgresql://kort:kort_secret@localhost:5432/kort_db_test`.

В CI это должно работать, потому что `backend-tests` job объявляет `services.postgres`. Локально проблема инфраструктурная: PostgreSQL/Docker не запущен.

Как исправить:

- Для локального воспроизведения: поднять Postgres через Docker Desktop или отдельный локальный Postgres с БД `kort_db_test`.
- Для CI: оставить service postgres, но добавить явный readiness check перед `prisma migrate deploy`, чтобы ошибка была понятнее.
- В `vitest.global-setup.ts` лучше логировать stdout/stderr Prisma как текст, сейчас Vitest показывает часть ошибки как serialized Buffer.

Приоритет: P1. Это не обязательно причина GitHub fail, но мешает надежно воспроизводить backend test job локально.

### 3. Frontend coverage настроен слишком широко

Файл:

- `vite.config.ts`

Факт:

- Frontend tests прошли, но общий coverage получился около 5%.
- Причина: coverage включает лишние артефакты и директории, включая `dist/`, `server/dist/`, `tests/e2e`, config files и другие не-frontend runtime файлы.
- `test.exclude` не равен `coverage.exclude`; coverage сейчас исключает только `node_modules/` и `src/test/`.

Как исправить:

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/**/*.{ts,tsx}'],
  exclude: [
    'src/test/**',
    'src/**/*.test.{ts,tsx}',
    'src/**/*.spec.{ts,tsx}',
    'src/**/*.e2e.{test,spec}.{ts,tsx}',
    'src/**/*.d.ts',
    'src/main.tsx',
  ],
}
```

Также добавить в `.gitignore`:

```gitignore
coverage/
server/coverage/
```

Приоритет: P2. Сейчас это не валит CI, но делает coverage signal шумным и бесполезным.

### 4. Vite build проходит, но есть крупный Three.js chunk

Файл:

- `vite.config.ts`

Факт:

- `pnpm build` прошел.
- Vite warning: `vendor-three-core-D2RoqmTn.js` около `724.75 kB`, лимит `550 kB`.
- Крупнейшие chunks:
  - `vendor-three-core`: ~724 KB
  - `ChapanWarehouse`: ~433 KB
  - `vendor-charts`: ~364 KB

Как исправить:

- Не просто повышать лимит.
- Проверить, что Three.js/3D canvas грузится только для workspace/twin страниц через lazy imports.
- Разнести тяжелые warehouse/charts views по route-level lazy chunks.
- Если этот размер сознательно принят, можно поднять `chunkSizeWarningLimit`, но лучше после проверки lazy-loading.

Приоритет: P2. Это warning, не CI failure.

### 5. Security audit: backend advisories

Команда:

- `pnpm audit --audit-level=high` в `server/`

Найдено:

- 2 critical, 3 high, 9 moderate.
- Critical идет через `@fastify/jwt -> fast-jwt`.
- В коде backend JWT фактически реализован через `server/src/lib/jwt.ts` и пакет `jsonwebtoken`; прямого использования `@fastify/jwt` я не нашел.
- Также есть high advisory для `fastify <=5.8.4`; установлен `fastify 5.8.4`, latest по registry сейчас `5.8.5`.
- Есть `defu` через Prisma toolchain.

Как исправить без риска:

1. Если `@fastify/jwt` действительно не используется, удалить его из `server/package.json` и lockfile. Это самый безопасный способ убрать `fast-jwt` advisories без затрагивания auth logic.
2. Обновить `fastify` до `5.8.5`, затем прогнать backend build/tests.
3. Обновить Prisma внутри 6.x до `6.19.3` и/или обновить lockfile так, чтобы `defu` резолвился в patched версию `>=6.1.5`. Не прыгать сразу на Prisma 7 без отдельной миграционной проверки.
4. После изменений обязательно прогнать:
   - `pnpm install --frozen-lockfile`
   - `pnpm run build` в `server/`
   - backend tests на реальной test DB
   - E2E auth flow

Приоритет: P1. Это реальные security advisories, но текущий `security.yml` audit step non-blocking.

### 6. Security audit: frontend advisories

Команда:

- `pnpm audit --audit-level=high`

Найдено:

- `xlsx@0.18.5`: high advisories, при этом npm registry показывает latest `0.18.5`, а audit сообщает patched version `<0.0.0`.
- `xlsx` используется только в `src/pages/workzone/chapan/warehouse/ChapanWarehouse.tsx` для client-side парсинга `.xlsx/.xls` в импорте остатков.
- `@lhci/cli` тянет dev-only advisories через Lighthouse dependencies: `lodash`, `lodash-es`, `basic-ftp`.

Как исправить без риска:

1. Не запускать `pnpm audit fix --force`.
2. Для `xlsx`:
   - лучший вариант: убрать client-side Excel parse и отправлять файл на backend import/scanner, где уже есть серверная import-инфраструктура и можно использовать `exceljs`;
   - более простой вариант: временно оставить только CSV import на frontend и убрать `.xlsx/.xls` из UI;
   - если Excel нужен срочно, добавить size limit, MIME/extension validation и обработку ошибок, но advisory останется.
3. Для `@lhci/cli`:
   - обновления самого `@lhci/cli` нет, latest `0.15.1`;
   - можно попробовать pnpm overrides для `basic-ftp@5.3.0`, `lodash@4.18.1`, `lodash-es@4.18.1`, но только после проверки `pnpm exec lhci autorun`/Lighthouse job.

Приоритет: P1 для `xlsx`, P3 для LHCI dev-only chain.

### 7. В репозитории закоммичены database artifacts и dump

Файлы:

- `_database-report/2026-04-06_20-11-02/*`
- `kort_production.dump`
- `server/coverage/*`

Факт:

- `_database-report` отслеживается Git: 29 файлов.
- Там есть `refresh_tokens.csv`, `users.csv`, клиентские/заказные CSV и password hashes.
- `kort_production.dump` тоже отслеживается Git.
- `.gitignore` содержит `../_database-report/`, но реальная директория находится в корне как `_database-report/`, поэтому правило не защищает этот путь.
- `server/coverage` также отслеживается Git и будет постоянно шуметь после test runs.

Как исправить осторожно:

1. Сначала убедиться, что эти данные не нужны как публичный fixture.
2. Если это реальные/полуреальные данные:
   - сделать приватный backup вне Git;
   - удалить из текущего дерева;
   - добавить ignore rules:
     ```gitignore
     _database-report/
     *.dump
     coverage/
     server/coverage/
     ```
   - добавить те же правила в `.dockerignore`, минимум `_database-report` и `*.dump`, чтобы Docker build context не отправлял дампы в daemon/cache.
3. Если данные уже были в публичном remote/history:
   - считать refresh tokens/password hashes скомпрометированными;
   - refresh tokens на дату проверки уже выглядят истекшими, но password hashes и PII все равно чувствительны;
   - рассмотреть rotation JWT secrets/password reset и чистку истории через `git filter-repo`/BFG только после согласования команды.

Приоритет: P0 security hygiene. Это не обязательно валит CI, но именно такие вещи любят поднимать GitHub/security bots.

### 8. Security workflow: что реально блокирует, а что шумит

Файл:

- `.github/workflows/security.yml`

Наблюдение:

- `pnpm audit` root/server: `continue-on-error: true`.
- Snyk: `continue-on-error: true`.
- Gitleaks: `continue-on-error: true`.
- CodeQL, OWASP Dependency Check, SARIF upload и SBOM generation не помечены как continue-on-error.

Вывод:

- Audit/Snyk/Gitleaks могут писать красные advisory в логах, но не должны валить job напрямую.
- Job может падать из-за CodeQL/autobuild, Dependency Check action, SARIF upload или отсутствующих/лимитированных external services.
- Не надо глушить все security warnings. Надо разделить:
  - реальные зависимости, которые можно безопасно обновить;
  - dev-only tooling noise;
  - sensitive artifacts в repo.

## Рекомендованный порядок исправлений

1. Исправить E2E pipeline: убрать Windows-only Playwright startup из Ubuntu CI и выровнять порты.
2. Убрать sensitive database artifacts из Git и добавить правильные ignore/dockerignore rules.
3. Убрать неиспользуемый `@fastify/jwt` или обновить его осознанно; обновить `fastify` до `5.8.5`.
4. Решить `xlsx`: server-side import через backend scanner или CSV-only frontend.
5. Починить frontend coverage scope.
6. Оптимизировать/lazy-load тяжелые chunks только после стабилизации CI gate.

## Проверки после исправлений

Минимальный набор:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm run test:coverage
pnpm build

cd server
pnpm install --frozen-lockfile
pnpm run build
pnpm run test:coverage
```

Для E2E после поднятого Postgres:

```bash
pnpm test:e2e -- --project=chromium
```

Для security после targeted updates:

```bash
pnpm audit --audit-level=high
cd server
pnpm audit --audit-level=high
```

## Что я не стал делать автоматически

- Не запускал `pnpm audit fix --force`, потому что это может сломать `xlsx`, Prisma/Fastify и Lighthouse chain.
- Не удалял database dump/report из репозитория, потому что это может быть намеренный snapshot; но с точки зрения security это нужно отдельно подтвердить и убрать безопасно.
- Не переписывал Git history.
- Не запускал Docker build/compose, потому что Docker daemon локально недоступен.
