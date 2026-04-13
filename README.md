# KORT DEV MODE

Монорепозиторий из двух приложений:

- `.`: фронтенд на `React + Vite + TypeScript`
- `server/`: API на `Fastify + Prisma + PostgreSQL`

Текущее состояние проверено:

- `npm run build` в корне: проходит
- `npm run test` в корне: проходит
- `npm run test:e2e` в корне: проходит
- `npm run build` в `server/`: проходит

## Структура

```text
.
├─ src/                  # фронтенд
├─ tests/e2e/            # Playwright smoke/e2e
├─ server/
│  ├─ src/               # backend
│  ├─ prisma/
│  └─ railway.toml       # Railway-конфиг backend service
├─ railway.toml          # Railway-конфиг frontend service
├─ .env.local            # локальные env фронта
└─ .env.e2e             # env для e2e mock-режима
```

## Локальный запуск

### Фронтенд в mock-режиме

```bash
npm install
npm run dev
```

По умолчанию e2e используют отдельный режим `e2e` и не требуют ручного выставления `VITE_MOCK_API=true`.

### Полный стек локально

1. Поднять PostgreSQL:

```bash
docker compose up -d --build
```

2. Установить зависимости:

```bash
npm install
cd server
pnpm install
```

3. Настроить backend:

```bash
cd server
pnpm run db:migrate -- --name init
pnpm run db:seed
pnpm run dev
```

4. Во втором терминале запустить фронтенд:

```bash
npm run dev
```

Фронтенд ожидает API на `/api/v1`, для локальной разработки proxy уже настроен в `vite.config.ts`.

## Проверки

```bash
npm run test
npm run test:e2e
npm run build

cd server
npm run build
```

## Railway

Рекомендуемая схема деплоя: два отдельных сервиса из одного репозитория.

### 1. Backend service

- Root Directory: `server`
- Конфиг берётся из [`server/railway.toml`](/c:/Users/user/Documents/KORT-DEV-MODE/server/railway.toml)
- Обязательные переменные окружения:
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `JWT_ACCESS_TTL` по желанию, по умолчанию `15m`
  - `JWT_REFRESH_TTL` по желанию, по умолчанию `7d`
  - `CORS_ORIGIN` = URL фронтенд-сервиса Railway
  - `CONSOLE_SERVICE_PASSWORD` по желанию

### 2. Frontend service

- Root Directory: корень репозитория
- Конфиг берётся из [`railway.toml`](/c:/Users/user/Documents/KORT-DEV-MODE/railway.toml)
- Обязательные переменные окружения:
  - `VITE_API_BASE_URL=https://<backend-domain>/api/v1`
  - `VITE_SENTRY_DSN` по желанию
- `VITE_MOCK_API` на Railway не нужен и должен оставаться выключенным

### 3. После деплоя

- проверить `GET https://<backend-domain>/api/v1/health`
- проверить логин и создание клиента/сделки на фронте
- проверить CORS: фронт должен обращаться к backend Railway-домену без 403/blocked origin

## Замечания

- `README` и `SETUP` обновлены под текущую структуру репозитория; старые упоминания `frontend/` и устаревших e2e-селекторов больше неактуальны.
- Playwright теперь поднимает фронтенд на отдельном порту `4173` в режиме `e2e`, поэтому локальный dev-сервер не конфликтует с тестами.












