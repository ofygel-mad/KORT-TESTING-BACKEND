# WAREHOUSE_DEVELOP

## 1. Цель

Нужно перевести раздел `Склад` из плоского списка позиций в управляемую систему каталога и остатков, которая:

- не хардкодит поля типа `Цвет`, `Размер`, `Длина изделия`, `Пол`;
- позволяет добавлять новые поля через `+` в интерфейсе и задавать им произвольное имя;
- хранит эти поля в БД валидно и предсказуемо;
- умеет импортировать справочники из Excel без ручного перебора;
- показывает значения в `Dropdown` в форме заказа в live-режиме;
- сразу показывает наличие товара на складе не только по модели, но по варианту;
- корректно печатает документы и синхронизирует данные с Чапаном.

Итоговая цель: сделать `умный склад`, который является источником правды для каталога, вариантов товара и их наличия.

---

## 2. Что уже есть в проекте

### 2.1. Что работает

- Есть модуль склада: `server/src/modules/warehouse/*`, `src/pages/warehouse/index.tsx`.
- Есть Чапан-заказы: `server/src/modules/chapan/*`, `src/pages/workzone/chapan/orders/*`.
- В заказе уже есть поля `productName`, `size`, `color`, `gender`, `length`.
- Есть печать накладных и шаблонов:
  - `server/src/modules/chapan/invoice-document.ts`
  - `server/src/modules/chapan/z2-invoice-template.service.ts`
  - `server/src/modules/chapan/sheets/row-builder.ts`
- Есть зачатки импорта Excel:
  - `server/src/modules/imports/scanner/*`
  - `server/src/modules/imports/adapters/warehouse.adapter.ts`

### 2.2. Главные ограничения текущей реализации

1. Каталоги Чапана ограничены фиксированным набором:
   - `productCatalog`
   - `fabricCatalog`
   - `sizeCatalog`
   - `workers`
   - `paymentMethodCatalog`

   Это видно в:
   - `server/src/modules/chapan/settings.service.ts`
   - `server/src/modules/chapan/settings.routes.ts`
   - `src/entities/order/types.ts`

2. Складская позиция плоская. Сейчас `WarehouseItem` не хранит универсальный набор атрибутов, а только базовые поля:
   - `name`
   - `sku`
   - `qty`
   - `qtyMin`
   - `costPrice`
   - `categoryId`
   - `tags`
   - `notes`

3. Форма добавления товара на склад не умеет новые поля.
   В `src/pages/warehouse/index.tsx` в `AddItemDrawer` нет механизма `+ добавить поле`.

4. Форма заказа Чапана использует фиксированные поля.
   В `src/pages/workzone/chapan/orders/ChapanNewOrder.tsx` сейчас:
   - модель идет из каталога;
   - размер идет из каталога;
   - пол, длина, цвет заданы отдельно;
   - цвет пока не живет как универсальное поле склада.

5. Проверка наличия слишком грубая.
   `server/src/modules/warehouse/warehouse.service.ts -> checkProductNamesAvailability()` ищет только по `name contains`.
   Это значит:
   - не учитываются цвет, размер, длина, пол;
   - возможны ложные совпадения;
   - невозможно честно показать наличие варианта.

6. Печать документов зашита под фиксированные колонки.
   Сейчас документы знают только:
   - `productName`
   - `gender`
   - `length`
   - `size`
   - `color`

   Для произвольных полей этого мало.

7. Импортный движок частично есть, но не доведен до боевого контура склада.
   В `server/src/app.ts` маршруты модуля imports сейчас не зарегистрированы как рабочий производственный контур склада.
   Фронтовый `src/pages/imports/index.tsx` вообще ориентирован на customer import.

---

## 3. Что дал заказчик

### 3.1. Excel-источники

Из приложенных файлов удалось подтвердить реальную структуру:

#### `Название товаров.xlsx`

Лист: `Лист1`

Колонки:
- пустой индекс
- `Название товаров`

Примеры значений:
- `Шерсть ромбик`
- `Шерсть сәукеле`
- `Бедел бомбер`
- `Бомбер "Амир"`
- `Қозы Көрпеш шапаны`
- `Баян сұлу шапаны`

#### `Название Цветов.xlsx`

Лист: `Лист1`

Колонки:
- пустой индекс
- `Цвет Товаров`

Примеры значений:
- `Синий`
- `Светлый беж`
- `Голубой`
- `Мокрый асфальт`
- `Верблюжка`
- `Черный`
- `Оранжевый`

### 3.2. Дополнительные справочники от заказчика

#### Размер

```text
38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, детский
```

#### Длина изделия

```text
Длинный, Короткий, Стандарт
```

#### Пол

По макету:

```text
Мужской, Женский
```

### 3.3. Что видно по мобильному макету

Форма позиции заказа должна показывать:

- `Модель`
- `Размер`
- `Пол`
- `Длина изделия`
- `Цвет / материал`
- `Кол-во`

То есть UI уже визуально просит не один товар, а товар-вариант.

---

## 4. Бизнес-требования

### 4.1. Обязательные

1. В складе должна быть возможность создавать новые поля без релиза кода.
2. Эти поля должны иметь тип:
   - `select`
   - `multiselect`
   - `text`
   - `number`
   - `boolean`
3. Для полей типа `select/multiselect` нужны управляемые списки значений.
4. Поля должны уметь включаться и выключаться для:
   - формы склада;
   - формы заказа;
   - расчета наличия;
   - печатных документов;
   - импорта.
5. Должен быть массовый импорт:
   - товаров;
   - цветов;
   - размеров;
   - длин;
   - других атрибутов.
6. При создании заказа dropdown'ы должны приходить с бэкенда, а не жить в коде.
7. Система должна показывать наличие по варианту:
   - `есть`
   - `мало`
   - `нет`
8. Печатные документы и Google Sheets должны получать корректное представление атрибутов.

### 4.2. Желательные

1. Автосоздание карточек варианта при первом импорте или первом приходе.
2. Нормализация названий:
   - трим пробелов;
   - dedupe по регистру;
   - сортировка размеров;
   - код/slug для стабильных ключей.
3. Подготовка под дальнейший импорт из новых Excel без доработки кода.

---

## 5. Рекомендуемая архитектура

### 5.1. Принцип

Не надо зашивать `Цвет`, `Размер`, `Пол`, `Длина` прямо в форму склада как набор отдельных колонок навсегда.

Нужно сделать два уровня:

1. `Справочник полей`
   - что за поле;
   - как называется;
   - где показывается;
   - влияет ли на наличие;
   - влияет ли на печать;
   - какие значения допустимы.

2. `Значения поля у варианта товара / позиции заказа`
   - у конкретного товара;
   - у конкретной складской позиции;
   - у конкретной позиции заказа.

### 5.2. Практичный подход для текущего проекта

Рекомендую не ломать сразу весь текущий Чапан, а сделать совместимый слой:

- legacy-поля `color`, `size`, `gender`, `length` пока оставить;
- добавить новый универсальный JSON/metadata слой;
- при сохранении писать и в legacy, и в новый слой;
- формы постепенно перевести на универсальные definitions;
- печать и sheets собрать через новый `attributesSummary`, но с fallback на legacy.

Это быстрее, безопаснее и не рвет существующие сценарии.

---

## 6. Целевая модель данных

### 6.1. Новые сущности

#### `WarehouseFieldDefinition`

Описывает поле, которое может появиться в форме склада и заказа.

Примеры:
- `size`
- `color`
- `length`
- `gender`
- `material`
- `season`
- `hood_type`

Поля:
- `id`
- `orgId`
- `code`
- `label`
- `entityScope` = `warehouse_item | order_item | both`
- `inputType` = `select | multiselect | text | number | boolean`
- `isRequired`
- `isVariantAxis`
- `showInWarehouseForm`
- `showInOrderForm`
- `showInDocuments`
- `affectsAvailability`
- `sortOrder`
- `isSystem`

#### `WarehouseFieldOption`

Справочник вариантов для `select/multiselect`.

Поля:
- `id`
- `definitionId`
- `value`
- `label`
- `sortOrder`
- `colorHex?`
- `isActive`

#### `WarehouseProductCatalog`

Справочник моделей товаров.

Поля:
- `id`
- `orgId`
- `name`
- `normalizedName`
- `isActive`
- `source`

#### `WarehouseProductField`

Связь: какие поля применимы к конкретному товару.

Например:
- для `Бомбер "Амир"` применимы `size`, `color`, `gender`, `length`;
- для аксессуара применимы только `color`.

Поля:
- `id`
- `productId`
- `definitionId`
- `isRequired`
- `sortOrder`

### 6.2. Расширения существующих таблиц

#### `WarehouseItem`

Добавить:
- `productCatalogId?`
- `variantKey?`
- `attributesJson Json?`
- `attributesSummary?`

Смысл:
- `attributesJson` хранит реальные значения, например:

```json
{
  "size": "52",
  "color": "Синий",
  "length": "Длинный",
  "gender": "Мужской"
}
```

- `variantKey` нужен для быстрого сравнения и резерва, например:

```text
бедел-бомбер|size:52|color:синий|length:длинный|gender:мужской
```

#### `ChapanOrderItem`

Добавить:
- `variantKey?`
- `attributesJson Json?`
- `attributesSummary?`

Legacy-поля пока сохранить:
- `size`
- `color`
- `gender`
- `length`

### 6.3. Почему не только JSON

Только JSON недостаточно, потому что нужны:

- управляемые dropdown'ы;
- сортировка значений;
- связь с печатью;
- правила обязательности;
- признак `влияет на наличие`.

Поэтому схема должна быть гибридной:

- структура полей в отдельных таблицах;
- значения варианта в `Json`;
- быстрый ключ варианта в `variantKey`.

---

## 7. Рекомендуемая Prisma-миграция

Ниже рекомендуемый каркас миграции.

```prisma
model WarehouseFieldDefinition {
  id                  String   @id @default(cuid())
  orgId               String   @map("org_id")
  code                String
  label               String
  entityScope         String   @default("both") @map("entity_scope")
  inputType           String   @map("input_type")
  isRequired          Boolean  @default(false) @map("is_required")
  isVariantAxis       Boolean  @default(false) @map("is_variant_axis")
  showInWarehouseForm Boolean  @default(true)  @map("show_in_warehouse_form")
  showInOrderForm     Boolean  @default(true)  @map("show_in_order_form")
  showInDocuments     Boolean  @default(true)  @map("show_in_documents")
  affectsAvailability Boolean  @default(true)  @map("affects_availability")
  sortOrder           Int      @default(0)     @map("sort_order")
  isSystem            Boolean  @default(false) @map("is_system")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  org     Organization            @relation(fields: [orgId], references: [id], onDelete: Cascade)
  options WarehouseFieldOption[]
  productLinks WarehouseProductField[]

  @@unique([orgId, code])
  @@index([orgId, sortOrder])
  @@map("warehouse_field_definitions")
}

model WarehouseFieldOption {
  id           String   @id @default(cuid())
  definitionId String   @map("definition_id")
  value        String
  label        String
  sortOrder    Int      @default(0) @map("sort_order")
  colorHex     String?  @map("color_hex")
  isActive     Boolean  @default(true) @map("is_active")

  definition WarehouseFieldDefinition @relation(fields: [definitionId], references: [id], onDelete: Cascade)

  @@unique([definitionId, value])
  @@index([definitionId, sortOrder])
  @@map("warehouse_field_options")
}

model WarehouseProductCatalog {
  id             String   @id @default(cuid())
  orgId          String   @map("org_id")
  name           String
  normalizedName String   @map("normalized_name")
  isActive       Boolean  @default(true) @map("is_active")
  source         String? 
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  org         Organization           @relation(fields: [orgId], references: [id], onDelete: Cascade)
  fieldLinks   WarehouseProductField[]
  warehouseItems WarehouseItem[]

  @@unique([orgId, normalizedName])
  @@map("warehouse_product_catalog")
}

model WarehouseProductField {
  id           String @id @default(cuid())
  productId     String @map("product_id")
  definitionId  String @map("definition_id")
  isRequired    Boolean @default(false) @map("is_required")
  sortOrder     Int @default(0) @map("sort_order")

  product    WarehouseProductCatalog @relation(fields: [productId], references: [id], onDelete: Cascade)
  definition WarehouseFieldDefinition @relation(fields: [definitionId], references: [id], onDelete: Cascade)

  @@unique([productId, definitionId])
  @@map("warehouse_product_fields")
}
```

И расширение существующих моделей:

```prisma
model WarehouseItem {
  // existing fields...
  productCatalogId String? @map("product_catalog_id")
  variantKey       String? @map("variant_key")
  attributesJson   Json?   @map("attributes_json")
  attributesSummary String? @map("attributes_summary")

  productCatalog WarehouseProductCatalog? @relation(fields: [productCatalogId], references: [id])

  @@index([orgId, variantKey])
}

model ChapanOrderItem {
  // existing fields...
  variantKey        String? @map("variant_key")
  attributesJson    Json?   @map("attributes_json")
  attributesSummary String? @map("attributes_summary")
}
```

---

## 8. Как должна работать логика

### 8.1. Настройка полей

В складе появляется блок:

- `Поля товара`
- кнопка `+ Добавить поле`

Пользователь задает:
- название поля;
- тип поля;
- обязательность;
- показывать ли в заказе;
- показывать ли в документах;
- влияет ли на складское наличие;
- список значений.

### 8.2. Настройка товаров

Для каждой модели товара выбирается:
- какие поля используются;
- в каком порядке;
- какие обязательны;
- какие значения допустимы.

### 8.3. Добавление складской позиции

При выборе модели система сама рисует нужные поля.

Пример:

`Бедел бомбер` -> показать:
- Размер
- Цвет
- Пол
- Длина изделия

`attributesJson` заполняется автоматически.

### 8.4. Создание заказа

В форме заказа поля должны подгружаться live с сервера:

1. выбирается модель;
2. фронт получает набор полей для этой модели;
3. dropdown'ы строятся из options;
4. при выборе значений собирается `variantKey`;
5. бэкенд проверяет наличие именно по `variantKey`.

### 8.5. Проверка наличия

Проверка должна работать так:

```text
productName + все поля, у которых affectsAvailability = true
```

Пример:

```text
Бедел бомбер + размер 52 + цвет Синий + длина Длинный + пол Мужской
```

Если совпал только `productName`, но не совпал `цвет` или `размер`, наличие считается отсутствующим для нужного варианта.

---

## 9. Импортный робот

### 9.1. Что должен уметь

Импорт должен работать в двух режимах:

1. `Справочники`
   - товары;
   - цвета;
   - размеры;
   - длины;
   - любые новые поля.

2. `Остатки`
   - реальные складские позиции с количеством.

### 9.2. Поведение для текущих файлов

#### `Название товаров.xlsx`

Нужно:
- создать/обновить `WarehouseProductCatalog`;
- при необходимости добавить дефолтный набор полей для этих товаров.

#### `Название Цветов.xlsx`

Нужно:
- создать или обновить definition `color`;
- заполнить `WarehouseFieldOption` для `color`.

#### Ручной список размеров

Нужно:
- создать или обновить definition `size`;
- загрузить значения `38...74, детский`;
- задать сортировку.

#### Ручной список длин

Нужно:
- создать или обновить definition `length`;
- загрузить значения `Длинный, Короткий, Стандарт`.

### 9.3. Что важно при импорте

Импорт не должен:
- дублировать значения по регистру;
- ломать существующие названия;
- удалять данные без явного подтверждения.

Импорт должен:
- нормализовать пробелы;
- хранить источник (`import_source`, `imported_at`);
- отдавать отчет:
  - `created`
  - `updated`
  - `skipped`
  - `errors`

### 9.4. Рекомендованный сценарий импорта

1. Импортировать товары.
2. Импортировать `color`.
3. Системно загрузить `size`, `length`, `gender`.
4. Для нужных товаров связать поля:
   - `size`
   - `color`
   - `gender`
   - `length`
5. После этого открыть форму заказа и сразу получить рабочие dropdown'ы.

---

## 10. API, который нужен

### 10.1. Каталог и поля

#### `GET /api/v1/warehouse/catalog/definitions`

Возвращает все определения полей и options.

#### `POST /api/v1/warehouse/catalog/definitions`

Создает новое поле.

#### `PATCH /api/v1/warehouse/catalog/definitions/:id`

Обновляет поле.

#### `POST /api/v1/warehouse/catalog/definitions/:id/options`

Добавляет option для select-поля.

#### `GET /api/v1/warehouse/catalog/products`

Возвращает справочник моделей.

#### `POST /api/v1/warehouse/catalog/products`

Создает модель товара.

#### `PUT /api/v1/warehouse/catalog/products/:id/fields`

Назначает полям применимость к товару.

### 10.2. Форма заказа

#### `GET /api/v1/warehouse/order-form/catalog`

Возвращает payload для live формы заказа:

```ts
type OrderFormCatalogPayload = {
  products: Array<{
    id: string;
    name: string;
    fields: Array<{
      code: string;
      label: string;
      inputType: 'select' | 'multiselect' | 'text' | 'number' | 'boolean';
      isRequired: boolean;
      affectsAvailability: boolean;
      options: Array<{ value: string; label: string }>;
    }>;
  }>;
};
```

#### `POST /api/v1/warehouse/availability/check-variant`

Вход:

```json
{
  "productName": "Бедел бомбер",
  "attributes": {
    "size": "52",
    "color": "Синий",
    "length": "Длинный",
    "gender": "Мужской"
  }
}
```

Выход:

```json
{
  "variantKey": "бедел-бомбер|size:52|color:синий|length:длинный|gender:мужской",
  "available": true,
  "qty": 3,
  "matchedItemId": "..."
}
```

### 10.3. Импорт

#### `POST /api/v1/warehouse/import/catalog-products`
#### `POST /api/v1/warehouse/import/field-options`
#### `POST /api/v1/warehouse/import/stock`

Это лучше, чем пытаться насиловать старый customer import UI.

---

## 11. Что нужно поменять на фронте

### 11.1. Склад

Файл:
- `src/pages/warehouse/index.tsx`

Нужно:

1. В `AddItemDrawer` добавить не только стандартные поля, но и динамические поля.
2. Добавить `+ Добавить поле`.
3. Сделать отдельную вкладку:
   - `Справочники`
   - `Поля`
   - `Товары`
   - `Импорт`

### 11.2. Заказ Чапана

Файлы:
- `src/pages/workzone/chapan/orders/ChapanNewOrder.tsx`
- `src/pages/workzone/chapan/orders/ChapanEditOrder.tsx`

Нужно:

1. Убрать жёсткое знание о том, что есть только:
   - `color`
   - `gender`
   - `length`
   - `size`

2. Построить поля позиции заказа из ответа сервера.
3. При выборе модели делать подгрузку релевантных полей.
4. Показывать рядом статус варианта:
   - `В наличии`
   - `Мало`
   - `Нет в наличии`

### 11.3. Настройки Чапана

Файл:
- `src/pages/workzone/chapan/settings/ChapanSettings.tsx`

Нужно не плодить второй независимый справочник.

Правильнее:
- каталоги Чапана для товаров и атрибутов должны читать warehouse catalog API;
- текущую секцию `Каталоги` надо постепенно перевести на единый источник.

---

## 12. Что нужно поменять на бэкенде

### 12.1. Warehouse module

Файлы:
- `server/src/modules/warehouse/warehouse.service.ts`
- `server/src/modules/warehouse/warehouse.routes.ts`

Нужно:

1. Научить `createItem/updateItem` принимать `attributesJson`.
2. Генерировать `variantKey`.
3. Искать наличие по `variantKey`, а не по `name contains`.
4. Добавить каталог полей, options и product bindings.
5. Добавить импортные endpoint'ы.

### 12.2. Chapan orders

Файлы:
- `server/src/modules/chapan/orders.routes.ts`
- `server/src/modules/chapan/orders.service.ts`

Нужно:

1. Принять новый payload позиции заказа:

```ts
{
  productName: string;
  size?: string;
  color?: string;
  gender?: string;
  length?: string;
  attributes?: Record<string, string | string[] | number | boolean>;
  quantity: number;
  unitPrice: number;
}
```

2. Сохранять:
   - legacy поля;
   - `attributesJson`;
   - `variantKey`;
   - `attributesSummary`.

3. При маршрутизации на склад и при проверке наличия использовать `variantKey`.

### 12.3. Документы и печать

Файлы:
- `server/src/modules/chapan/invoice-document.ts`
- `server/src/modules/chapan/z2-invoice-template.service.ts`
- `server/src/modules/chapan/sheets/row-builder.ts`

Нужно:

1. Добавить сборку `attributesSummary`.
2. Для документов брать поля, где `showInDocuments = true`.
3. Порядок полей брать из `sortOrder`.
4. Для совместимости:
   - если `attributesJson` пустой, использовать legacy-поля.

---

## 13. Как должен формироваться `variantKey`

Рекомендую единый алгоритм:

1. Нормализовать имя товара.
2. Взять только поля, где:
   - `affectsAvailability = true`
   - значение непустое
3. Отсортировать по `code`.
4. Склеить в строку.

Пример:

```ts
function buildVariantKey(productName: string, attributes: Record<string, unknown>) {
  const normalizedProduct = productName.trim().toLocaleLowerCase('ru-RU');

  const parts = Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${String(value).trim().toLocaleLowerCase('ru-RU')}`);

  return [normalizedProduct, ...parts].join('|');
}
```

Это даст:
- стабильный поиск;
- честную проверку остатков;
- простой ключ для индексации.

---

## 14. Рекомендуемый патч по коду

Ниже не полный merge-ready patch, а правильный каркас изменений, который надо реализовать.

### 14.1. Бэкенд: типы позиции заказа

```ts
// server/src/modules/chapan/types.ts
export type DynamicAttributeValue = string | string[] | number | boolean;

export interface DynamicAttributesMap {
  [key: string]: DynamicAttributeValue;
}

export interface CreateOrderItemInput {
  productName: string;
  fabric?: string;
  color?: string;
  gender?: string;
  length?: string;
  size: string;
  quantity: number;
  unitPrice: number;
  workshopNotes?: string;
  attributes?: DynamicAttributesMap;
}
```

### 14.2. Бэкенд: нормализация legacy + dynamic

```ts
// server/src/modules/chapan/orders.service.ts
function normalizeOrderItemAttributes(item: {
  size?: string;
  color?: string;
  gender?: string;
  length?: string;
  attributes?: Record<string, unknown>;
}) {
  const attributes = {
    ...(item.attributes ?? {}),
  } as Record<string, unknown>;

  if (item.size?.trim()) attributes.size = item.size.trim();
  if (item.color?.trim()) attributes.color = item.color.trim();
  if (item.gender?.trim()) attributes.gender = item.gender.trim();
  if (item.length?.trim()) attributes.length = item.length.trim();

  return attributes;
}

function buildAttributesSummary(
  attributes: Record<string, unknown>,
  orderedCodes: string[] = ['gender', 'length', 'size', 'color'],
) {
  const ordered = orderedCodes
    .map((code) => [code, attributes[code]] as const)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([code, value]) => `${code}: ${String(value)}`);

  return ordered.join(', ');
}
```

### 14.3. Бэкенд: сохранение order item

```ts
const attrs = normalizeOrderItemAttributes(item);
const variantKey = buildVariantKey(item.productName, attrs);

create: {
  productName: item.productName,
  fabric: item.fabric?.trim() || '',
  color: typeof attrs.color === 'string' ? attrs.color : undefined,
  gender: typeof attrs.gender === 'string' ? attrs.gender : undefined,
  length: typeof attrs.length === 'string' ? attrs.length : undefined,
  size: typeof attrs.size === 'string' ? attrs.size : '',
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  attributesJson: attrs,
  attributesSummary: buildAttributesSummary(attrs),
  variantKey,
}
```

### 14.4. Склад: точная проверка наличия

Вместо текущего `checkProductNamesAvailability()` нужен вариантный endpoint:

```ts
// server/src/modules/warehouse/warehouse.service.ts
export async function checkVariantAvailability(
  orgId: string,
  productName: string,
  attributes: Record<string, unknown>,
) {
  const variantKey = buildVariantKey(productName, attributes);

  const item = await prisma.warehouseItem.findFirst({
    where: { orgId, variantKey },
    select: { id: true, qty: true, qtyReserved: true, name: true },
  });

  const qty = item ? Math.max(0, item.qty - item.qtyReserved) : 0;

  return {
    variantKey,
    available: qty > 0,
    qty,
    matchedItemId: item?.id ?? null,
    itemName: item?.name ?? null,
  };
}
```

### 14.5. Склад: создание позиции с динамическими полями

```ts
// server/src/modules/warehouse/warehouse.service.ts
export interface CreateItemDto {
  name: string;
  sku?: string;
  unit?: string;
  qty?: number;
  qtyMin?: number;
  costPrice?: number;
  categoryId?: string;
  locationId?: string;
  notes?: string;
  attributes?: Record<string, unknown>;
  productCatalogId?: string;
}

export async function createItem(orgId: string, dto: CreateItemDto, authorName: string) {
  const attrs = dto.attributes ?? {};
  const variantKey = buildVariantKey(dto.name, attrs);

  return prisma.warehouseItem.create({
    data: {
      orgId,
      name: dto.name,
      sku: dto.sku,
      unit: dto.unit ?? 'шт',
      qty: dto.qty ?? 0,
      qtyMin: dto.qtyMin ?? 0,
      costPrice: dto.costPrice,
      categoryId: dto.categoryId,
      locationId: dto.locationId,
      notes: dto.notes,
      productCatalogId: dto.productCatalogId,
      attributesJson: attrs,
      attributesSummary: buildAttributesSummary(attrs),
      variantKey,
      qrCode: `KORT-WH-${nanoid(10)}`,
    },
  });
}
```

### 14.6. Фронтенд: форма заказа на динамических definitions

```tsx
type DynamicField = {
  code: string;
  label: string;
  inputType: 'select' | 'multiselect' | 'text' | 'number' | 'boolean';
  isRequired: boolean;
  options: Array<{ value: string; label: string }>;
};

type OrderItemForm = {
  productName: string;
  quantity: number;
  unitPrice?: number;
  attributes: Record<string, string>;
};
```

Рендер:

```tsx
{productFields.map((field) => (
  <div key={field.code} className={styles.field}>
    <label className={styles.label}>{field.label}</label>
    {field.inputType === 'select' ? (
      <Controller
        control={control}
        name={`items.${idx}.attributes.${field.code}`}
        render={({ field: f }) => (
          <select {...f} className={styles.select}>
            <option value="">Выберите</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      />
    ) : (
      <input {...register(`items.${idx}.attributes.${field.code}`)} className={styles.input} />
    )}
  </div>
))}
```

### 14.7. Фронтенд: `+ добавить поле` в складе

```tsx
// идея для Warehouse settings
const [definitions, setDefinitions] = useState<WarehouseFieldDefinition[]>([]);

function handleAddField() {
  setDefinitions((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      code: '',
      label: '',
      inputType: 'text',
      isRequired: false,
      isVariantAxis: false,
      showInWarehouseForm: true,
      showInOrderForm: true,
      showInDocuments: true,
      affectsAvailability: true,
      options: [],
    },
  ]);
}
```

---

## 15. Как должны сесть документы

### 15.1. Накладная

Сейчас документ опирается на фиксированные колонки.

Правильный путь:

1. Оставить базовые колонки:
   - товар
   - количество
   - цена
   - сумма

2. Собирать атрибуты отдельной строкой или объединенной колонкой:

```text
Размер: 52, Цвет: Синий, Пол: Мужской, Длина: Длинный
```

3. Для печати брать только поля:
- `showInDocuments = true`

### 15.2. Google Sheets

В `server/src/modules/chapan/sheets/row-builder.ts` надо:

- продолжать писать `color/size/gender/length` для совместимости;
- дополнительно писать `attributesJson`;
- дополнительно писать `attributesSummary`.

То есть схема должна стать append-only, а не destructive.

---

## 16. Поэтапный план внедрения

### Этап 1. Быстрый запуск dropdown'ов и справочников

Срок: короткий

Сделать:
- новые таблицы definitions/options/products;
- импорт `Название товаров.xlsx`;
- импорт `Название Цветов.xlsx`;
- загрузку `size`, `length`, `gender`;
- API для order-form catalog;
- динамический dropdown в `ChapanNewOrder` и `ChapanEditOrder`.

Результат:
- заказчик сразу видит нужные dropdown'ы;
- значения не захардкожены;
- каталог живет в БД.

### Этап 2. Вариантный склад

Сделать:
- `attributesJson`;
- `variantKey`;
- вариантную проверку наличия;
- добавление складской позиции с атрибутами;
- отображение остатка по варианту.

Результат:
- форма заказа показывает не просто `товар есть/нет`, а честный статус нужного варианта.

### Этап 3. Документы и sheets

Сделать:
- `attributesSummary`;
- печать по `showInDocuments`;
- запись в Sheets.

Результат:
- документы не разваливаются при добавлении новых полей.

### Этап 4. Полный импортный робот

Сделать:
- отдельный warehouse import flow;
- отчеты импорта;
- шаблоны импорта;
- режим dry-run.

Результат:
- новые Excel можно загружать повторно без ручного забивания.

---

## 17. Приоритеты разработки

### P0

- убрать хардкод dropdown'ов;
- загрузить товары и цвета из Excel;
- ввести `size`, `length`, `gender` как управляемые справочники;
- сделать API каталога для формы заказа.

### P1

- ввести `attributesJson` и `variantKey`;
- показать наличие по варианту;
- обновить складскую форму.

### P2

- обновить документы;
- обновить Sheets;
- сделать полный UI импорта.

---

## 18. Риски

1. Если сразу убрать legacy `size/color/gender/length`, можно сломать:
   - накладные;
   - sheets sync;
   - старые заказы;
   - текущие фронтовые формы.

2. Если оставить только поиск по `productName`, заказчик получит неверное наличие.

3. Если сделать только JSON без definitions/options, снова вернемся к ручному вводу и хаосу в значениях.

4. Если импорт делать без нормализации, справочники очень быстро засорятся дублями.

---

## 19. Критерии готовности

Задача считается закрытой, когда:

1. В складе можно создать поле через `+` без правки кода.
2. Товары из `Название товаров.xlsx` появились в справочнике моделей.
3. Цвета из `Название Цветов.xlsx` появились в справочнике options для `color`.
4. Размеры и длины появились как управляемые options.
5. В форме заказа dropdown'ы приходят с сервера.
6. При выборе модели система показывает релевантные поля.
7. Наличие определяется по варианту товара.
8. Заказ сохраняет `attributesJson` и `variantKey`.
9. Документы и sheets не теряют атрибуты.

---

## 20. Итоговая рекомендация

Рекомендую делать не временный хардкод `цвета` в форме заказа, а сразу правильную базу:

- единый warehouse catalog;
- definitions/options;
- attributesJson;
- variantKey;
- совместимость с текущими legacy-полями.

Это даст быстрый результат для заказчика уже на первом этапе и не загонит проект в новый тупик через неделю.

Самый правильный порядок реализации:

1. БД: definitions/options/products + attributesJson/variantKey.
2. API каталога и availability по варианту.
3. Форма заказа на динамических полях.
4. Форма склада с `+ добавить поле`.
5. Импорт Excel.
6. Печать и Sheets.

Если нужно, следующий шаг после этого документа: я могу уже сделать реальный кодовый этап `P0 + P1` по проекту, начиная с Prisma migration, backend routes/service и переделки `ChapanNewOrder.tsx`.