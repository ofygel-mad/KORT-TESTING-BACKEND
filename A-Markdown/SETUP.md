# SETUP

## Требования

- Node.js 18+
- `pnpm` для backend
- Docker Desktop для локальной PostgreSQL

## Быстрый локальный старт

### Вариант A. Только фронтенд, mock-режим

```bash
npm install
npm run dev
```

### Вариант B. Полный стек

1. Поднять БД:

```bash
docker compose up -d --build
```

2. Установить зависимости:

```bash
npm install
cd server
pnpm install
```

3. Применить миграции и сиды:

```bash
cd server
pnpm run db:migrate -- --name init
pnpm run db:seed
```

4. Запустить backend:

```bash
cd server
pnpm run dev
```

5. Запустить frontend:

```bash
npm run dev
```

## Полезные команды

### Frontend

```bash
npm run dev
npm run test
npm run test:e2e
npm run build
```

### Backend

```bash
cd server
pnpm run dev
pnpm run build
pnpm run db:studio
pnpm run db:seed
pnpm run db:report
```

## Railway deployment

Нужно создать два сервиса.

### Backend service

- Source Repo: текущий репозиторий
- Root Directory: `server`
- Config As Code: [`server/railway.toml`](/c:/Users/user/Documents/KORT-DEV-MODE/server/railway.toml)

Переменные:

```env
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=replace-with-long-secret
JWT_REFRESH_SECRET=replace-with-long-secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ORIGIN=https://<frontend-domain>
CONSOLE_SERVICE_PASSWORD=optional
```

### Frontend service

- Source Repo: тот же репозиторий
- Root Directory: `.`
- Config As Code: [`railway.toml`](/c:/Users/user/Documents/KORT-DEV-MODE/railway.toml)

Переменные:

```env
VITE_API_BASE_URL=https://<backend-domain>/api/v1
VITE_SENTRY_DSN=
```

## Проверка перед выдачей тестерам

Минимальный чек-лист:

1. `npm run test`
2. `npm run test:e2e`
3. `npm run build`
4. `cd server && npm run build`
5. Проверить backend healthcheck
6. Проверить логин, создание клиента, создание сделки, редактирование карточек

## Что уже исправлено в текущем состоянии

- фронтенд и backend снова собираются без TS-ошибок
- e2e обновлены под текущий auth/UI
- mock API больше не ломает deal detail
- quick create deal больше не сбрасывает введённый title при догрузке этапов
- плавающий AI-trigger больше не должен перекрывать drawer-кнопки сохранения
