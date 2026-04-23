# Handoff: KORT — UI Redesign & Landing Page

## Overview

This package contains two high-fidelity HTML design references for the KORT ERP system:

1. **KORT App Prototype** — Full interactive flow: Auth (login/register) → Onboarding (business type + plan selection) → Main App Shell (sidebar + dashboard). This covers the screens a user sees from first launch through daily use.
2. **KORT Landing Page** — Marketing landing page for new visitors. Dark editorial design with hero, features grid, how-it-works, screenshot placeholders, pricing tiers, CTA.

## About the Design Files

The HTML files in this package are **design references** — high-fidelity prototypes showing the intended visual design, layout, interactions, and copy. They are **not production code to copy directly**. The task is to **recreate these designs inside KORT's existing React + TypeScript + Vite frontend** (`src/` folder) using the established CSS Module pattern, existing design tokens (`src/shared/design/globals.css`), and Lucide React icons already installed in the project.

## Fidelity

**High-fidelity.** These are pixel-accurate mockups with final colors, typography, spacing, and interaction states. Recreate them exactly using the existing KORT design system variables where possible.

---

## Design Tokens (Brand Reference)

All values should be pulled from `src/shared/design/globals.css`. Key tokens:

```css
/* Brand blue (UPDATED — was amber #9A4A1B in light theme) */
--fill-accent: #4A8BD4;           /* primary accent — light theme */
--fill-accent: #8A9AB8;           /* primary accent — dark theme (unchanged) */

/* Gradient on accent buttons */
background: linear-gradient(135deg, #5B9BD5, #2E6AB5);

/* Type */
--font-display: 'Plus Jakarta Sans', -apple-system, sans-serif;
--font-body:    'DM Sans', -apple-system, sans-serif;

/* Backgrounds (dark auth/onboarding surfaces) */
--brand-auth-bg: ... /* see globals.css — dark navy #0c0f17 base */

/* Radii */
--radius-xl: 16px;  --radius-lg: 12px;  --radius-md: 8px;

/* Motion */
--motion-fast: 140ms;  --motion-ease: cubic-bezier(0.22,1,0.36,1);
```

---

## Screen 1: Auth Screen

**File:** `KORT App Prototype.html` (screen = 'auth')  
**Existing file to update:** `src/features/auth/AuthModal.tsx` + `AuthModal.module.css`

### Layout
- **Full viewport split panel:** `display:grid; grid-template-columns: 55fr 45fr; height:100dvh`
- Left = Brand panel (dark navy). Right = Form panel (white/surface).
- Mobile `<768px`: Brand panel hidden (`display:none`), form takes full viewport.

### Left — Brand Panel
| Property | Value |
|---|---|
| Background | `radial-gradient(ellipse 72% 48% at 80% -8%, rgba(74,139,212,.22) 0%, transparent 58%), radial-gradient(ellipse 50% 60% at 8% 95%, rgba(124,58,237,.16) 0%, transparent 52%), #0c0f17` |
| Padding | `36px 40px` |
| Text color | `#fff` |
| Logo mark | 34×34px, `border-radius:10px`, `background: linear-gradient(135deg, #5B9BD5, #2E6AB5)`, "K" in 14px/800 white |
| Wordmark | 16px, weight 800, `letter-spacing:.18em`, uppercase, `rgba(228,236,248,.96)` |
| Tagline | `clamp(26px,3vw,42px)`, weight 800, `line-height:1.08`, `letter-spacing:-0.035em`. Em spans use `color:#5B9BD5` |
| Value props | 4 rows, each: colored dot (8px circle) + bold title (13.5px/700) + subtitle (12px, `rgba(138,160,196,.7)`) |
| Prop colors | Blue `#4A8BD4`, Cyan `#5C8DFF`, Green `#10B981`, Purple `#7C3AED` |
| Decorative orb | `position:absolute; bottom:-80px; right:-80px; width:300px; height:300px; border-radius:50%; border:1px solid rgba(74,139,212,.1); background: radial-gradient(circle, rgba(74,139,212,.07) 0%, transparent 70%)` + nested ::before/::after rings |

### Right — Form Panel
| Property | Value |
|---|---|
| Background | `var(--bg-surface)` = `#FFFFFF` light, `#0D1018` dark |
| Form header | 64px tall, border-bottom `var(--border-s)`. Shows "Назад" button when on register step |
| Form content | `flex:1; display:flex; align-items:center; justify-content:center; padding:32px 48px` |
| Form max-width | `380px` |
| Form title | `font-family: Plus Jakarta Sans; font-size:24px; font-weight:700; letter-spacing:-0.022em` |
| Inputs | `height:52px; padding:0 14px; border-radius:8px; border:1px solid var(--border); background:var(--surface-e); font-size:14px`. Focus: `border-color: color-mix(in srgb,var(--ac) 38%,var(--border)); box-shadow: 0 0 0 3px color-mix(in srgb,var(--ac) 12%,transparent)` |
| Primary button | `height:50px; border-radius:8px; background: linear-gradient(180deg,#2c2c2c 0%,#1a1a1a 100%); color:#fff; font-weight:700; box-shadow:0 2px 8px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.06)` |
| Hover | `translateY(-1px); box-shadow increased` |
| Link buttons | `color:var(--tx3); font-size:13px; no border/bg` |
| Password toggle | Absolute in password field, Eye/EyeOff icon from Lucide |

### Steps (modes)
- **login**: email/phone + password + "Войти" button + "Войти как сотрудник" toggle + forgot/register links
- **register** (company): 6 fields (company name, owner name, email, phone, password, confirm) + "Создать компанию" button

---

## Screen 2: Onboarding

**File:** `KORT App Prototype.html` (screen = 'onboarding')  
**Existing file to update:** `src/pages/onboarding/index.tsx` + `Onboarding.module.css`

### Layout
- Always dark (independent of user theme preference)
- `display:grid; grid-template-rows: 64px 1fr 72px`
- Header / scrollable main / footer nav

### Header (64px)
- Left: KORT logo mark (30px rounded square blue gradient) + "KORT" wordmark
- Right: Progress dots (6px → 20px active pill, amber `#5B9BD5`) + step label

### Step 0 — Business Type
- 5 industry cards in `grid-template-columns: repeat(2,1fr); gap:8px`
- Each card: `padding:14px 16px; border-radius:12px; border:1px solid rgba(255,255,255,.07); background:rgba(255,255,255,.03)`
- Selected: `border-color:color-mix(in srgb,var(--item-color) 45%,transparent); background:color-mix(...)` + checkmark icon
- Team size pills below: `padding:8px 22px; border-radius:99px`
- Selected pill: accent border + light accent bg + accent text

### Step 1 — Plan Selection
- 3-column grid (`repeat(3,1fr)`)
- **Middle card ("Продвинутый") is featured**: `border-top:3px solid #4A8BD4; padding-top:36px; transform:scale(1.025) translateY(-4px)`. Has "Рекомендуем" badge pinned at top center.
- Plan card anatomy: icon (44×44px rounded), name, subtitle, "для кого" text, feature list with colored dots, callout pill (Industrial only), module tags row
- Module tag: `padding:3px 8px; border-radius:99px; font-size:10.5px; font-weight:600`

### Footer (72px)
- Left: Ghost "Назад" button (hidden on step 0 via `visibility:hidden`)
- Right: Primary "Продолжить" button → on last step "Начать работу"
- Primary: `background:var(--ac); color:#fff; box-shadow:0 4px 16px color-mix(...)`

---

## Screen 3: App Shell — Dashboard

**File:** `KORT App Prototype.html` (screen = 'app')  
**Existing files:** `src/app/layout/` (Sidebar, Topbar, AppShell)

### Sidebar Rail (hover-expand)
| Property | Value |
|---|---|
| Collapsed width | `56px` |
| Expanded width (on hover) | `220px` |
| Transition | `width 280ms cubic-bezier(0.34,0,0.16,1)` |
| Background | `linear-gradient(180deg, var(--surface) 0%, color-mix(in srgb, var(--surface-e) 88%, var(--surface-i)) 100%)` |
| Border-right | `1px solid var(--border-s)` |
| Hover shadow | `18px 0 60px -18px rgba(16,24,40,.2), 0 0 0 1px color-mix(in srgb,var(--ac) 10%,transparent)` |
| Logo mark | 28×28px rounded, blue gradient |
| Logo text | Hidden (opacity:0) until hover, `letter-spacing:.16em` uppercase |
| Nav items | `min-height:42px; padding:10px 14px; border-radius:10px; font-size:13.5px; font-weight:600` |
| Active item | `border-left:2px solid var(--ac); padding-left:12px; background:color-mix(in srgb,var(--ac-s) 56%,var(--surface-i))` |
| Nav labels | `opacity:0` collapsed → `opacity:1` expanded (200ms delay 60ms) |
| Section labels | Same opacity trick as nav labels; `font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase` |
| Logout button | `color:var(--tx3)` hover → `background:rgba(239,68,68,.08); color:#EF4444` |

### Topbar (56px)
| Property | Value |
|---|---|
| Background | `color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter:blur(8px)` |
| Border-bottom | `1px solid var(--border-s)` |
| Left | Page breadcrumb label: `font-size:14px; font-weight:600` |
| Right | Search button (`padding:7px 14px; border-radius:9px; border:1px solid var(--border-s)`), bell icon button, theme icon button, avatar (32×32px, initials, blue tinted bg) |

### Dashboard Content
- Page padding: `28px`
- **KPI Row**: `display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px`
- KPI card: `padding:18px 20px; background:var(--surface); border:1px solid var(--border-s); border-radius:16px; box-shadow:var(--shadow-xs)`
- KPI anatomy: label row (11px/700/uppercase + colored icon), value (26px/800/`letter-spacing:-0.04em`), delta pill (12px/600 green/red with arrow icon)
- **Below KPI**: `display:grid; grid-template-columns:1fr 360px; gap:16px`
- Left: Deals table card. Right: Activity feed card.
- Cards: `background:var(--surface); border:1px solid var(--border-s); border-radius:16px; overflow:hidden`
- Card header: `padding:16px 20px; border-bottom:1px solid var(--border-s); display:flex; justify-content:space-between`
- Table headers: `font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; background:var(--surface-e)`
- Status badges: colored pills — new (blue), prog (amber), won (green), lost (red)
- Activity items: colored 8px dot + text + time label

---

## Screen 4: Landing Page

**File:** `KORT Landing Page.html`  
**Purpose:** Standalone marketing page, not part of the React app. Implement as a standalone HTML page or a separate Next.js/Astro site.

### Layout & Sections
1. **Fixed nav** (64px): Logo + nav links + CTA buttons. On scroll: `border-bottom:1px solid var(--bd-s)` appears.
2. **Hero** (`min-height:100vh; display:block; text-align:center; padding:120px 24px 80px`): badge pill + headline + subtitle + 2 CTAs + browser-chrome screenshot frame
3. **Metrics strip**: 3-column grid with stat values
4. **Features** (96px section padding): 3×2 grid of feature cards
5. **How it works**: 3-step horizontal layout with decorative gradient connector line
6. **Screenshots**: Tabbed interface (3 tabs) with browser-chrome frame + placeholder/upload area
7. **Pricing**: 3 plan cards (middle featured/elevated)
8. **CTA banner**: Email input + submit button
9. **Footer**: logo + nav links + copyright

### Colors (landing page specific)
```css
--bg:   #0c0f17   /* page background */
--bg-s: #111620   /* elevated surface */
--bg-e: #181f30   /* more elevated */
--bd:   #1c2840   /* border */
--bd-s: #141c2e   /* subtle border */
--tx:   #e4ecf8   /* primary text */
--tx2:  #7a90b8   /* secondary text */
--tx3:  #3e5070   /* tertiary text */
--ac:   #4A8BD4   /* KORT blue accent */
```

### Hero Section
- Radial gradient bg: blue top-right + purple bottom-left
- `h1`: `font-size:clamp(34px,5vw,68px); font-weight:800; line-height:1.06; letter-spacing:-0.04em`. Em spans: `color:var(--ac)`
- Subtitle: `font-size:clamp(14px,1.6vw,17px); color:var(--tx2); max-width:520px; margin:0 auto 38px`
- Primary CTA: `padding:14px 28px; border-radius:12px; background:var(--ac); color:#fff; font-size:15px; font-weight:700; box-shadow:0 8px 24px color-mix(in srgb,var(--ac) 40%,transparent)`
- Secondary CTA: `border:1px solid var(--bd); background:rgba(255,255,255,.03); color:var(--tx2)`
- Screenshot frame: browser chrome (dark, 3 dots + URL bar) + `aspect-ratio:16/9` placeholder area
- Placeholder: diagonal stripe pattern (`repeating-linear-gradient(-45deg, transparent 0,transparent 14px, rgba(255,255,255,.016) 14px,rgba(255,255,255,.016) 15px)`) + centered icon + label
- Click placeholder → opens `<input type="file" accept="image/*">` to upload real screenshot

### Feature Cards (6)
Each card: `padding:26px; border-radius:16px; border:1px solid var(--bd-s); background:rgba(255,255,255,.02)`. Hover: `translateY(-2px)` + accent-tinted border.
Icon box: `44×44px; border-radius:12px; background:color-mix(in srgb,var(--fc) 14%,rgba(255,255,255,.04))`

| # | Title | Color |
|---|---|---|
| 1 | CRM | `#5C8DFF` |
| 2 | Склад | `#4A8BD4` |
| 3 | Финансы | `#10B981` |
| 4 | Рабочие зоны | `#7C3AED` |
| 5 | Документы | `#F59E0B` |
| 6 | Аналитика | `#EC4899` |

### Pricing Cards
- Middle card (Продвинутый): `transform:scale(1.025) translateY(-4px); border-color:color-mix(in srgb,var(--ac) 50%,transparent)`. Top badge: `background:var(--ac); color:#fff; font-size:11px` pinned at top center with `border-radius:0 0 10px 10px`.
- Plan icons, feature lists, module tag pills: same pattern as onboarding plan cards (see Screen 2 above)
- CTA buttons: primary uses `background:var(--ac)`, secondary uses `background:rgba(255,255,255,.06); border:1px solid var(--bd)`

---

## Interactions & Animations

| Interaction | Duration | Easing |
|---|---|---|
| Screen transitions (Auth→Onboard→App) | 260ms | `cubic-bezier(0.22,1,0.36,1)` |
| Sidebar expand | 280ms | `cubic-bezier(0.34,0,0.16,1)` |
| Sidebar labels fade-in | 200ms, delay 60ms | linear |
| Button hover raise | 140ms | `cubic-bezier(0.22,1,0.36,1)` |
| Card hover translate | 180ms | ease |
| Plan card featured hover | inherit + Y offset |  |
| Nav scroll border | 200ms | linear |
| Hero badge pulse | 2s infinite | ease |
| Input focus ring | 140ms | ease |

---

## Responsive Breakpoints

| Breakpoint | Changes |
|---|---|
| `< 768px` | Auth: brand panel hidden; Onboarding: single-column plan grid; App: 2-col KPI grid, stacked dashboard grid |
| `< 480px` | Auth: reduced padding; Landing: single-col features |
| Landing `< 960px` | Features 2-col, pricing single-col, steps single-col |
| Landing `< 640px` | Nav links hidden, metrics single-col |

---

## Assets

| Asset | Source | Notes |
|---|---|---|
| KORT logo (K mark) | `public/logo2.ico` + see `uploads/logo2.ico` | Steel blue metallic K, use SVG or PNG version from brand team |
| Lucide icons | `lucide-react` (already installed) | Sidebar nav, topbar, form icons, feature section |
| Fonts | Google Fonts — already loaded via globals.css | Plus Jakarta Sans (display), DM Sans (body) |

---

## Files in This Package

| File | Purpose |
|---|---|
| `KORT App Prototype.html` | Interactive auth + onboarding + app shell prototype |
| `KORT Landing Page.html` | Marketing landing page |
| `kort-auth-component.jsx` | Auth screen React source (reference) |
| `kort-onboarding-component.jsx` | Onboarding screen React source (reference) |
| `kort-app-component.jsx` | App shell (sidebar + topbar + dashboard) React source (reference) |

---

## Implementation Notes

1. **Brand color update**: The light-theme accent was changed from amber `#9A4A1B` to KORT blue `#4A8BD4` to match the actual KORT brand identity (steel blue K logo). Update `--fill-accent` in `src/shared/design/globals.css` light theme section accordingly.
2. **Button gradients**: All primary CTAs now use `background: var(--ac)` (CSS variable) instead of hardcoded amber gradient, so they respond to theme changes automatically.
3. **Plan selection (Onboarding)**: The "Продвинутый" plan is intentionally scaled up (`scale(1.025)`) to draw attention. Keep this transform in CSS.
4. **Sidebar hover-expand**: This is a pure CSS implementation (`:hover` state changes width). The labels use opacity + transition with a 60ms delay so they appear AFTER the sidebar finishes expanding. Do not use JavaScript for this.
5. **Screenshot upload on landing**: The screenshot placeholders use `<input type="file">` to allow the marketing team to add real product screenshots without code changes.
6. **Logo mark**: Replace the "K" text placeholder in the prototype with the actual KORT SVG logo mark from the brand team.
