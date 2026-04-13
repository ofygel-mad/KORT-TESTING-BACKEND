# Deploy На Railway

Актуальная схема для этого проекта:

1. `frontend repo` = текущий репозиторий `KORT-DEV-MODE`
2. `backend repo` = отдельный репозиторий `KORT-BACKEND`
3. `postgres service` = база данных в Railway

То есть теперь деплой делается не из монорепозитория, а из двух отдельных репозиториев.

## Что получится в итоге

В одном Railway Project будут жить 3 сервиса:

- `frontend`
  - собирается из репозитория `KORT-DEV-MODE`
  - отдаёт сайт пользователю
- `backend`
  - собирается из репозитория `KORT-BACKEND`
  - отдаёт API на `/api/v1/*`
- `postgres`
  - хранит данные приложения

## Почему эта схема проще

Потому что теперь:

- один репозиторий = один сервис
- не нужен `Root Directory`
- не нужно разделять один GitHub repo на два Railway service
- не нужно объяснять Railway, где фронт, а где бэк

## Какие репозитории должны быть

## 1. Frontend repo

Это текущий репозиторий:

- `KORT-DEV-MODE`

Он должен содержать:

- `src/`
- `public/`
- `package.json`
- `railway.toml`
- `vite.config.ts`
- весь фронтенд-код

## 2. Backend repo

Это отдельный репозиторий:

- `KORT-BACKEND`

В корне этого репозитория должно лежать то, что раньше было внутри папки `server/`.

То есть структура `KORT-BACKEND` должна быть такой:

```text
KORT-BACKEND/
├─ src/
├─ prisma/
├─ scripts/
├─ package.json
├─ pnpm-lock.yaml
├─ tsconfig.json
├─ railway.toml
├─ .env.example
└─ ...
```

Важно:

- в `KORT-BACKEND` не должно быть дополнительного уровня `server/`
- `package.json` backend должен лежать в корне backend repo
- `railway.toml` backend должен лежать тоже в корне backend repo

## Что уже должно быть в backend repo

У backend repo должны быть:

- `src/config.ts`
- `src/app.ts`
- `src/index.ts`
- `prisma/schema.prisma`
- `package.json`
- `railway.toml`

## Переменные окружения

Ниже сначала объяснение, а потом будет блок "сделай как по шаблону", который можно просто повторить в Railway.

## Frontend

Во frontend service нужны:

- `VITE_API_BASE_URL`

Опционально:

- `VITE_SENTRY_DSN`

Не нужны:

- `VITE_MOCK_API=true`
- `VITE_PROXY_TARGET`

### Пример frontend env

```env
VITE_API_BASE_URL=https://<backend-domain>/api/v1
VITE_SENTRY_DSN=
```

## Backend

## Backend

Во backend service нужны:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`

Опционально:

- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `CONSOLE_SERVICE_PASSWORD`

### Пример backend env

```env
DATABASE_URL=postgresql://postgres:***@postgres.railway.internal:5432/railway
JWT_ACCESS_SECRET=replace_me_with_long_random_secret_1
JWT_REFRESH_SECRET=replace_me_with_long_random_secret_2
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ORIGIN=https://<frontend-domain>
CONSOLE_SERVICE_PASSWORD=optional
```

## Готовый шаблон Railway Variables

Ниже инструкция в максимально прямом виде.

## 1. Что открыть в Railway

У тебя будет 3 сервиса:

- `Postgres`
- `backend` из репозитория `KORT-BACKEND`
- `frontend` из репозитория `KORT-DEV-MODE`

Переменные ставятся не в проект целиком, а в конкретный сервис.

То есть:

- backend variables ставишь в `backend service`
- frontend variables ставишь в `frontend service`

## 2. Что ставить в backend service

Открой:

`Railway -> твой project -> backend service -> Variables`

Добавь там **ровно эти переменные**.

### Backend: обязательно

```env
DATABASE_URL=<сюда вставить DATABASE_URL из Postgres service>
JWT_ACCESS_SECRET=<сюда вставить длинный случайный секрет №1>
JWT_REFRESH_SECRET=<сюда вставить длинный случайный секрет №2>
CORS_ORIGIN=https://example.com
```

### Backend: очень желательно

```env
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
NODE_ENV=production
HOST=0.0.0.0
```

### Backend: опционально

```env
CONSOLE_SERVICE_PASSWORD=kortdev1234
```

Если хочешь входить на production сайте через консольную команду:

```text
access "твой-пароль"
```

то `CONSOLE_SERVICE_PASSWORD` для backend service фактически становится обязательной.

### Что означает каждая backend variable

`DATABASE_URL`

- берёшь из `Postgres service`
- не придумываешь руками
- не ставишь localhost

`JWT_ACCESS_SECRET`

- любой длинный случайный текст
- лучше 32+ символов

`JWT_REFRESH_SECRET`

- ещё один другой длинный случайный текст
- не должен совпадать с `JWT_ACCESS_SECRET`

`CORS_ORIGIN`

- временно можешь поставить:

```env
CORS_ORIGIN=https://example.com
```

- потом, когда frontend получит свой реальный Railway domain, обязательно замени на него

Например:

```env
CORS_ORIGIN=https://kort-frontend-production.up.railway.app
```

`CONSOLE_SERVICE_PASSWORD`

- пароль для сервисного входа через консоль на production сайте
- если эта переменная не задана в backend, команда `access "..."` не сможет авторизовать тебя через backend
- если база на Railway пустая, первый успешный `access "..."` автоматически создаст demo owner + demo company
- пример:

```env
CONSOLE_SERVICE_PASSWORD=kortdev1234
```

### Что это даёт на production

Если в backend service задано:

```env
CONSOLE_SERVICE_PASSWORD=kortdev1234
```

то на production сайте ты можешь открыть встроенную консоль и выполнить:

```text
access "kortdev1234"
```

Если база пустая, backend сам создаст:


То есть после первого сервисного входа у тебя будет сразу 2 способа зайти:

- сервисный режим: `access "kortdev1234"`
- обычная авторизация: `admin@kort.local` / `demo1234`

## 3. Откуда взять `DATABASE_URL`

Открой:

`Railway -> твой project -> Postgres service -> Variables`

Там найди:

```env
DATABASE_URL
```

Скопируй **значение** и вставь это значение в:

`backend service -> Variables -> DATABASE_URL`

## 4. Как сгенерировать JWT секреты

Открой PowerShell и выполни:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Запусти команду 2 раза:

- первый результат -> `JWT_ACCESS_SECRET`
- второй результат -> `JWT_REFRESH_SECRET`

## 5. Что ставить в frontend service

Открой:

`Railway -> твой project -> frontend service -> Variables`

Добавь там:

```env
VITE_API_BASE_URL=https://<backend-domain>/api/v1
VITE_SENTRY_DSN=
```

### Что означает каждая frontend variable

`VITE_API_BASE_URL`

- это публичный URL backend
- обязательно с `/api/v1`
- не localhost
- не railway internal

Пример:

```env
VITE_API_BASE_URL=https://kort-backend-production.up.railway.app/api/v1
```

`VITE_SENTRY_DSN`

- можно пока оставить пустым
- нужна только если реально подключаешь Sentry

## 6. Что ставить сначала, если frontend домена ещё нет

Делай так:

### Сначала backend

В backend service поставь:

```env
DATABASE_URL=<из Postgres service>
JWT_ACCESS_SECRET=<секрет 1>
JWT_REFRESH_SECRET=<секрет 2>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
NODE_ENV=production
HOST=0.0.0.0
CORS_ORIGIN=https://example.com
CONSOLE_SERVICE_PASSWORD=kortdev1234
```

Потом задеплой backend.

### Потом frontend

Когда backend service уже получил public domain, поставь во frontend:

```env
VITE_API_BASE_URL=https://<backend-domain>/api/v1
VITE_SENTRY_DSN=
```

Потом задеплой frontend.

### Потом вернись в backend

Когда frontend service получил public domain, обнови в backend:

```env
CORS_ORIGIN=https://<frontend-domain>
```

И сделай redeploy backend.

## 7. Самый простой рабочий сценарий по шагам

### Шаг A. Postgres

В Postgres service ничего руками обычно не вводишь.  
Просто копируешь оттуда `DATABASE_URL`.

### Шаг B. Backend

Вставь в backend service:

```env
DATABASE_URL=<скопировать из Postgres>
JWT_ACCESS_SECRET=<секрет 1>
JWT_REFRESH_SECRET=<секрет 2>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
NODE_ENV=production
HOST=0.0.0.0
CORS_ORIGIN=https://example.com
CONSOLE_SERVICE_PASSWORD=kortdev1234
```

Потом жми redeploy.

### Шаг C. Проверка backend

Сгенерируй backend domain и открой:

```text
https://<backend-domain>/api/v1/health
```

Если видишь JSON со `status: ok`, backend жив.

### Шаг D. Frontend

Вставь в frontend service:

```env
VITE_API_BASE_URL=https://<backend-domain>/api/v1
VITE_SENTRY_DSN=
```

Потом жми redeploy.

### Шаг E. Финальный CORS

Когда frontend получил свой public domain, обнови backend:

```env
CORS_ORIGIN=https://<frontend-domain>
```

И снова redeploy backend.

## 8. Что **не надо** ставить

### Не ставь это во frontend

```env
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
CORS_ORIGIN
```

### Не ставь это в backend

```env
VITE_API_BASE_URL
VITE_SENTRY_DSN
```

### Не ставь в production frontend

```env
VITE_MOCK_API=true
VITE_PROXY_TARGET=http://localhost:8000
```

## 9. Готовый блок для копирования

## Backend service -> Variables

```env
DATABASE_URL=<PASTE_FROM_POSTGRES_SERVICE>
JWT_ACCESS_SECRET=<PASTE_RANDOM_SECRET_1>
JWT_REFRESH_SECRET=<PASTE_RANDOM_SECRET_2>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
NODE_ENV=production
HOST=0.0.0.0
CORS_ORIGIN=https://example.com
CONSOLE_SERVICE_PASSWORD=kortdev1234
```

## Frontend service -> Variables

```env
VITE_API_BASE_URL=https://<BACKEND_PUBLIC_DOMAIN>/api/v1
VITE_SENTRY_DSN=
```

## 10. После получения frontend домена

Замени в backend service:

```env
CORS_ORIGIN=https://<FRONTEND_PUBLIC_DOMAIN>
```

## Что означает каждая важная переменная

## `VITE_API_BASE_URL`

Это адрес backend API, который использует frontend в браузере.

Пример:

```env
VITE_API_BASE_URL=https://kort-backend-production.up.railway.app/api/v1
```

Важно:

- здесь нужен публичный backend URL
- не `localhost`
- не `railway.internal`

## `DATABASE_URL`

Это строка подключения backend к PostgreSQL.

Её ставят только в backend service.

Если база на Railway, это значение берётся из PostgreSQL service.

## `JWT_ACCESS_SECRET`

Секрет для access token.

Должен быть длинным и случайным.

## `JWT_REFRESH_SECRET`

Отдельный секрет для refresh token.

Не должен совпадать с `JWT_ACCESS_SECRET`.

## `CORS_ORIGIN`

Это домен frontend-сайта, которому backend разрешает браузерные запросы.

Пример:

```env
CORS_ORIGIN=https://kort-frontend-production.up.railway.app
```

Важно:

- только origin
- без `/api/v1`
- без завершающего `/`

## Порядок деплоя

Правильный порядок:

1. создать Railway Project
2. создать PostgreSQL service
3. создать backend service из `KORT-BACKEND`
4. задать backend env
5. дождаться backend deploy
6. сгенерировать backend public domain
7. создать frontend service из `KORT-DEV-MODE`
8. задать frontend env
9. дождаться frontend deploy
10. сгенерировать frontend public domain
11. обновить backend `CORS_ORIGIN` на frontend domain
12. redeploy backend
13. пройти smoke-проверку

## Пошагово

## Шаг 1. Создай Railway Project

1. Зайди в Railway
2. Нажми `New Project`
3. Создай новый проект

В этом проекте будут жить все три сервиса.

## Шаг 2. Создай PostgreSQL service

1. Нажми `Add`
2. Выбери `Database`
3. Выбери `PostgreSQL`

Дождись, пока сервис базы создастся.

## Шаг 3. Создай backend service

1. Нажми `Add`
2. Выбери `GitHub Repo`
3. Выбери репозиторий `KORT-BACKEND`

Так как backend теперь в отдельном репозитории, никаких `Root Directory` уже не нужно.

### Что проверить у backend

В backend service:

- repository = `KORT-BACKEND`
- config-as-code = `railway.toml` из корня backend repo

Если Railway сам подхватил `railway.toml`, это нормально.

## Шаг 4. Задай backend env

Открой backend service -> `Variables` и добавь:

```env
DATABASE_URL=<из postgres service>
JWT_ACCESS_SECRET=<длинный случайный секрет>
JWT_REFRESH_SECRET=<другой длинный случайный секрет>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ORIGIN=https://temporary-frontend-domain-or-later-update
CONSOLE_SERVICE_PASSWORD=<опционально>
```

### Как взять `DATABASE_URL`

1. Открой PostgreSQL service
2. Открой `Variables`
3. Найди `DATABASE_URL`
4. Скопируй значение
5. Вставь в backend service -> `Variables`

## Шаг 5. Дождись успешного backend deploy

Backend должен:

- собраться
- пройти миграции
- стартовать

После этого проверь логи.

## Шаг 6. Сгенерируй backend public domain

1. Открой backend service
2. Перейди в `Settings`
3. Найди `Networking`
4. Нажми `Generate Domain`

Получишь что-то вроде:

```text
https://kort-backend-production.up.railway.app
```

## Шаг 7. Проверь backend health

Открой:

```text
https://<backend-domain>/api/v1/health
```

Ожидаемый ответ:

```json
{
  "status": "ok",
  "ts": "..."
}
```

## Шаг 8. Создай frontend service

1. Нажми `Add`
2. Выбери `GitHub Repo`
3. Выбери репозиторий `KORT-DEV-MODE`

### Что проверить у frontend

В frontend service:

- repository = `KORT-DEV-MODE`
- config-as-code = `railway.toml` из корня frontend repo

Так как фронт теперь сам по себе, `Root Directory` тоже не нужен.

## Шаг 9. Задай frontend env

Открой frontend service -> `Variables` и добавь:

```env
VITE_API_BASE_URL=https://<backend-domain>/api/v1
VITE_SENTRY_DSN=
```

Пример:

```env
VITE_API_BASE_URL=https://kort-backend-production.up.railway.app/api/v1
```

## Шаг 10. Дождись frontend deploy

Frontend должен:

- собраться через Vite
- подняться как web service

## Шаг 11. Сгенерируй frontend public domain

1. Открой frontend service
2. Перейди в `Settings`
3. Открой `Networking`
4. Нажми `Generate Domain`

Получишь что-то вроде:

```text
https://kort-frontend-production.up.railway.app
```

## Шаг 12. Вернись в backend и обнови `CORS_ORIGIN`

Теперь backend уже знает настоящий frontend domain.

Открой backend service -> `Variables` и поставь:

```env
CORS_ORIGIN=https://<frontend-domain>
```

После этого сделай redeploy backend.

## Шаг 13. Финальная проверка

Проверь:

1. `https://<backend-domain>/api/v1/health`
2. открывается frontend domain
3. логин работает
4. нет CORS ошибок
5. создаётся клиент
6. создаётся сделка
7. редактируются карточки

## Если хочешь кастомный домен

Можно подключить свой домен отдельно:

- к frontend service
- при желании отдельно к backend service

После подключения кастомного frontend домена не забудь поменять:

```env
CORS_ORIGIN=https://<your-frontend-domain>
```

После подключения кастомного backend домена не забудь поменять:

```env
VITE_API_BASE_URL=https://<your-backend-domain>/api/v1
```

## Частые ошибки

## Ошибка 1. Во frontend поставили `DATABASE_URL`

Не нужно.  
Фронтенд не работает с PostgreSQL напрямую.

## Ошибка 2. В backend не поставили `DATABASE_URL`

Тогда Prisma не подключится к базе.

## Ошибка 3. В `VITE_API_BASE_URL` поставили `railway.internal`

Так нельзя. Браузер туда не достучится.

Нужен public domain backend.

## Ошибка 4. В `CORS_ORIGIN` указали backend домен

Нужно указывать frontend domain.

## Ошибка 5. В `CORS_ORIGIN` добавили `/api/v1`

Нельзя.

Нужно:

```text
https://frontend-domain
```

Не нужно:

```text
https://frontend-domain/api/v1
```

## Ошибка 6. Сначала задеплоили frontend без готового backend domain

Тогда фронт соберётся с неправильным `VITE_API_BASE_URL`.

Правильный порядок:

1. backend
2. backend domain
3. frontend
4. frontend domain
5. backend CORS update

## Короткая шпаргалка

## Backend service

- Repo: `KORT-BACKEND`
- Variables:

```env
DATABASE_URL=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CORS_ORIGIN=https://<frontend-domain>
```

## Frontend service

- Repo: `KORT-DEV-MODE`
- Variables:

```env
VITE_API_BASE_URL=https://<backend-domain>/api/v1
```

## Database service

- PostgreSQL на Railway
- источник `DATABASE_URL` для backend

## Ссылки

- Railway domains: https://docs.railway.com/networking/domains/working-with-domains
- Railway config as code: https://docs.railway.com/config-as-code/reference
- Railway projects/services: https://docs.railway.com/guides/projects



- owner: `admin@kort.local`
- пароль owner: `demo1234`
- компанию: `Demo Company`
- slug компании: `demo-company`