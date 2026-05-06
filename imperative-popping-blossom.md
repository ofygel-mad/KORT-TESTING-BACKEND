# Plan: KORT-TESTING-FRONTEND — Full Bug Fix & Audit

## Context

Тестовый проект расширял функциональность RELEASE_VERSION (каталог склада, фото товаров, новые поля заказа), но в процессе сломал несколько критических вещей:
1. Форма создания нового заказа не сбрасывается корректно и может физически не дать создать заказ
2. При скролле вниз появляется "нижняя пелена" — sticky-панель прилипает поверх контента
3. Z-index конфликты между модальными окнами и overlay-элементами
4. Кодировочные артефакты — системная проблема (PowerShell консоль сам выдаёт кракозябры), исходники в порядке (UTF-8 чистые)

---

## Critical Files

| Файл | Проблема |
|------|---------|
| `src/features/auth/pages/workzone/chapan/orders/ChapanNewOrder.tsx` | Баги reset-логики: строки 412-428, 475-489 |
| `src/features/auth/pages/workzone/chapan/orders/ChapanNewOrder.module.css` | `.formActions` sticky bottom — "нижняя пелена", строки ~1448-1456 |
| `src/features/auth/pages/workzone/chapan/archive/ChapanArchive.module.css` | `.modalOverlay` z-index: 40 — слишком низкий, строки ~147-157 |
| `src/app/layout/AppShell.module.css` | `.root` overflow: hidden — обрезает scroll-контекст, строка ~7 |
| `src/shared/design/globals.css` | Z-index токены — строки 544-554 (для справки) |

---

## Phase 1 — ChapanNewOrder.tsx: Fix Reset Logic (КРИТИЧНО)

### Bug 1 — `setBankCommissionPrefilled(true)` → `false` (строка 426)

**Файл:** `src/features/auth/pages/workzone/chapan/orders/ChapanNewOrder.tsx`

В функции `resetDraftState()` строка 426:
```ts
// БЫЛО (неверно):
setBankCommissionPrefilled(true);

// НАДО:
setBankCommissionPrefilled(false);
```

**Почему баг:** После нажатия "Сбросить черновик" флаг `bankCommissionPrefilled = true` навсегда блокирует авто-подстановку банковской комиссии из профиля. Пустая форма никогда не получит значение из `profile.bankCommissionPercent`.

---

### Bug 2 — `onSubmit` не сбрасывает `draftRestored` (строки 475-488)

После успешного создания заказа `setDraftRestored(false)` не вызывается. Добавить в блок сброса состояния в `onSubmit`:

```ts
// Добавить в конец блока сброса, перед navigate():
setDraftRestored(false);
```

---

### Bug 3 — Дублирование логики сброса

`resetDraftState()` и блок сброса в `onSubmit()` делают почти одно и то же. После фикса Bug 1 и Bug 2 — заменить дублированный блок в `onSubmit` вызовом `resetDraftState()`, убрав только `navigate()`:

```ts
// В onSubmit, вместо дублированного блока state-сброса:
idemKeyRef.current = crypto.randomUUID();
resetDraftState();
navigate('/workzone/chapan/orders');
```

Для этого `resetDraftState()` должна также ротировать idempotency key — либо оставить ротацию снаружи (как выше).

---

### Bug 4 — Kaspi QR guard запускается на каждый рендер (строки 500-508)

```ts
// Добавить флаг чтобы эффект сработал один раз при mount + изменении значения
// Текущий код корректен по логике, но тригерит лишние setValue на каждый рендер.
// Добавить условие:
useEffect(() => {
  if ((paymentMethod as string | undefined) === 'kaspi_qr') {
    setValue('paymentMethod', undefined);
  }
  if (paymentBreakdownWatch?.kaspi_qr !== undefined) {
    setValue('paymentBreakdown.kaspi_qr', undefined);
  }
}, [paymentMethod, paymentBreakdownWatch?.kaspi_qr, setValue]);
// Уже правильные deps — оставить как есть, просто убедиться что работает корректно.
// Этот баг низкоприоритетный, не блокирует функционал.
```

---

## Phase 2 — CSS: Fix "Нижняя пелена" (КРИТИЧНО)

### Bug 5 — `.formActions` sticky bottom создаёт overlay

**Файл:** `src/features/auth/pages/workzone/chapan/orders/ChapanNewOrder.module.css`

Найти класс `.formActions` (~строка 1448):

```css
/* БЫЛО (проблемный код): */
.formActions {
  position: sticky;
  bottom: calc(var(--bottom-nav-height, 60px) + env(safe-area-inset-bottom, 0px));
  background: var(--ch-bg, var(--bg-canvas));
  border-top: 1px solid var(--border-subtle);
  padding: 10px 12px;
  margin: 0 -12px;
  z-index: 10;
}

/* НАДО — убрать sticky, кнопки просто в конце формы: */
.formActions {
  background: var(--ch-bg, var(--bg-canvas));
  border-top: 1px solid var(--border-subtle);
  padding: 10px 12px;
  margin: 0 -12px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
```

**Почему:** `position: sticky` с `bottom: 60px` означает что панель "приклеивается" к точке 60px от низа viewport при скролле. На длинных формах это создаёт эффект пелены поверх контента. Кнопки "Отмена/Создать заказ" достаточно видны в конце формы без sticky.

---

## Phase 3 — CSS: Fix Z-index Issues

### Bug 6 — `.modalOverlay` в ChapanArchive с z-index: 40

**Файл:** `src/features/auth/pages/workzone/chapan/archive/ChapanArchive.module.css`

Найти `.modalOverlay` (~строка 147):
```css
/* БЫЛО: */
z-index: 40;

/* НАДО: */
z-index: var(--z-modal-overlay);  /* = 1000 из globals.css */
```

**Почему:** z-index: 40 ниже чем sidebar (100), topbar (90), drawer (200) — модальное окно может "проваливаться" под эти элементы.

---

### Bug 7 — AppShell `overflow: hidden` обрезает scroll

**Файл:** `src/app/layout/AppShell.module.css`

Найти `.root` (~строка 2):
```css
/* БЫЛО: */
.root {
  overflow: hidden;
  ...
}

/* НАДО — убрать overflow: hidden с корневого контейнера: */
.root {
  /* overflow: hidden  ← убрать эту строку */
  ...
}
```

**Почему:** `overflow: hidden` на корневом элементе создаёт новый stacking context и обрезает любые fixed/sticky дочерние элементы. Скролл должен контролироваться `.main` контейнером, не root.

---

## Phase 4 — Encoding Investigation

**Вердикт по исходникам:** Grep поиск UTF-8 replacement characters (U+FFFD) и последовательностей `?{3,}` в `src/**/*.ts(x)` — результатов не дал. Исходные файлы чистые.

**Что нужно проверить вручную при запуске Docker:**

1. **Backend response headers:** В DevTools → Network → любой API запрос → Response Headers должен быть `Content-Type: application/json; charset=utf-8`. Если нет — добавить в Express/Fastify middleware:
   ```ts
   res.setHeader('Content-Type', 'application/json; charset=utf-8');
   ```

2. **PostgreSQL connection string на Railway:** Убедиться что connection URL содержит параметр кодировки или Prisma datasource не использует `LC_COLLATE` отличный от UTF-8.

3. **Prisma schema:** Проверить что `datasource db { url = env("DATABASE_URL") }` — Railway PostgreSQL по умолчанию UTF-8, но если БД создавалась вручную, может быть другая кодировка.

4. **Vite build:** `vite.config.ts` не требует изменений — Vite по умолчанию генерирует UTF-8 бандл.

---

## Phase 5 — Warehouse Catalog API Guard (ОСТОРОЖНО)

`useOrderFormCatalog()` и `useCatalogDefinitions()` вызываются внутри `ChapanNewOrder` — если эти эндпоинты отсутствуют или падают на тестовом бэкенде, React Query поглотит ошибку тихо (data = undefined). Форма продолжит работать т.к. код использует `?? []` fallback:

```ts
const globalWarehouseColors = fieldDefinitions?.find(...)?.options ?? [];
```

**Вердикт:** Не блокируют создание заказа. Но при запуске Docker — проверить в DevTools что `/warehouse/order-form/catalog` и `/warehouse/catalog/definitions` возвращают 200 или 404 (не 500).

---

## Verification

После всех изменений:

1. `npm run dev` → открыть `/workzone/chapan/orders/new`
2. Заполнить форму: ФИО, телефон (+7...), добавить позицию (модель + размер)
3. Нажать "Создать заказ" → должен создаться и перейти на список
4. Вернуться в "Новый заказ" → если был черновик — появится баннер "Восстановлен черновик"
5. Нажать "Сбросить" → форма полностью очищается, банковская комиссия подтягивается из профиля снова
6. Скроллить вниз на длинной форме → кнопки "Отмена/Создать" не должны прилипать и закрывать контент
7. Открыть архив → модальное окно должно полностью перекрывать контент под ним

---

## Execution Order

1. `ChapanNewOrder.tsx` — Bug 1 (строка 426: `false`)
2. `ChapanNewOrder.tsx` — Bug 2 (добавить `setDraftRestored(false)` в `onSubmit`)
3. `ChapanNewOrder.tsx` — Bug 3 (дедупликация reset-логики)
4. `ChapanNewOrder.module.css` — Bug 5 (убрать sticky с formActions)
5. `ChapanArchive.module.css` — Bug 6 (z-index: var(--z-modal-overlay))
6. `AppShell.module.css` — Bug 7 (убрать overflow: hidden)
7. Запустить Docker, проверить encoding в DevTools Network tab
