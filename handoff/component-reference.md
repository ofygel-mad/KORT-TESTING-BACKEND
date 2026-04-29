# Component Reference — Склад UI

## Структура файлов для переноса в репо

```
src/
├── pages/
│   └── workzone/
│       └── chapan/
│           ├── ChapanShell.tsx          ← добавить Склад в NAV
│           └── warehouse/
│               ├── WarehousePage.tsx    ← главный компонент
│               ├── WarehouseHeader.tsx  ← заголовок + тулбар
│               ├── WarehouseStats.tsx   ← метрики (скрытые)
│               ├── WarehouseCatalog.tsx ← дерево товаров
│               ├── WarehouseSkuTable.tsx← плоская SKU таблица
│               └── Warehouse.module.css ← стили
└── shared/
    └── styles/
        └── design-tokens.css           ← токены (этот файл)
```

---

## ChapanShell — добавить Склад в NAV

```tsx
// src/pages/workzone/chapan/ChapanShell.tsx

const ALL_SECTION_NAV = [
  { to: '/workzone/chapan/orders',     label: 'Заказы',      icon: Package,   perm: 'orders'     },
  { to: '/workzone/chapan/production', label: 'Цех',         icon: Factory,   perm: 'production' },
  { to: '/workzone/chapan/ready',      label: 'Готово',      icon: CheckCheck, perm: 'ready'     },
  { to: '/workzone/chapan/shipping',   label: 'Отправка',    icon: Truck,      perm: 'shipping'  },
  { to: '/workzone/chapan/archive',    label: 'Завершённые', icon: CircleCheck, perm: 'archive'  },
] as const;

// Затем при сборке navItems добавить:
...((isAdmin || canAccessWarehouseNav)
  ? [{ to: '/workzone/chapan/warehouse', label: 'Склад', icon: Warehouse }]
  : []),
```

---

## WarehousePage — структура компонента

```tsx
export default function WarehousePage() {
  const [statsOpen, setStatsOpen]     = useState(false);
  const [filterOpen, setFilterOpen]   = useState(false);
  const [viewOpen, setViewOpen]       = useState(false);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'instock'|'reserved'|'empty'>('all');
  const [viewMode, setViewMode]       = useState<'default'|'compact'>('default');
  const [listMode, setListMode]       = useState<'tree'|'sku'>('tree');

  return (
    <div className={styles.root}>
      <WarehouseHeader
        search={search}
        onSearch={setSearch}
        statsOpen={statsOpen}
        onToggleStats={() => setStatsOpen(v => !v)}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        viewMode={viewMode}
        onViewMode={setViewMode}
        listMode={listMode}
        onListMode={setListMode}
        filterOpen={filterOpen}
        onFilterOpen={setFilterOpen}
        viewOpen={viewOpen}
        onViewOpen={setViewOpen}
      />
      {statsOpen && <WarehouseStats />}
      {listMode === 'tree'
        ? <WarehouseCatalog search={search} viewMode={viewMode} />
        : <WarehouseSkuTable search={search} />
      }
    </div>
  );
}
```

---

## WarehouseHeader — тулбар

```tsx
// Структура тулбара:
// [h1 "Склад"]
// [Поиск] [Фильтр▾] [Вид▾] | [Показать метрики] [+ Добавить] [Экспорт]

// Вид dropdown содержит два раздела:
// 1. Отображение: Каталог (tree) / по SKU (sku)
// 2. Плотность: Стандартный (default) / Компактный (compact)

// Фильтр dropdown:
// Все / В наличии / Зарезервировано / Нет остатков
```

---

## ProductCard — иерархия раскрытия

```tsx
function ProductCard({ product, viewMode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.productCard}>
      <div className={styles.productRow} onClick={() => setOpen(!open)}>
        <ChevronIcon open={open} />
        <ProductIcon />
        <span className={styles.productName}>{product.name}</span>
        <span className={styles.productQty}>{product.totalQty} пол.</span>
      </div>
      {open && (
        <div className={styles.productExpanded}>
          <SubGroup label="по размерам" items={product.sizes} />
          <SubGroup label="по цветам"   items={product.colors} />
          <AllSkuGroup product={product} />
        </div>
      )}
    </div>
  );
}
```

---

## SubGroup — подгруппа (размеры / цвета)

```tsx
function SubGroup({ label, items }) {
  const [open, setOpen] = useState(false);
  const total = items.reduce((s, x) => s + x.qty, 0);
  return (
    <div className={styles.subgroup}>
      <div className={styles.sgHeader} onClick={() => setOpen(!open)}>
        <ChevronIcon open={open} size="sm" />
        <span className={styles.sgLabel}>{label}</span>
        <span className={styles.sgTotalLabel}>итого</span>
        <span className={styles.sgTotal}>{total}</span>
      </div>
      {open && (
        <div className={styles.detailRows}>
          {items.map(item => (
            <div key={item.value} className={styles.detailRow}>
              <span className={styles.detailArrow}>›</span>
              <span className={styles.detailAttr}>{item.value}</span>
              <span className={styles.detailVal}>= {item.qty}</span>
              <button className={styles.detailAction}>все</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## AllSkuGroup — inline SKU таблица

```tsx
function AllSkuGroup({ product }) {
  const [open, setOpen] = useState(false);
  // Загружать variants для этого product из useWarehouseFoundationVariants()
  // фильтровать по product.id / productCatalogId
  return (
    <div className={styles.subgroup}>
      <div className={styles.sgHeader} onClick={() => setOpen(!open)}>
        <ChevronIcon open={open} size="sm" />
        <span className={styles.sgLabel}>по SKU</span>
        <span className={styles.sgTotalLabel}>позиций</span>
        <span className={styles.sgTotal}>{skus.length}</span>
      </div>
      {open && (
        <table className={styles.skuInlineTable}>
          <thead>
            <tr>
              <th>Цвет</th><th>Размер</th><th>Длина</th>
              <th>В наличии</th><th>Резерв</th><th>Доступно</th><th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {skus.map(sku => (
              <tr key={sku.id}>
                <td>{sku.color}</td>
                <td>{sku.size}</td>
                <td>{sku.length}</td>
                <td>{sku.onHand}</td>
                <td>{sku.reserved}</td>
                <td>{sku.available}</td>
                <td><StatusChip status={sku.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

## StatusChip

```tsx
const STATUS_MAP = {
  ok:   { label: 'В наличии', class: styles.chipOk   },
  warn: { label: 'Резерв',    class: styles.chipWarn  },
  err:  { label: 'Нет',       class: styles.chipErr   },
  info: { label: 'Инфо',      class: styles.chipInfo  },
};

function StatusChip({ status }: { status: 'ok'|'warn'|'err'|'info' }) {
  const { label, class: cls } = STATUS_MAP[status];
  return <span className={`${styles.chip} ${cls}`}>{label}</span>;
}
```

---

## Изменения в роутинге

```tsx
// src/app/router.tsx — добавить маршруты:
{
  path: '/workzone/chapan/warehouse',
  element: <WarehousePage />,
},
// Удалить или редиректить дубли:
// /workzone/chapan/warehouse/journal → /workzone/chapan/invoices
// /workzone/chapan/warehouse/orders  → /workzone/chapan/shipping
// /workzone/chapan/warehouse/sent    → /workzone/chapan/shipping
// /workzone/chapan/warehouse/transit → /workzone/chapan/shipping
```

---

## Что убрать / переместить

| Старый раздел | Действие |
|---|---|
| Приёмка от цеха | → `/chapan/purchase` |
| Журнал накладных | Проверить дубль с `/chapan/invoices`, оставить эталонный |
| Заказы на складе | Проверить дубль с `/chapan/shipping` |
| Отправленные | Проверить дубль с `/chapan/shipping` |
| Транзит | → `/chapan/shipping` |
