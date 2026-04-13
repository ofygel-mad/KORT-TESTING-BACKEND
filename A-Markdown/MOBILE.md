# MOBILE.md

## Цель документа

Перевести проект из состояния "desktop, сжатый до телефона" в полноценный mobile-first operational UI:

- удобно пользоваться одной рукой;
- не ломать scroll, drawer, keyboard, safe-area и sticky/fixed элементы;
- не прятать важные действия под нижнюю навигацию;
- не грузить тяжёлый desktop/canvas-слой на мобильных устройствах;
- не плодить локальные костыли на каждой странице.

Документ основан на аудите текущего `src`, layout-слоя, router, основных business-страниц, mobile-nav, canvas/workspace, auth/onboarding и e2e-контура.

Важно: в проекте сейчас нет полноценного mobile e2e-контура. Ниже есть много проблем, которые уже видны по коду без запуска. Часть UX-багов должна быть дополнительно подтверждена в фазе QA.

---

## Краткий диагноз

Проблема не в том, что "мало media queries". Проблема в архитектуре:

1. У приложения нет единого mobile shell.
2. У разных маршрутов разные владельцы scroll.
3. На мобильном продолжают жить desktop layout-решения: таблицы, фиксированные высоты, правые drawer, широкие toolbar, dense header.
4. Drawer и modal-слой размножен локально, а не централизован.
5. Mobile оптимизация в основном сделана как отключение эффектов, а не как перепроектирование взаимодействий.

Если оставить текущий подход и просто дописывать новые `@media`, проект будет деградировать дальше: каждый новый модуль будет приносить ещё один особый mobile-костыль.

---

## Что уже видно по коду

### 1. Shell и scroll сейчас конфликтуют

- [`src/app/layout/AppShell.module.css`](src/app/layout/AppShell.module.css) держит `.main` и `.routeViewport` с `overflow: hidden`.
- При этом многие страницы ещё и сами объявляют `height: 100%; overflow: hidden`.
- В результате на маршруте часто появляется не один scroll owner, а 2-3 вложенных контейнера с частично заблокированным скроллом.

Это прямой источник симптомов в стиле:

- страница "как будто не скроллится";
- скролл идёт внутри странного внутреннего контейнера;
- fixed/sticky элементы считают не тот viewport;
- overlay/drawer перекрывает контент, но не тот scroll container.

### 2. В проекте уже есть несколько мобильных навигационных архитектур

- [`src/app/layout/MobileNav.tsx`](src/app/layout/MobileNav.tsx): глобальная нижняя mobile nav.
- [`src/pages/canvas/index.tsx`](src/pages/canvas/index.tsx): отдельный mobile fallback для `/`, без canvas.
- [`src/pages/workzone/chapan/ChapanShell.tsx`](src/pages/workzone/chapan/ChapanShell.tsx): собственная mobile nav внутри workzone.

Это значит, что мобилка сейчас не единая система, а набор несовместимых режимов.

### 3. Scroll lock сделан не на том уровне

[`src/app/layout/MobileNav.tsx`](src/app/layout/MobileNav.tsx) блокирует `document.body.style.overflow = 'hidden'`.

Но у приложения scroll чаще живёт не на `body`, а внутри `.main`/страничного контейнера. Итог:

- блокировка работает нестабильно;
- backdrop и scroll container расходятся;
- можно получить dead-scroll zone.

### 4. Есть много локальных drawer-реализаций мимо общего `Drawer`

В проекте минимум 14 собственных drawer/overlay-паттернов, в том числе:

- [`src/pages/crm/leads/LeadDrawer.tsx`](src/pages/crm/leads/LeadDrawer.tsx)
- [`src/pages/crm/deals/DealDrawer.tsx`](src/pages/crm/deals/DealDrawer.tsx)
- [`src/pages/crm/tasks/TaskDrawer.tsx`](src/pages/crm/tasks/TaskDrawer.tsx)
- [`src/pages/warehouse/index.tsx`](src/pages/warehouse/index.tsx)
- [`src/pages/finance/index.tsx`](src/pages/finance/index.tsx)
- [`src/pages/employees/index.tsx`](src/pages/employees/index.tsx)

При этом уже существует общий [`src/shared/ui/Drawer.tsx`](src/shared/ui/Drawer.tsx) и [`src/shared/ui/Drawer.module.css`](src/shared/ui/Drawer.module.css).

То есть проект уже имеет правильное направление, но сам же его системно обходил.

### 5. Ключевые страницы всё ещё desktop-first

У нескольких основных страниц корень выглядит так:

```css
.root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 24px;
  gap: 16px;
}
```

Это найдено, например, в:

- [`src/pages/crm/leads/Leads.module.css`](src/pages/crm/leads/Leads.module.css)
- [`src/pages/crm/deals/Deals.module.css`](src/pages/crm/deals/Deals.module.css)
- [`src/pages/crm/tasks/Tasks.module.css`](src/pages/crm/tasks/Tasks.module.css)
- [`src/pages/finance/Finance.module.css`](src/pages/finance/Finance.module.css)
- [`src/pages/employees/Employees.module.css`](src/pages/employees/Employees.module.css)
- [`src/pages/reports/Reports.module.css`](src/pages/reports/Reports.module.css)

Это нормальная desktop-схема для внутреннего scrollable table area, но плохая база для телефона.

### 6. Canvas на мобильном выключен, но desktop-груз всё равно архитектурно рядом

[`src/pages/canvas/index.tsx`](src/pages/canvas/index.tsx) уже делает mobile fallback, а [`src/features/workspace/components/WorkspaceCanvas.tsx`](src/features/workspace/components/WorkspaceCanvas.tsx) отключает background effect на mobile.

Это хорошо, но недостаточно:

- mobile route всё ещё живёт рядом с desktop canvas-архитектурой;
- touch semantics (`touch-action: none`, pan, pointer capture) остаются сложными;
- важно вынести desktop-only workspace в lazy chunk, а mobile dashboard держать отдельно.

### 7. Chapan workzone на телефоне всё ещё не перепридуман

[`src/pages/workzone/chapan/ChapanShell.tsx`](src/pages/workzone/chapan/ChapanShell.tsx) просто скрывает sidebar и показывает fixed bottom nav.

Дополнительная проблема: `navItems.slice(0, 5)` отрезает часть доступной навигации. Для mobile это критично: пользователь просто не увидит раздел.

### 8. Auth/onboarding тоже несут desktop assumptions

- [`src/features/auth/AuthRouteLayout.module.css`](src/features/auth/AuthRouteLayout.module.css) использует fullscreen layout с `overflow: hidden`.
- [`src/features/auth/AuthModal.module.css`](src/features/auth/AuthModal.module.css) строит крупную двухколоночную fullscreen overlay-схему.
- [`src/pages/onboarding/Onboarding.module.css`](src/pages/onboarding/Onboarding.module.css) лучше адаптирован, но тоже живёт в логике fullscreen desktop composition.

На мобильных устройствах это обычно ломается на:

- виртуальной клавиатуре;
- маленькой высоте viewport;
- доступности CTA;
- safe-area сверху/снизу.

### 9. Тестовый контур мобилку почти не покрывает

- В [`playwright.config.ts`](playwright.config.ts) есть только desktop projects.
- Mobile device profiles отсутствуют.
- Отдельных e2e на mobile shell, bottom nav, bottom sheet, keyboard/viewport bugs нет.

Это значит, что даже исправленная мобилка потом легко регресснет.

---

## Главные архитектурные причины боли

### P0. Нет одного владельца вертикального scroll

Нужен ровно один scroll host на маршрут. Сейчас scroll разорван между:

- `body`
- `AppShell.main`
- `routeViewport`
- page root
- table wrap / drawer body

### P0. Нет единого mobile page scaffold

У телефона должен быть собственный каркас страницы:

- top safe area;
- header;
- filters/actions;
- primary content;
- bottom inset под nav/CTA;
- keyboard-safe режим.

Сейчас каждый модуль решает это сам.

### P0. Не разделены desktop interaction model и mobile interaction model

Пример:

- desktop: канбан/таблица + hover + right drawer;
- mobile: card feed + filter sheet + bottom sheet + primary CTA в reach zone.

Сейчас проект чаще просто скрывает колонки и ужимает блоки.

### P1. UI primitives не доведены до reusable mobile system

Нужны стандартизованные:

- `MobilePageShell`
- `BottomSheet`
- `MobileFilterBar`
- `MobileEntityCard`
- `StickyActionBar`
- `ResponsiveDataView`

Без этого каждый модуль будет писать свою версию заново.

---

## Целевая модель мобильной архитектуры

### 1. Один mobile shell

Телефонный режим должен опираться на единый набор правил:

- один scroll host;
- один bottom inset;
- одна safe-area стратегия;
- одна блокировка scroll при overlay;
- один паттерн sheet/drawer;
- один паттерн для toolbar/filter/search.

### 2. Mobile не равно "тот же DOM, но уже"

Для ключевых модулей нужно отдельно проектировать mobile-presentations:

- Leads/Deals/Tasks: card feed, не таблица.
- Warehouse: card feed + status chips + sheet details.
- Reports: summary-first, drill-down через cards и collapsible blocks.
- Settings: секции-аккордеоны/горизонтальный rail, а не desktop sidebar mentality.
- Chapan: список задач/заказов и быстрые действия, а не уменьшенный desktop workspace.

### 3. Desktop-only тяжёлые вещи грузятся только на desktop

- canvas / 3D / terrain / heavy preview;
- сложные multi-column dashboards;
- desktop modals большого формата.

На mobile они должны быть lazy или полностью заменены облегчённым экраном.

---

## Приоритеты

### P0

- исправить scroll architecture;
- сделать единый mobile shell;
- убрать body-level lock в пользу scroll-host lock;
- вытащить ключевые CRM/warehouse страницы из desktop tables в mobile cards;
- унифицировать drawer/sheet слой;
- не допускать скрытия CTA под нижней навигацией.

### P1

- перепридумать Chapan mobile workflow;
- отделить mobile dashboard от desktop canvas chunk;
- привести auth/onboarding к keyboard-safe поведению;
- ввести reusable mobile primitives.

### P2

- mobile visual regression;
- performance budget под low-end devices;
- аналитика по mobile funnel и rage taps.

---

## Этап 1. Починить shell, viewport, scroll, safe-area

### Цель

Сделать так, чтобы любое mobile-экранное состояние жило в одном предсказуемом viewport-контуре.

### Что нужно сделать

- Ввести общий `useViewportProfile`.
- Сделать `AppShell.main` единственным вертикальным scroll host.
- Убрать `overflow: hidden` из `routeViewport` как default.
- Держать нижний отступ через CSS custom property, а не руками в разных местах.
- Блокировать scroll не у `body`, а у фактического scroll host.

### Рекомендательный патч 1.1. Ввести `useViewportProfile`

```diff
--- /dev/null
+++ b/src/shared/hooks/useViewportProfile.ts
@@
+import { useEffect, useState } from 'react';
+
+type ViewportProfile = {
+  width: number;
+  height: number;
+  isPhone: boolean;
+  isTablet: boolean;
+  pointerCoarse: boolean;
+  keyboardInset: number;
+};
+
+function readProfile(): ViewportProfile {
+  const vv = window.visualViewport;
+  const width = Math.round(vv?.width ?? window.innerWidth);
+  const height = Math.round(vv?.height ?? window.innerHeight);
+  const pointerCoarse = window.matchMedia('(pointer: coarse)').matches;
+  const keyboardInset = Math.max(0, window.innerHeight - height);
+
+  return {
+    width,
+    height,
+    isPhone: width < 768,
+    isTablet: width < 981,
+    pointerCoarse,
+    keyboardInset,
+  };
+}
+
+export function useViewportProfile() {
+  const [profile, setProfile] = useState<ViewportProfile>(() => readProfile());
+
+  useEffect(() => {
+    const sync = () => {
+      const next = readProfile();
+      document.documentElement.style.setProperty('--vvh', `${next.height}px`);
+      document.documentElement.style.setProperty('--vk-bottom', `${next.keyboardInset}px`);
+      setProfile(next);
+    };
+
+    sync();
+    window.addEventListener('resize', sync);
+    window.visualViewport?.addEventListener('resize', sync);
+    return () => {
+      window.removeEventListener('resize', sync);
+      window.visualViewport?.removeEventListener('resize', sync);
+    };
+  }, []);
+
+  return profile;
+}
```

### Рекомендательный патч 1.2. Сделать `AppShell.main` единственным scroll host

```diff
--- a/src/app/layout/AppShell.tsx
+++ b/src/app/layout/AppShell.tsx
@@
-import { useEffect, useState, useSyncExternalStore } from 'react';
+import { CSSProperties, useEffect, useState, useSyncExternalStore } from 'react';
@@
 import { useDevicePerformance } from '../../shared/hooks/useDevicePerformance';
+import { useViewportProfile } from '../../shared/hooks/useViewportProfile';
@@
   const performance = useDevicePerformance();
+  const viewport = useViewportProfile();
@@
-  return (
-    <div className={`${styles.root} ${isCanvasPage ? styles.canvasMode : ''}`}>
+  return (
+    <div
+      className={`${styles.root} ${isCanvasPage ? styles.canvasMode : ''}`}
+      style={{
+        ['--app-bottom-offset' as string]: viewport.isPhone
+          ? 'calc(var(--bottom-nav-height, 60px) + env(safe-area-inset-bottom, 0px))'
+          : '0px',
+      } as CSSProperties}
+    >
@@
-        <main className={styles.main}>
+        <main className={styles.main} data-app-scroll="true">
```

```diff
--- a/src/app/layout/AppShell.module.css
+++ b/src/app/layout/AppShell.module.css
@@
 .main {
   flex: 1;
-  overflow: hidden;
+  overflow-y: auto;
+  overflow-x: hidden;
   display: flex;
   flex-direction: column;
   min-height: 0;
+  -webkit-overflow-scrolling: touch;
+  overscroll-behavior-y: contain;
+  padding-bottom: var(--app-bottom-offset, 0px);
 }
 
 .routeViewport {
   flex: 1;
-  min-height: 0;
-  height: 100%;
-  overflow: hidden;
+  min-height: 100%;
+  overflow: visible;
 }
```

### Рекомендательный патч 1.3. Блокировать scroll у scroll host, а не у `body`

```diff
--- a/src/app/layout/MobileNav.tsx
+++ b/src/app/layout/MobileNav.tsx
@@
   useEffect(() => {
-    const previousOverflow = document.body.style.overflow;
-    if (moreOpen) {
-      document.body.style.overflow = 'hidden';
-    }
+    const scrollHost = document.querySelector('[data-app-scroll="true"]') as HTMLElement | null;
+    if (!scrollHost) return;
+
+    const previousOverflow = scrollHost.style.overflow;
+    const previousTouchAction = scrollHost.style.touchAction;
+    if (moreOpen) {
+      scrollHost.style.overflow = 'hidden';
+      scrollHost.style.touchAction = 'none';
+    }
 
     return () => {
-      document.body.style.overflow = previousOverflow;
+      scrollHost.style.overflow = previousOverflow;
+      scrollHost.style.touchAction = previousTouchAction;
     };
   }, [moreOpen]);
```

### Критерий готовности этапа

- любой основной mobile route стабильно скроллится;
- нижняя nav не перекрывает последний actionable block;
- overlay/sheet не оставляет dead-scroll zones;
- virtual keyboard не ломает высоту экрана.

---

## Этап 2. Перевести ключевые списочные страницы с desktop table mindset на mobile cards

### Цель

Перестать пытаться показывать desktop list/table на телефоне.

### Обязательные кандидаты на перепроектирование

- Leads
- Deals
- Tasks
- Warehouse
- Employees
- Finance
- Reports

### Что нужно сделать

- На телефоне рендерить другой presentation layer.
- Таблица остаётся для desktop/tablet.
- На phone primary view должен быть card feed.
- Search/filter bar должен быть sticky и компактным.
- Secondary data уходит в chips/meta rows/collapsible sections.

### Рекомендательный патч 2.1. Сделать отдельный mobile-feed на примере Leads

```diff
--- a/src/pages/crm/leads/index.tsx
+++ b/src/pages/crm/leads/index.tsx
@@
 import { CreateLeadModal } from './CreateLeadModal';
+import { useViewportProfile } from '../../../shared/hooks/useViewportProfile';
 import styles from './Leads.module.css';
@@
   const [createOpen, setCreateOpen] = useState(false);
+  const { isPhone } = useViewportProfile();
@@
-      {!isLoading && !isError && view === 'kanban' && (
+      {!isLoading && !isError && isPhone && (
+        <div className={styles.mobileList}>
+          {filtered.map((lead) => (
+            <button
+              key={lead.id}
+              className={styles.mobileCard}
+              onClick={() => setSelectedId(lead.id)}
+            >
+              <div className={styles.mobileCardHead}>
+                <strong>{lead.fullName}</strong>
+                <span
+                  className={styles.mobileStagePill}
+                  style={{ ['--sc' as string]: STAGES.find((s) => s.key === lead.stage)?.color ?? 'var(--fill-info)' }}
+                >
+                  {STAGES.find((s) => s.key === lead.stage)?.label ?? lead.stage}
+                </span>
+              </div>
+              <div className={styles.mobileCardMeta}>
+                {lead.phone && <span>{lead.phone}</span>}
+                {lead.source && <span>{lead.source}</span>}
+                {lead.assignedName && <span>{lead.assignedName}</span>}
+              </div>
+              {lead.budget && (
+                <div className={styles.mobileCardBudget}>
+                  {new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(lead.budget)} тг
+                </div>
+              )}
+            </button>
+          ))}
+          {filtered.length === 0 && <div className={styles.empty}>Лиды не найдены</div>}
+        </div>
+      )}
+
+      {!isLoading && !isError && !isPhone && view === 'kanban' && (
         <div className={styles.kanban}>
```

```diff
--- a/src/pages/crm/leads/Leads.module.css
+++ b/src/pages/crm/leads/Leads.module.css
@@
-.root { display:flex; flex-direction:column; height:100%; overflow:hidden; padding:24px; gap:16px; }
+.root { display:flex; flex-direction:column; min-height:100%; padding:24px; gap:16px; }
+
+.mobileList {
+  display: grid;
+  gap: 10px;
+}
+
+.mobileCard {
+  display: grid;
+  gap: 10px;
+  width: 100%;
+  padding: 14px;
+  border-radius: 16px;
+  border: 1px solid var(--border-subtle);
+  background: var(--bg-surface);
+  text-align: left;
+  font: inherit;
+  color: inherit;
+}
+
+.mobileCardHead {
+  display: flex;
+  align-items: flex-start;
+  justify-content: space-between;
+  gap: 10px;
+}
+
+.mobileCardMeta {
+  display: flex;
+  flex-wrap: wrap;
+  gap: 8px;
+  color: var(--text-secondary);
+  font-size: 12px;
+}
+
+.mobileStagePill {
+  flex-shrink: 0;
+  font-size: 11px;
+  padding: 4px 8px;
+  border-radius: 999px;
+  background: color-mix(in srgb, var(--sc, var(--fill-info)) 12%, transparent);
+  color: var(--sc, var(--fill-info));
+  border: 1px solid color-mix(in srgb, var(--sc, var(--fill-info)) 20%, transparent);
+}
+
+.mobileCardBudget {
+  font-size: 13px;
+  font-weight: 700;
+  color: var(--fill-positive);
+}
```

### Что этот же паттерн должен заменить дальше

- [`src/pages/crm/deals/index.tsx`](src/pages/crm/deals/index.tsx)
- [`src/pages/crm/tasks/index.tsx`](src/pages/crm/tasks/index.tsx)
- [`src/pages/warehouse/index.tsx`](src/pages/warehouse/index.tsx)
- [`src/pages/finance/index.tsx`](src/pages/finance/index.tsx)
- [`src/pages/employees/index.tsx`](src/pages/employees/index.tsx)
- [`src/pages/reports/index.tsx`](src/pages/reports/index.tsx)

### Критерий готовности этапа

- на телефоне ни одна core page не требует horizontal table usage для базового сценария;
- primary action всегда виден без precision taps;
- карточка открывает detail sheet, а не desktop drawer-модель.

---

## Этап 3. Централизовать drawer/sheet слой

### Цель

Убрать зоопарк локальных overlay/drawer-компонентов и заменить их единым sheet/drawer primitive.

### Что нужно сделать

- Для mobile: bottom sheet.
- Для desktop: side drawer.
- Локальные overlay styles постепенно удалить.
- Footer actions стандартизовать.

### Рекомендательный патч 3.1. Перевести `LeadDrawer` на shared `Drawer`

```diff
--- a/src/pages/crm/leads/LeadDrawer.tsx
+++ b/src/pages/crm/leads/LeadDrawer.tsx
@@
-import { X, Phone, Mail, Tag, User, MessageSquare, ArrowRight } from 'lucide-react';
+import { Phone, Mail, Tag, User, MessageSquare, ArrowRight } from 'lucide-react';
+import { Drawer } from '../../../shared/ui/Drawer';
@@
-  return (
-    <div className={styles.overlay} onClick={onClose}>
-      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
-        <div className={styles.header}>
-          <span className={styles.drawerTitle}>{lead?.fullName ?? 'Лид'}</span>
-          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
-        </div>
-        {isLoading && <div className={styles.loading}>Загрузка...</div>}
-        {lead && (
-          <div className={styles.body}>
+  return (
+    <Drawer
+      open={Boolean(id)}
+      onClose={onClose}
+      title={lead?.fullName ?? 'Лид'}
+      subtitle={lead?.phone ?? lead?.source ?? undefined}
+      size="md"
+    >
+      {isLoading && <div className={styles.loading}>Загрузка...</div>}
+      {lead && (
+        <div className={styles.body}>
@@
-          </div>
-        )}
-      </div>
-    </div>
+        </div>
+      )}
+    </Drawer>
   );
 }
```

### После этого нужно таким же способом перевести

- [`src/pages/crm/deals/DealDrawer.tsx`](src/pages/crm/deals/DealDrawer.tsx)
- [`src/pages/crm/tasks/TaskDrawer.tsx`](src/pages/crm/tasks/TaskDrawer.tsx)
- [`src/pages/finance/index.tsx`](src/pages/finance/index.tsx)
- [`src/pages/employees/index.tsx`](src/pages/employees/index.tsx)
- [`src/pages/warehouse/index.tsx`](src/pages/warehouse/index.tsx)

### Правило

Новый локальный drawer в проекте больше не создавать.

Разрешённые варианты:

- shared `Drawer`;
- shared `BottomSheet` поверх него, если понадобится drag-to-close и snap points.

### Критерий готовности этапа

- один UX-паттерн для detail/edit flows;
- одинаковое поведение safe-area, footer, scroll-body;
- одинаковые анимации и lock semantics.

---

## Этап 4. Перепроектировать мобильную навигацию и workzone-модули

### Цель

Убрать ситуацию, когда mobile navigation скрывает функциональность или ломает поток действий.

### Прямые проблемы сейчас

- в `ChapanShell` mobile nav режется через `slice(0, 5)`;
- глобальная mobile nav, canvas mobile launcher и workzone mobile nav живут по разным правилам;
- fixed bottom nav конфликтует с action-heavy экранами.

### Что нужно сделать

- Для app-shell оставить глобальную нижнюю nav.
- Для workzone-шеллов не дублировать fixed nav снизу, а перейти на sticky horizontal route rail.
- Все доступные mobile-разделы должны быть видимы и достижимы.

### Рекомендательный патч 4.1. Исправить mobile nav в `ChapanShell`

```diff
--- a/src/pages/workzone/chapan/ChapanShell.tsx
+++ b/src/pages/workzone/chapan/ChapanShell.tsx
@@
-      <nav className={styles.mobileNav}>
-        {navItems.slice(0, 5).map((item) => {
+      <nav className={styles.mobileRail}>
+        {navItems.map((item) => {
           const Icon = item.icon;
           return (
             <NavLink
               key={item.to}
               to={item.to}
-              className={({ isActive }) => `${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ''}`}
+              className={({ isActive }) => `${styles.mobileRailItem} ${isActive ? styles.mobileRailItemActive : ''}`}
             >
               <Icon size={18} />
               <span>{item.label}</span>
             </NavLink>
           );
         })}
       </nav>
```

```diff
--- a/src/pages/workzone/chapan/ChapanShell.module.css
+++ b/src/pages/workzone/chapan/ChapanShell.module.css
@@
-.mobileNav {
-.  display: none;
-.}
+.mobileRail {
+  display: none;
+}
@@
 @media (max-width: 768px) {
@@
-  .main {
-    height: auto;
-    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 76px);
-  }
+  .main {
+    height: auto;
+    padding-bottom: 16px;
+  }
 
-  .mobileNav {
-    position: fixed;
-    left: 12px;
-    right: 12px;
-    bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
-    z-index: 30;
-    display: grid;
-    grid-template-columns: repeat(5, minmax(0, 1fr));
-    gap: 4px;
-    padding: 10px 10px;
-    border: 1px solid rgba(122, 140, 162, 0.18);
-    border-radius: 18px;
-    background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
-    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
-    backdrop-filter: blur(16px);
-    -webkit-backdrop-filter: blur(16px);
-  }
+  .mobileRail {
+    position: sticky;
+    top: 50px;
+    z-index: 19;
+    display: flex;
+    gap: 8px;
+    overflow-x: auto;
+    padding: 10px 14px;
+    background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
+    border-bottom: 1px solid var(--border-subtle);
+    -webkit-overflow-scrolling: touch;
+  }
+
+  .mobileRailItem {
+    flex: 0 0 auto;
+    display: inline-flex;
+    align-items: center;
+    gap: 8px;
+    min-height: 38px;
+    padding: 0 12px;
+    border-radius: 999px;
+    text-decoration: none;
+    color: var(--text-secondary);
+    background: var(--bg-surface-elevated);
+    border: 1px solid var(--border-subtle);
+    font-size: 12px;
+    font-weight: 600;
+  }
+
+  .mobileRailItemActive {
+    color: var(--fill-accent);
+    border-color: var(--ch-plat-border);
+    background: var(--fill-accent-subtle);
+  }
 }
```

### Что это даст

- не пропадают разделы;
- навигация остаётся видимой;
- нижняя зона освобождается под реальные CTA экранов заказа/производства/детали.

### Критерий готовности этапа

- mobile user не теряет доступ к разрешённому разделу;
- навигация не закрывает primary action;
- workzone mobile flows становятся task-oriented, а не desktop-like.

---

## Этап 5. Разделить mobile и desktop performance paths

### Цель

Не грузить на мобильных то, что ему не нужно ни функционально, ни производительно.

### Что нужно сделать

- Вынести desktop workspace/canvas в lazy chunk.
- Оставить mobile launcher/dashboard как самостоятельный лёгкий экран.
- Привязать heavy features не только к width, но и к capability profile.

### Рекомендательный патч 5.1. Ленивая загрузка desktop workspace

```diff
--- a/src/pages/canvas/index.tsx
+++ b/src/pages/canvas/index.tsx
@@
-import { useMemo, useState, type ElementType } from 'react';
+import { Suspense, lazy, useMemo, useState, type ElementType } from 'react';
 import { NavLink, useNavigate } from 'react-router-dom';
@@
-import { WorkspaceCanvas } from '../../features/workspace/components/WorkspaceCanvas';
-import { WorkspaceAddMenu } from '../../features/workspace/components/WorkspaceAddMenu';
+const WorkspaceCanvas = lazy(() =>
+  import('../../features/workspace/components/WorkspaceCanvas').then((m) => ({ default: m.WorkspaceCanvas })),
+);
+const WorkspaceAddMenu = lazy(() =>
+  import('../../features/workspace/components/WorkspaceAddMenu').then((m) => ({ default: m.WorkspaceAddMenu })),
+);
@@
   return (
     <div className={styles.root}>
-      <WorkspaceCanvas />
+      <Suspense fallback={null}>
+        <WorkspaceCanvas />
+      </Suspense>
@@
-      <WorkspaceAddMenu
-        open={addMenuOpen}
-        onClose={() => setAddMenuOpen(false)}
-        onSelect={handleAddTile}
-      />
+      <Suspense fallback={null}>
+        <WorkspaceAddMenu
+          open={addMenuOpen}
+          onClose={() => setAddMenuOpen(false)}
+          onSelect={handleAddTile}
+        />
+      </Suspense>
     </div>
   );
 }
```

### Рекомендательный патч 5.2. Усилить performance profile для мобильных устройств

```diff
--- a/src/shared/lib/browser.ts
+++ b/src/shared/lib/browser.ts
@@
+  const coarsePointer = hasWindow && typeof window.matchMedia === 'function'
+    ? window.matchMedia('(pointer: coarse)').matches
+    : false;
@@
-  const lowTier = reducedMotion
+  const lowTier = reducedMotion
     || (hardwareConcurrency !== null && hardwareConcurrency <= 4)
     || (deviceMemory !== null && deviceMemory <= 4);
@@
-    preferMinimalMotion: reducedMotion || tier === 'low',
+    preferMinimalMotion: reducedMotion || coarsePointer || tier === 'low',
```

### Дополнительно

На этом же этапе стоит:

- проверить chunk split для `three`, `@react-three/*`, workspace scene;
- не импортировать desktop-only widgets статически в mobile-only route branch;
- держать mobile dashboard без canvas runtime вообще.

### Критерий готовности этапа

- mobile route `/` не тянет canvas-heavy кусок раньше необходимости;
- мобильный first paint заметно легче;
- heavy visual effects не включаются по умолчанию на coarse pointer devices.

---

## Этап 6. Починить auth/onboarding и формы под mobile keyboard

### Цель

Чтобы пользователь мог авторизоваться, зарегистрироваться и пройти онбординг без борьбы с клавиатурой и обрезанными CTA.

### Что нужно сделать

- Убрать жёсткие fullscreen assumptions там, где нужен реальный scroll.
- Привязать layout к `--vvh`.
- Кнопки submit должны всегда оставаться достижимыми.
- На mobile формы должны иметь безопасный bottom padding под клавиатуру.

### Рекомендательный патч 6.1. Включить keyboard-safe height в auth layer

```diff
--- a/src/features/auth/AuthRouteLayout.module.css
+++ b/src/features/auth/AuthRouteLayout.module.css
@@
 .page {
   position: relative;
-  min-height: 100vh;
-  overflow: hidden;
+  min-height: var(--vvh, 100dvh);
+  overflow-x: hidden;
+  overflow-y: auto;
 }
@@
 .content {
-  min-height: 100vh;
+  min-height: var(--vvh, 100dvh);
   display: grid;
   place-items: center;
-  padding: 24px;
+  padding: 24px 24px calc(24px + var(--vk-bottom, 0px));
 }
```

### Рекомендательный патч 6.2. Не держать auth modal как жёсткую двухколоночную overlay на телефоне

Практический принцип для [`src/features/auth/AuthModal.module.css`](src/features/auth/AuthModal.module.css):

- на desktop: бренд-сайд + form-side;
- на phone: только form-stack;
- бренд-контент переносится в компактный header;
- bottom action zone sticky внутри scrollable form.

Если делать это патчем, то лучше не дописывать ещё один media-костыль, а вынести mobile auth layout в отдельный sublayout.

### Критерий готовности этапа

- клавиатура не перекрывает submit;
- регистрация и логин проходимы одной рукой;
- нет ловушек `overflow: hidden` на авторизации.

---

## Этап 7. Ввести мобильный QA-контур и запретить регрессии

### Цель

Чтобы мобилка не ломалась после каждого нового PR.

### Что нужно сделать

- Добавить mobile projects в Playwright.
- Написать минимум smoke + shell + scroll + drawer + auth tests.
- Прогонять mobile suite на critical routes.

### Рекомендательный патч 7.1. Добавить mobile projects в Playwright

```diff
--- a/playwright.config.ts
+++ b/playwright.config.ts
@@
   projects: [
     {
       name: 'chromium',
       use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/chromium.json' },
     },
+    {
+      name: 'iphone-13',
+      use: { ...devices['iPhone 13'], storageState: 'tests/e2e/.auth/chromium.json' },
+    },
+    {
+      name: 'pixel-7',
+      use: { ...devices['Pixel 7'], storageState: 'tests/e2e/.auth/chromium.json' },
+    },
     {
       name: 'firefox',
       use: { ...devices['Desktop Firefox'], storageState: 'tests/e2e/.auth/firefox.json' },
     },
```

### Рекомендательный патч 7.2. Добавить mobile shell smoke test

```diff
--- /dev/null
+++ b/tests/e2e/mobile-shell.spec.ts
@@
+import { test, expect } from '@playwright/test';
+import { preparePage } from './helpers';
+
+test('mobile shell keeps scroll and nav usable', async ({ page }) => {
+  await preparePage(page);
+  await page.goto('/');
+
+  await expect(page.getByRole('button', { name: 'Меню' })).toBeVisible();
+
+  await page.goto('/settings');
+  const scrollHost = page.locator('[data-app-scroll="true"]');
+  await scrollHost.evaluate((node) => node.scrollTo(0, node.scrollHeight));
+  const scrollTop = await scrollHost.evaluate((node) => node.scrollTop);
+  expect(scrollTop).toBeGreaterThan(0);
+});
+
+test('mobile detail sheet opens without horizontal overflow', async ({ page }) => {
+  await preparePage(page);
+  await page.goto('/crm/leads');
+  await page.locator('button, tr').first().click();
+  await expect(page.locator('[role="dialog"]')).toBeVisible();
+  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
+  expect(overflowX).toBeFalsy();
+});
```

### Минимальный обязательный mobile regression набор

- auth/login;
- root mobile dashboard;
- settings scroll;
- one CRM entity list;
- one drawer/bottom sheet;
- one workzone route;
- one form with virtual keyboard.

### Критерий готовности этапа

- mobile project обязателен в CI;
- новый UI-код без mobile smoke не считается завершённым.

---

## Модульная карта перепроектирования

| Модуль | Текущее состояние | Целевой mobile UX | Приоритет |
|---|---|---|---|
| Canvas `/` | mobile fallback уже есть, но архитектурно рядом с desktop canvas | лёгкий mobile launcher/dashboard | P0 |
| Leads | kanban/list desktop mentality | card feed + filter bar + detail sheet | P0 |
| Deals | desktop table/kanban | pipeline summary + cards + sheet | P0 |
| Tasks | dense desktop list | agenda cards + quick status actions | P0 |
| Warehouse | широкие таблицы и кастомные drawer | segmented tabs + cards + standard sheet | P0 |
| Finance | desktop page root + drawer | mobile cards + compact form sheets | P1 |
| Employees | table + local drawer | staff cards + role chips + sheet | P1 |
| Reports | desktop tables и summary blocks | summary-first cards + expandables | P1 |
| Settings | уже ближе к mobile, но ещё desktop sidebar mindset | horizontal rail + accordion sections | P1 |
| Chapan | отдельный shell, но не mobile-native | task-first workzone, sticky route rail, bottom actions | P0/P1 |
| Auth | fullscreen overlay mindset | keyboard-safe form stack | P1 |
| Onboarding | лучше остальных, но требует keyboard-safe pass | wizard без height traps | P1 |

---

## Что запрещено делать дальше

1. Не добавлять новые страницы с `.root { height: 100%; overflow: hidden; }` без очень жёсткой причины.
2. Не делать новые локальные `overlay/drawer` вместо shared primitive.
3. Не пытаться "спасти" мобилку только скрытием колонок.
4. Не блокировать `body`, если фактический scroll owner живёт внутри shell.
5. Не оставлять fixed bottom UI без расчёта нижних inset и реального CTA clearance.
6. Не тянуть desktop canvas/3D код в mobile-first entry path.

---

## Практический порядок внедрения

### Спринт 1

- этап 1 полностью;
- mobile shell smoke tests;
- refactor scroll ownership.

### Спринт 2

- Leads, Deals, Tasks mobile card feeds;
- shared drawer adoption для CRM.

### Спринт 3

- Warehouse, Finance, Employees mobile conversion;
- settings polishing;
- auth keyboard-safe fixes.

### Спринт 4

- Chapan mobile redesign;
- desktop/mobile chunk separation;
- mobile performance budget.

---

## Финальный ожидаемый результат

После выполнения плана мобильная версия должна ощущаться не как "обрезанный desktop", а как отдельный рабочий интерфейс:

- понятная навигация;
- один предсказуемый скролл;
- быстрый доступ к главным действиям;
- нормальная работа drawer/sheet;
- рабочая авторизация и формы;
- лёгкий startup без лишнего visual runtime;
- тестовый контур, который не даст всё это снова сломать.

Если делать коротко: сначала чинить shell и scroll, потом переносить списки в mobile cards, потом централизовать sheet/drawer, и только после этого шлифовать workzone/performance.
