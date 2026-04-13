# AUTHORIZATION_FEATURES

## 1. Назначение документа

Этот документ описывает рекомендуемую доработку авторизации владельца и сотрудников в текущем проекте `KORT-DEV-MODE` на основании фактического состояния репозитория.

Цель:

- дать разработке готовую техническую постановку;
- зафиксировать текущее состояние и реальные расхождения;
- предложить целевую архитектуру;
- приложить рекомендательные патчи живым кодом;
- закрыть сценарии:
  - смена email/пароля владельца без выбивания сотрудников;
  - понятный вход сотрудника по телефону;
  - первичная установка пароля сотрудником;
  - корректная связка прав и отображения интерфейса;
  - перенос блока Чапана в отдельный раздел "Дополнительный модуль";
  - защита от несанкционированного захода в модули через URL, canvas и ярлыки.

## 2. На чём основан анализ

Анализ выполнен по текущему фронтенду и тестам проекта.

Ключевые файлы, на которых построены выводы:

- `src/features/auth/AuthModal.tsx`
- `src/features/auth/SetPasswordStep.tsx`
- `src/shared/stores/auth.ts`
- `src/shared/hooks/useRole.ts`
- `src/shared/hooks/useEmployeePermissions.ts`
- `src/shared/hooks/useChapanPermissions.ts`
- `src/features/auth/EmployeePanel.tsx`
- `src/features/auth/AddEmployeeModal.tsx`
- `src/features/auth/EmployeeDetailModal.tsx`
- `src/features/auth/ChangeCredentialsPanel.tsx`
- `src/pages/settings/index.tsx`
- `src/pages/workzone/chapan/settings/ChapanSettings.tsx`
- `src/app/router/index.tsx`
- `src/shared/navigation/appNavigation.ts`
- `src/pages/canvas/index.tsx`
- `src/features/workspace/components/WorkspaceAddMenu.tsx`
- `src/features/workspace/components/WorkspaceTile.tsx`
- `src/entities/order/api.ts`
- `src/entities/order/queries.ts`
- `tests/e2e/settings-guards.spec.ts`
- `tests/e2e/auth-real-flow.spec.ts`
- `tests/e2e/auth-regression.spec.ts`

Важно:

- в текущем snapshot backend-реализация в каталоге `server/` фактически отсутствует;
- поэтому backend-патчи ниже являются контрактными и рекомендательными, а не точным diff по серверным файлам.

## 3. Фактическое состояние проекта сейчас

### 3.1. Что уже есть

В проекте уже реализованы важные части сценария:

- логин поддерживает email или телефон: `src/features/auth/AuthModal.tsx`;
- есть `FirstLoginResponse` и шаг `set-password`: `src/shared/api/contracts.ts`, `src/features/auth/SetPasswordStep.tsx`;
- сотрудник уже может быть создан через `/company/employees/`;
- есть статусы сотрудника `active | pending_first_login | dismissed`;
- есть UI назначения прав сотруднику;
- есть отдельные permission-hook'и:
  - `useEmployeePermissions`
  - `useChapanPermissions`
- есть маршруты с базовой защитой по:
  - факту авторизации;
  - наличию membership;
  - тарифному плану.

### 3.2. Что уже частично совпадает с вашим сценарием

- Первый вход сотрудника концептуально уже предусмотрен.
- После `set-password` UI уже требует повторный вход.
- Смена email владельца уже частично задумана.
- Права Чапана уже частично вынесены в отдельные permission-ключи.

### 3.3. Что сейчас не собрано в цельную систему

1. Вход сотрудника по телефону есть только на уровне API-идеи, но UX не доведён до сценария "галочка -> сначала телефон -> потом пароль или установка пароля".
2. Смена credentials владельца размазана по нескольким местам и endpoints.
3. Защита модулей на уровне маршрутов и canvas не доведена до реального permission-based access control.
4. Permission-списки задублированы в нескольких компонентах.
5. Есть смешение понятий:
   - владелец;
   - admin по membership;
   - employee с `full_access`.

## 4. Критичные расхождения и риски

### 4.1. Смена email/пароля владельца реализована дублирующимся и противоречивым образом

Сейчас в коде есть сразу несколько вариантов:

- `src/features/auth/ChangeCredentialsPanel.tsx`
  - не используется вообще;
  - шлёт запрос в `/auth/change-credentials/`;
- `src/pages/workzone/chapan/settings/ChapanSettings.tsx`
  - умеет менять пароль через `/auth/change-password`;
  - умеет менять email через `/users/me/change-email`.

Проблемы:

- нет единой точки входа;
- глобальная смена credentials владельца почему-то живёт внутри настроек модуля Чапан;
- отсутствует единый backend-контракт ревокации только сессий владельца.

### 4.2. Есть потенциальная критическая уязвимость прав

В `src/pages/workzone/chapan/settings/ChapanSettings.tsx` в `AccountTab` email владельца разрешён не только владельцу, а любому пользователю с `isAbsolute`.

Сейчас `isAbsolute` в `src/shared/hooks/useEmployeePermissions.ts` означает:

- owner;
- или employee с permission `full_access`.

То есть сотрудник с `full_access` сейчас концептуально попадает в ту же ветку, что и владелец, и может получить UI смены email владельца. Это нужно закрыть обязательно.

Правильное правило:

- смена owner email доступна только `user.is_owner === true`;
- `full_access` не должен давать право менять owner identity.

### 4.3. Route guards не защищают модули по employee permissions

`src/app/router/index.tsx` защищает страницы только по:

- `RequireAuth`
- `RequireOrg`
- `RequirePlan`

Сейчас нет guards вида:

- `RequireSalesAccess`
- `RequireWarehouseAccess`
- `RequireChapanAccess`
- `RequireFinanceAccess`

Следствие:

- сотрудник может не видеть кнопку/ссылку в UI, но всё равно открыть модуль прямым URL;
- это особенно критично для `warehouse`, `production`, `finance`, `reports`, `documents`, `workzone/chapan`.

### 4.4. Canvas и ярлыки не ограничиваются employee permissions

Сейчас:

- `src/shared/navigation/appNavigation.ts`
- `src/pages/canvas/index.tsx`
- `src/features/workspace/components/WorkspaceAddMenu.tsx`
- `src/features/workspace/components/WorkspaceTile.tsx`

фильтруют доступ только по тарифному плану.

Следствие:

- сотрудник может создать ярлык недоступного модуля;
- плитка на canvas открывает маршрут прямым `navigate(definition.navTo)`;
- даже если боковое меню скрывает модуль, canvas остаётся обходным путём.

Это напрямую подтверждает ваш пункт `1.5`.

### 4.5. Права сотрудника описаны в трёх местах

Дублирование списков permission-ключей есть минимум в:

- `src/features/auth/AddEmployeeModal.tsx`
- `src/features/auth/EmployeeDetailModal.tsx`
- `src/features/auth/employeePermissionOptions.ts`

Из-за этого любое изменение:

- текста;
- порядка;
- группировки;
- состава прав;

требует правки в нескольких местах и быстро начинает расходиться.

### 4.6. UX входа сотрудника не соответствует целевому бизнес-сценарию

Сейчас `AuthModal` требует заполнить логин и пароль сразу.

Но целевой сценарий другой:

- есть явный режим "Войти как сотрудник";
- сначала вводится телефон;
- если сотрудник активный, только потом показывается пароль;
- если это `pending_first_login`, система сразу переводит на установку пароля;
- остальной сайт до повторного логина недоступен.

Существующая реализация first-login полезна, но сейчас она встроена в обычный submit логина, а не в отдельный понятный поток.

### 4.7. Тестовое покрытие не закрывает ключевые риски

Сейчас есть только базовые проверки:

- регистрация компании;
- базовый логин;
- редирект в `set-password`.

Нет автоматических тестов на:

- смену email владельца;
- выбивание только владельца, но не сотрудников;
- запрет доступа к модулю по URL;
- запрет доступа к модулю через canvas shortcut;
- отображение прав без лагов при смене permission-набора;
- новый flow employee checkbox/lookup/password.

## 5. Целевая модель поведения

### 5.1. Владелец: смена email и пароля

Требуемое поведение:

- владелец может сменить email;
- владелец может сменить пароль;
- после изменения текущая сессия владельца завершается;
- сотруднические сессии не трогаются;
- memberships компании не трогаются;
- данные компании не трогаются;
- повторный вход владельца выполняется уже по новым данным.

Принцип:

- credentials владельца принадлежат только конкретному user;
- смена credentials не должна касаться компании целиком;
- нельзя ревокать сессии по `company_id`, только по `user_id`.

### 5.2. Сотрудник: вход по телефону

Требуемое поведение:

1. На форме логина есть галочка `Войти как сотрудник`.
2. После включения:
   - поле email-логина становится полем телефона;
   - пароль скрывается;
   - кнопка меняет смысл на `Продолжить`.
3. Система проверяет номер:
   - если сотрудник не найден, показывает понятную ошибку;
   - если найден активный сотрудник, показывает поле пароля;
   - если найден сотрудник в `pending_first_login`, переводит на `set-password`.
4. После установки пароля:
   - сотрудник не получает полноценную рабочую сессию;
   - сотрудник выбрасывается на повторную авторизацию;
   - потом входит уже по номеру телефона и новому паролю.

### 5.3. Права и отображение UI

Требуемое поведение:

- один источник прав;
- одни и те же права определяют:
  - видимость меню;
  - видимость ярлыков canvas;
  - доступ к прямому URL;
  - доступ к действиям внутри модуля.

Правильная иерархия:

- owner;
- admin membership;
- employee permissions;
- module-specific permissions;
- action-specific permissions.

### 5.4. Блок Чапана в правах

Требуемое поведение:

- основные права системы идут первыми;
- весь блок Чапана переносится вниз;
- новый заголовок: `Дополнительный модуль`;
- внутри него уже перечисляются Чапан-права и ограничения.

### 5.5. Защита от обходов

Нужно исключить обходы через:

- прямой URL;
- canvas;
- shortcut tile;
- mobile menu;
- sidebar;
- deep-link из другого модуля;
- сохранённые старые ярлыки в persisted workspace.

## 6. Рекомендуемая целевая архитектура

### 6.1. Разделить три независимые сущности

1. `Identity`
   - email
   - password hash
   - phone
   - credential version

2. `Membership`
   - company
   - role
   - membership status

3. `Employee profile / permissions`
   - department
   - account status
   - permission set

Смена owner email/пароля должна менять только `Identity`.

### 6.2. Session invalidation model

Нужна схема:

- `users.credential_version`
- `refresh_tokens.user_id`
- `refresh_tokens.revoked_at`
- `refresh_tokens.credential_version_snapshot`

При смене owner email/пароля:

- обновляется user;
- `credential_version += 1`;
- ревокаются только refresh-токены этого owner;
- access-токены старой версии перестают быть валидны;
- employee sessions не затрагиваются.

### 6.3. Employee auth state machine

Рекомендуемые состояния:

- `active`
- `pending_first_login`
- `dismissed`
- опционально `locked`

Переходы:

- `create employee -> pending_first_login`
- `first password set -> active`
- `reset password by admin -> pending_first_login`
- `dismiss employee -> dismissed`

### 6.4. Единый access layer на фронте

Нужен единый hook, например:

- `useModuleAccess()`

Он должен собирать в одном месте:

- owner/admin logic;
- employee permissions;
- Chapan permissions;
- membership status;
- org plan.

И именно он должен использоваться:

- в router guards;
- в sidebar;
- в mobile nav;
- в canvas shortcut list;
- в tile click navigate;
- в module screens.

## 7. Backend: рекомендуемые изменения

### 7.1. Рекомендуемые поля и ограничения БД

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_e164 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS credential_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(32) NOT NULL DEFAULT 'active';

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_e164_unique_idx
  ON users (phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  family_id UUID NOT NULL,
  credential_version_snapshot INTEGER NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL
);
```

Если employee-права хранятся отдельно, нужен явный профиль:

```sql
CREATE TABLE IF NOT EXISTS company_employees (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  department TEXT NOT NULL,
  account_status VARCHAR(32) NOT NULL DEFAULT 'pending_first_login',
  added_by_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 7.2. Рекомендуемый API-контракт

#### Owner identity

```http
POST /auth/change-password
POST /users/me/change-email
```

Ответ:

```json
{
  "ok": true,
  "requires_relogin": true
}
```

Важно:

- эти endpoints должны менять только текущего пользователя;
- они не должны трогать employee-модели компании;
- они не должны инвалидировать чужие refresh-токены.

#### Employee lookup

Рекомендуется добавить отдельный pre-auth endpoint:

```http
POST /auth/employee/lookup
```

Запрос:

```json
{
  "phone": "+77011234567"
}
```

Ответ для активного сотрудника:

```json
{
  "found": true,
  "account_status": "active",
  "requires_password": true,
  "full_name": "Иван Иванов"
}
```

Ответ для первичного входа:

```json
{
  "found": true,
  "account_status": "pending_first_login",
  "requires_password": false,
  "full_name": "Иван Иванов",
  "temp_token": "short-lived-first-login-token"
}
```

Ответ для неизвестного номера:

```json
{
  "found": false
}
```

#### Employee login

Обычный вход сотрудника:

```http
POST /auth/login
```

Запрос:

```json
{
  "phone": "+77011234567",
  "password": "secret123",
  "auth_mode": "employee"
}
```

#### First password setup

```http
POST /auth/set-password
Authorization: Bearer <temp_token>
```

Запрос:

```json
{
  "new_password": "secret123",
  "confirm_password": "secret123"
}
```

Ответ:

```json
{
  "ok": true,
  "requires_login": true
}
```

### 7.3. Рекомендательная backend-реализация смены credentials владельца

```ts
async function changeOwnerEmail(userId: string, dto: { newEmail: string; currentPassword: string }) {
  const user = await usersRepo.findById(userId);
  if (!user) throw new UnauthorizedError();

  const passwordOk = await passwordService.verify(dto.currentPassword, user.passwordHash);
  if (!passwordOk) throw new ValidationError('Неверный текущий пароль');

  const normalizedEmail = dto.newEmail.trim().toLowerCase();
  await usersRepo.assertEmailFree(normalizedEmail, userId);

  await db.transaction(async (trx) => {
    await usersRepo.update(userId, {
      email: normalizedEmail,
      credentialVersion: user.credentialVersion + 1,
    }, trx);

    await refreshTokenRepo.revokeAllForUser(userId, trx);

    await auditRepo.write({
      actorUserId: userId,
      action: 'owner.email_changed',
      meta: { newEmail: normalizedEmail },
    }, trx);
  });

  return { ok: true, requires_relogin: true };
}
```

```ts
async function changePassword(userId: string, dto: { currentPassword: string; newPassword: string }) {
  const user = await usersRepo.findById(userId);
  if (!user) throw new UnauthorizedError();

  const passwordOk = await passwordService.verify(dto.currentPassword, user.passwordHash);
  if (!passwordOk) throw new ValidationError('Неверный текущий пароль');

  const nextHash = await passwordService.hash(dto.newPassword);

  await db.transaction(async (trx) => {
    await usersRepo.update(userId, {
      passwordHash: nextHash,
      credentialVersion: user.credentialVersion + 1,
    }, trx);

    await refreshTokenRepo.revokeAllForUser(userId, trx);
  });

  return { ok: true, requires_relogin: true };
}
```

Ключевое правило:

- никакой `revokeAllByCompany(companyId)` здесь быть не должно.

### 7.4. Рекомендательная backend-реализация первичного входа сотрудника

```ts
async function lookupEmployeeByPhone(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const employee = await employeeRepo.findActiveOrPendingByPhone(normalizedPhone);

  if (!employee) {
    return { found: false };
  }

  if (employee.accountStatus === 'pending_first_login') {
    const tempToken = await authTokens.issueFirstLoginToken({
      userId: employee.userId,
      employeeId: employee.id,
      companyId: employee.companyId,
      ttlSeconds: 300,
    });

    return {
      found: true,
      account_status: 'pending_first_login',
      requires_password: false,
      full_name: employee.fullName,
      temp_token: tempToken,
    };
  }

  return {
    found: true,
    account_status: 'active',
    requires_password: true,
    full_name: employee.fullName,
  };
}
```

```ts
async function setEmployeePassword(tempToken: string, dto: { newPassword: string; confirmPassword: string }) {
  const payload = await authTokens.verifyFirstLoginToken(tempToken);
  if (!payload) throw new UnauthorizedError();

  if (dto.newPassword !== dto.confirmPassword) {
    throw new ValidationError('Пароли не совпадают');
  }

  const passwordHash = await passwordService.hash(dto.newPassword);

  await db.transaction(async (trx) => {
    await usersRepo.update(payload.userId, {
      passwordHash,
      credentialVersion: db.raw('credential_version + 1'),
    }, trx);

    await employeeRepo.update(payload.employeeId, {
      accountStatus: 'active',
    }, trx);

    await refreshTokenRepo.revokeAllForUser(payload.userId, trx);
  });

  return { ok: true, requires_login: true };
}
```

### 7.5. Важное security-замечание по сценарию "только телефон"

Телефон без SMS/одноразового кода сам по себе слабый фактор.

Если бизнес настаивает именно на таком первом входе, минимум нужно добавить:

- rate limit на lookup и set-password;
- короткоживущий temp token;
- одноразовость temp token;
- audit trail;
- блокировку после нескольких попыток;
- запрет повторной установки пароля без reset со стороны администратора.

Рекомендация сильнее:

- при создании сотрудника генерировать одноразовый activation code;
- первый вход делать по `phone + activation_code`;
- после этого разрешать установить пароль.

Если это невозможно, документ ниже остаётся рабочим, но security будет объективно слабее.

## 8. Frontend: рекомендуемые изменения

### 8.1. Убрать дублирование owner credentials UI

Рекомендуемое решение:

- глобальную смену owner email/пароля оставить только в `Настройки -> Безопасность`;
- `src/features/auth/ChangeCredentialsPanel.tsx` либо:
  - оживить и встроить в `src/pages/settings/index.tsx`,
  - либо удалить как legacy;
- из `src/pages/workzone/chapan/settings/ChapanSettings.tsx` убрать смену owner email;
- смену обычного пароля сотрудника можно оставить в account-блоке модуля, но owner identity change туда не должна попадать.

Критично:

- в UI должно использоваться именно `useRole().isOwner`, а не `isAbsolute`.

#### Рекомендательный патч

```tsx
// src/pages/settings/index.tsx
import { ChangeCredentialsPanel } from '../../features/auth/ChangeCredentialsPanel';

function SecuritySection() {
  const { isOwner } = useRole();

  return (
    <>
      <div className={s.section}>
        {/* существующий PIN / trusted device блок */}
      </div>

      {isOwner && (
        <div className={s.section}>
          <div className={s.sectionHeader}>
            <div>
              <div className={s.sectionTitle}>Учётные данные владельца</div>
              <div className={s.sectionSubtitle}>
                Смена email и пароля владельца без влияния на сессии сотрудников.
              </div>
            </div>
          </div>
          <div className={s.sectionBody}>
            <ChangeCredentialsPanel />
          </div>
        </div>
      )}
    </>
  );
}
```

### 8.2. Перестроить AuthModal под явный employee mode

Нужно добавить состояние:

- `authMode = 'default' | 'employee'`
- `employeeProbeState = 'idle' | 'checking' | 'active' | 'pending_first_login'`

#### Рекомендательный патч по логике

```tsx
type AuthMode = 'default' | 'employee';

const [authMode, setAuthMode] = useState<AuthMode>('default');
const [employeeLookupDone, setEmployeeLookupDone] = useState(false);

async function submitEmployeeLookup() {
  const phone = normalizeKazakhPhone(loginIdentifier);
  if (!phone) {
    setError('Введите корректный номер телефона.');
    return;
  }

  setLoading(true);
  setError('');

  try {
    const probe = await api.post<{
      found: boolean;
      account_status?: 'active' | 'pending_first_login';
      requires_password?: boolean;
      full_name?: string;
      temp_token?: string;
    }>('/auth/employee/lookup/', { phone });

    if (!probe?.found) {
      setError('Сотрудник с таким номером не найден.');
      return;
    }

    if (probe.account_status === 'pending_first_login' && probe.temp_token) {
      setFirstLoginTempToken(probe.temp_token);
      setFirstLoginUserName(probe.full_name ?? '');
      setStep('set-password');
      return;
    }

    setLoginIdentifier(formatKazakhPhoneInput(phone));
    setEmployeeLookupDone(true);
  } catch (cause) {
    setError(readAuthError(cause, 'Не удалось проверить номер сотрудника.'));
  } finally {
    setLoading(false);
  }
}

async function submitLogin() {
  if (authMode === 'employee' && !employeeLookupDone) {
    await submitEmployeeLookup();
    return;
  }

  // дальше обычный submitLogin, но для employee передаётся auth_mode: 'employee'
}
```

#### Рекомендательный патч по UI

```tsx
<label className={styles.employeeToggle}>
  <input
    type="checkbox"
    checked={authMode === 'employee'}
    onChange={(event) => {
      const next = event.target.checked ? 'employee' : 'default';
      setAuthMode(next);
      setEmployeeLookupDone(false);
      setLoginPassword('');
      setError('');
    }}
  />
  <span>Войти как сотрудник</span>
</label>

<input
  className={styles.input}
  value={loginIdentifier}
  onChange={(e) => {
    const next = authMode === 'employee'
      ? formatKazakhPhoneInput(e.target.value)
      : e.target.value;
    setLoginIdentifier(next);
    setError('');
    if (authMode === 'employee') {
      setEmployeeLookupDone(false);
      setLoginPassword('');
    }
  }}
  placeholder={authMode === 'employee' ? 'Номер телефона' : 'Email или номер телефона'}
/>

{!(authMode === 'employee' && !employeeLookupDone) && (
  <PasswordField
    value={loginPassword}
    onChange={(v) => { setLoginPassword(v); setError(''); }}
    placeholder="Пароль"
    autoComplete="current-password"
  />
)}

<button type="submit" className={styles.primaryButton} disabled={loading}>
  {authMode === 'employee' && !employeeLookupDone
    ? (loading ? 'Проверяем...' : 'Продолжить')
    : (loading ? 'Входим...' : 'Войти')}
</button>
```

### 8.3. Вынести права в один конфиг и сгруппировать Чапан как "Дополнительный модуль"

Лучше всего заменить ручные массивы в `AddEmployeeModal` и `EmployeeDetailModal` на единый источник.

#### Рекомендательная структура

```ts
// src/features/auth/employeePermissionOptions.ts
import type { EmployeePermission } from '../../shared/api/contracts';

export interface EmployeePermissionGroup {
  id: 'core' | 'additional-module';
  title: string;
  items: Array<{
    key: EmployeePermission;
    label: string;
    description: string;
  }>;
}

export const EMPLOYEE_PERMISSION_GROUPS: EmployeePermissionGroup[] = [
  {
    id: 'core',
    title: 'Основные права',
    items: [
      { key: 'full_access', label: 'Полный доступ', description: 'Все разделы системы.' },
      { key: 'financial_report', label: 'Финансы и отчёты', description: 'Финансовые данные и выгрузки.' },
      { key: 'sales', label: 'Продажи', description: 'Лиды, сделки, клиенты, задачи.' },
      { key: 'production', label: 'Производство', description: 'Производственные разделы.' },
      { key: 'warehouse_manager', label: 'Склад', description: 'Складской модуль.' },
      { key: 'observer', label: 'Наблюдатель', description: 'Только просмотр разрешённых разделов.' },
    ],
  },
  {
    id: 'additional-module',
    title: 'Дополнительный модуль',
    items: [
      { key: 'chapan_full_access', label: 'Чапан: полный доступ', description: 'Все разделы модуля Чапан.' },
      { key: 'chapan_access_orders', label: 'Чапан: Заказы', description: 'Список и карточки заказов.' },
      { key: 'chapan_access_production', label: 'Чапан: Производство', description: 'Производственный контур Чапана.' },
      { key: 'chapan_access_ready', label: 'Чапан: Готово', description: 'Готовые заказы.' },
      { key: 'chapan_access_archive', label: 'Чапан: Архив', description: 'Архив Чапана.' },
      { key: 'chapan_access_warehouse_nav', label: 'Чапан: Ссылка на Склад', description: 'Переход на склад из Чапана.' },
      { key: 'chapan_manage_production', label: 'Чапан: Управление производством', description: 'Назначение исполнителей и этапов.' },
      { key: 'chapan_confirm_invoice', label: 'Чапан: Подтверждение накладных', description: 'Подтверждение отправок.' },
      { key: 'chapan_manage_settings', label: 'Чапан: Настройки модуля', description: 'Настройки Чапана.' },
    ],
  },
];
```

Дальше `AddEmployeeModal` и `EmployeeDetailModal` просто рендерят группы по порядку.

### 8.4. Ввести единый модульный access matrix

#### Рекомендательный hook

```ts
// src/shared/hooks/useModuleAccess.ts
import { useCapabilities } from './useCapabilities';
import { useEmployeePermissions } from './useEmployeePermissions';
import { useChapanPermissions } from './useChapanPermissions';

export function useModuleAccess() {
  const caps = useCapabilities();
  const employee = useEmployeePermissions();
  const chapan = useChapanPermissions();

  const hasOrg = caps.hasCompanyAccess;

  return {
    canAccessLeads: hasOrg && employee.canAccessSales,
    canAccessCustomers: hasOrg && employee.canAccessSales,
    canAccessDeals: hasOrg && employee.canAccessSales && caps.isAdvanced,
    canAccessTasks: hasOrg && employee.canAccessSales && caps.isAdvanced,
    canAccessWarehouse: hasOrg && employee.canAccessWarehouse,
    canAccessProduction: hasOrg && employee.canAccessProduction && caps.isAdvanced,
    canAccessFinance: hasOrg && employee.canAccessFinancial && caps.isAdvanced,
    canAccessReports: hasOrg && employee.canAccessFinancial && caps.isAdvanced,
    canAccessDocuments: hasOrg && employee.canAccessFinancial && caps.isAdvanced,
    canAccessEmployees: hasOrg && employee.canManageTeam && caps.isAdvanced,
    canAccessChapan: hasOrg && chapan.hasAnyAccess && caps.isIndustrial,
  };
}
```

Примечание:

- mapping можно скорректировать под фактическую бизнес-матрицу;
- важен сам принцип единого центра принятия решения.

### 8.5. Добавить route guards по модульным правам

#### Рекомендательный патч

```tsx
// src/app/router/index.tsx
function RequireModuleAccess({
  allowed,
  children,
}: {
  allowed: boolean;
  children: ReactNode;
}) {
  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

```tsx
function ProtectedWarehouseRoute() {
  const access = useModuleAccess();
  return (
    <RequireAuth>
      <RequireOrg>
        <RequireModuleAccess allowed={access.canAccessWarehouse}>
          <WarehousePage />
        </RequireModuleAccess>
      </RequireOrg>
    </RequireAuth>
  );
}
```

Аналогично должны быть защищены:

- `/crm/leads`
- `/crm/customers`
- `/crm/deals`
- `/crm/tasks`
- `/warehouse`
- `/production`
- `/finance`
- `/reports`
- `/documents`
- `/employees`
- `/workzone/chapan/*`

### 8.6. Ограничить sidebar, mobile nav и canvas по тем же правам

Сейчас навигация режется только по плану. Нужно дополнительно резать по permission matrix.

#### Рекомендательный патч для canvas меню

```tsx
// src/features/workspace/components/WorkspaceAddMenu.tsx
const access = useModuleAccess();

function canUseWidget(kind: WorkspaceWidgetKind) {
  switch (kind) {
    case 'leads': return access.canAccessLeads;
    case 'customers': return access.canAccessCustomers;
    case 'deals': return access.canAccessDeals;
    case 'tasks': return access.canAccessTasks;
    case 'warehouse': return access.canAccessWarehouse;
    case 'production': return access.canAccessProduction;
    case 'finance': return access.canAccessFinance;
    case 'employees': return access.canAccessEmployees;
    case 'reports': return access.canAccessReports;
    case 'documents': return access.canAccessDocuments;
    case 'chapan': return access.canAccessChapan;
    default: return false;
  }
}

const visibleWidgets = WORKSPACE_WIDGETS.filter((widget) =>
  planIncludes(plan, widget.planTier) && canUseWidget(widget.kind),
);
```

#### Рекомендательный патч для tile click hardening

```tsx
// src/features/workspace/components/WorkspaceTile.tsx
import { toast } from 'sonner';
import { useModuleAccess } from '../../../shared/hooks/useModuleAccess';

const access = useModuleAccess();

function canOpenTile(kind: WorkspaceWidgetKind) {
  // тот же switch, что и в WorkspaceAddMenu
}

function onPointerUp(e: React.PointerEvent) {
  if (!dragStart.current) return;
  e.stopPropagation();

  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const wasDragging = hasDragged.current;
  dragStart.current = null;
  hasDragged.current = false;
  setDragging(false);

  if (!wasDragging) {
    if (!canOpenTile(tile.kind)) {
      toast.error('У вас нет доступа к этому разделу.');
      return;
    }

    navigate(definition.navTo);
  }
}
```

#### Обязательное дополнение

Нужно также чистить сохранённые старые ярлыки после логина/смены прав:

```ts
// рекомендательно: pruneTilesByAccess()
// вызывается после bootstrap / syncSession / смены permissions
```

Иначе пользователь может сохранить shortcut раньше, а потом открыть его после урезания прав.

### 8.7. Ужесточить Chapan permissions на уровне маршрутов, а не только меню

Сейчас `ChapanShell` скрывает часть навигации, но route-level защит нет.

Нужно:

- запретить открывать `orders`, `production`, `ready`, `archive`, `invoices` по прямому URL без соответствующих флагов;
- запретить переход на `warehouse` из Чапана без `chapan_access_warehouse_nav` или warehouse permission;
- не полагаться на скрытие кнопки как на защиту.

### 8.8. Исправить owner-only email change в ChapanSettings

Если account tab для Чапана сохраняется, нужно минимум:

```tsx
// src/pages/workzone/chapan/settings/ChapanSettings.tsx
import { useRole } from '../../../../shared/hooks/useRole';

export default function ChapanSettingsPage() {
  const { isOwner } = useRole();
  const { isAbsolute } = useEmployeePermissions();

  // isAbsolute остаётся для owner/admin-like settings Чапана,
  // но email change завязан только на isOwner
  return <AccountTab canChangeOwnerEmail={isOwner} canEditAccount={isAbsolute} />;
}
```

Правило:

- `full_access` employee не равен owner identity.

## 9. Рекомендуемый refactor по файлам

### Обязательно изменить

- `src/features/auth/AuthModal.tsx`
- `src/features/auth/SetPasswordStep.tsx`
- `src/features/auth/AddEmployeeModal.tsx`
- `src/features/auth/EmployeeDetailModal.tsx`
- `src/pages/settings/index.tsx`
- `src/pages/workzone/chapan/settings/ChapanSettings.tsx`
- `src/app/router/index.tsx`
- `src/pages/canvas/index.tsx`
- `src/features/workspace/components/WorkspaceAddMenu.tsx`
- `src/features/workspace/components/WorkspaceTile.tsx`
- `src/shared/navigation/appNavigation.ts`
- `src/shared/hooks/useEmployeePermissions.ts`
- `src/shared/hooks/useChapanPermissions.ts`

### Добавить

- `src/shared/hooks/useModuleAccess.ts`
- при необходимости `src/shared/security/moduleAccess.ts`

### Удалить или деактивировать legacy

- `src/features/auth/ChangeCredentialsPanel.tsx` как unused legacy, если его не будут переиспользовать;
- либо наоборот сделать его единственной реализацией owner credentials UI.

## 10. Тестовый план

### 10.1. Unit / integration

- `useModuleAccess` корректно вычисляет доступ для:
  - owner
  - admin
  - employee sales
  - employee warehouse
  - employee observer
  - employee chapan-only
- `useRole` не подменяет owner на `full_access`.
- `useEmployeePermissions` не даёт `full_access` менять owner identity.
- `resolvePostAuthPath` корректно ведёт pending employee в auth-flow, а не в рабочие модули.

### 10.2. E2E сценарии, которые обязательно добавить

1. Владелец меняет email:
   - текущая owner-сессия завершается;
   - повторный вход только с новым email;
   - employee-сессия в другом браузере не ломается.

2. Владелец меняет пароль:
   - текущая owner-сессия завершается;
   - employee-сессии продолжают жить.

3. Сотрудник `pending_first_login`:
   - включает `Войти как сотрудник`;
   - вводит телефон;
   - попадает в `set-password`;
   - после сохранения возвращается на логин;
   - заходит по номеру и новому паролю.

4. Сотрудник без warehouse-права:
   - не видит `Склад` в sidebar;
   - не видит `Склад` в canvas add menu;
   - не может открыть `/warehouse` вручную;
   - старый warehouse shortcut не открывается.

5. Сотрудник без Chapan warehouse-nav:
   - не видит переход на `Склад` из Чапана;
   - прямой заход в warehouse из deep-link запрещён.

6. Permission update:
   - owner меняет права сотруднику;
   - после refresh сотрудник видит актуальный UI;
   - прямые URL тоже ведут себя в соответствии с новыми правами.

### 10.3. Рекомендательный Playwright skeleton

```ts
test('employee without warehouse permission cannot open warehouse from URL or canvas', async ({ page }) => {
  await loginAsEmployee(page, '+77011234567', 'secret123');

  await page.goto('/warehouse');
  await expect(page).not.toHaveURL(/\/warehouse$/);

  await page.goto('/');
  await page.getByRole('button', { name: /Добавить ярлык/i }).click();
  await expect(page.getByText('Склад')).toHaveCount(0);
});
```

```ts
test('owner email change logs out only owner session', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const employeeContext = await browser.newContext();

  const ownerPage = await ownerContext.newPage();
  const employeePage = await employeeContext.newPage();

  await loginAsOwner(ownerPage, 'owner@demo.kz', 'secret123');
  await loginAsEmployee(employeePage, '+77011234567', 'secret123');

  await ownerPage.goto('/settings/security');
  await ownerPage.getByPlaceholder('Новый email').fill('owner2@demo.kz');
  await ownerPage.getByRole('button', { name: /Подтвердить/i }).click();

  await expect(ownerPage).toHaveURL(/\/auth\/login$/);
  await expect(employeePage).not.toHaveURL(/\/auth\/login$/);
});
```

## 11. Рекомендуемый порядок реализации

### Этап 1. Безопасность и архитектура

- унифицировать owner credential endpoints;
- убрать owner email change из employee/full_access веток;
- внедрить `credential_version` и targeted session revoke.

### Этап 2. Employee login UX

- добавить checkbox `Войти как сотрудник`;
- добавить `employee lookup`;
- встроить first-login без обязательного ввода пароля на первом шаге.

### Этап 3. Permission hardening

- ввести `useModuleAccess`;
- закрыть route guards;
- закрыть sidebar/mobile/canvas/tiles.

### Этап 4. Permission editor cleanup

- единый конфиг прав;
- вынести Чапан в `Дополнительный модуль`.

### Этап 5. Тесты

- e2e для owner identity change;
- e2e для employee first-login;
- e2e для route/url/canvas hardening.

## 12. Итоговая сводка для разработки

Ниже коротко, что именно нужно сделать без дополнительной аналитики:

1. Сделать единую owner identity flow в глобальных настройках, не в Чапане.
2. Смена owner email/пароля должна инвалидировать только owner session.
3. Вход сотрудника перевести в двухфазный flow:
   - телефон;
   - либо пароль,
   - либо установка пароля.
4. После первичной установки пароля сотрудник обязан войти заново.
5. Права должны быть единым источником истины для:
   - UI,
   - router,
   - canvas,
   - deep links.
6. Чапан-права перенести в отдельную группу `Дополнительный модуль`.
7. Добавить route hardening и shortcut hardening.
8. Закрыть уязвимость, где `full_access` employee может попасть в owner email change flow.
9. Удалить или интегрировать legacy `ChangeCredentialsPanel`.
10. Добавить e2e на owner logout only, employee first-login и permission bypass cases.

## 13. Решение по приоритету

Если делать только критический минимум в первую очередь, то приоритет такой:

1. Закрыть owner email change у `full_access` employees.
2. Сделать targeted revoke только owner sessions.
3. Добавить route guards по employee permissions.
4. Закрыть canvas/shortcut bypass.
5. Уже потом перестраивать красивый employee login UX.

Это даст максимальный эффект по безопасности и предсказуемости системы в кратчайший срок.
