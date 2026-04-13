/**
 * KORT Motion System
 *
 * Централизованные пресеты анимации по Главе 11.
 * Вся анимация в проекте должна использовать эти пресеты.
 *
 * Принципы:
 * - Анимации короткие и точные
 * - Нет театральности
 * - Движение подчёркивает причинно-следственную связь
 * - Элементы реагируют тактильно, а не показывают шоу
 */

// ─── Duration constants (ms) ────────────────────────────────────────────────
export const duration = {
  instant: 80,
  fast:    160,
  base:    200,
  slow:    280,
  page:    220,
  sheet:   260,
  spring:  400,
} as const;

// ─── Easing curves ────────────────────────────────────────────────────────────
export const easing = {
  /** Standard — calm, precise. Default for most transitions. */
  standard: [0.22, 1, 0.36, 1] as [number,number,number,number],
  /** Enter — content appearing */
  enter:    [0.0, 0.0, 0.2, 1.0] as [number,number,number,number],
  /** Exit — content leaving */
  exit:     [0.4, 0.0, 1.0, 1.0] as [number,number,number,number],
  /** Spring-like, for tactile micro-interactions */
  bounce:   [0.175, 0.885, 0.32, 1.275] as [number,number,number,number],
} as const;

// ─── Spring configs for framer-motion ─────────────────────────────────────────
export const spring = {
  /** Snappy — for sidebar, nav transitions */
  snappy: { type: 'spring', stiffness: 340, damping: 34 } as const,
  /** Smooth — for drawers, panels */
  smooth: { type: 'spring', stiffness: 280, damping: 36 } as const,
  /** Gentle — for large layout shifts */
  gentle: { type: 'spring', stiffness: 200, damping: 32 } as const,
  /** Tight — for micro-interactions */
  tight:  { type: 'spring', stiffness: 500, damping: 38 } as const,
} as const;

// ─── Page & navigation transition ─────────────────────────────────────────────
/**
 * pageEnter — lёгкий fade + y-shift 8px.
 * 140-180ms, без театральности.
 * Использовать в AnimatePresence > motion.div
 */
export const pageTransition = {
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -8 },
  transition: { duration: duration.page / 1000, ease: easing.standard },
} as const;

// ─── Popover / Dropdown / Command palette ────────────────────────────────────
/**
 * 120-160ms, opacity + scale 0.98 → 1.
 * Origin должен соответствовать месту появления.
 */
export const popoverVariants = {
  hidden: {
    opacity: 0,
    scale:   0.975,
    y:       6,
  },
  visible: {
    opacity: 1,
    scale:   1,
    y:       0,
    transition: { duration: duration.fast / 1000, ease: easing.standard },
  },
  exit: {
    opacity: 0,
    scale:   0.975,
    y:       6,
    transition: { duration: (duration.fast - 20) / 1000, ease: easing.exit },
  },
} as const;

// ─── Modal (centered dialog) ─────────────────────────────────────────────────
export const modalVariants = {
  hidden:  { opacity: 0, scale: 0.97, y: 8 },
  visible: {
    opacity: 1,
    scale:   1,
    y:       0,
    transition: { duration: duration.base / 1000, ease: easing.standard },
  },
  exit: {
    opacity: 0,
    scale:   0.97,
    y:       8,
    transition: { duration: duration.fast / 1000, ease: easing.exit },
  },
} as const;

// ─── Drawer / Side panel ────────────────────────────────────────────────────
/**
 * 180-240ms, translateX + fade overlay.
 * Ощущение панели, а не модалки.
 */
export const sheetVariants = {
  hidden:  { opacity: 0, x: 36, scale: 0.992 },
  visible: {
    opacity: 1,
    x:       0,
    scale:   1,
    transition: { duration: duration.sheet / 1000, ease: easing.standard },
  },
  exit: {
    opacity: 0,
    x:       36,
    scale:   0.992,
    transition: { duration: (duration.sheet - 40) / 1000, ease: easing.exit },
  },
} as const;

export const sheetVariantsLeft = {
  hidden:  { opacity: 0, x: -32 },
  visible: {
    opacity: 1,
    x:       0,
    transition: { duration: duration.sheet / 1000, ease: easing.standard },
  },
  exit: {
    opacity: 0,
    x:       -32,
    transition: { duration: (duration.sheet - 40) / 1000, ease: easing.exit },
  },
} as const;

export const overlayVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base / 1000 } },
  exit:    { opacity: 0, transition: { duration: (duration.base - 60) / 1000 } },
} as const;

// ─── List stagger ─────────────────────────────────────────────────────────────
/**
 * Для списков карточек или строк.
 * Контейнер + item вариант.
 */
export const listContainer = {
  hidden: {},
  show:   {
    transition: {
      staggerChildren: 0.045,
      delayChildren:   0.02,
    },
  },
} as const;

export const listItem = {
  hidden: { opacity: 0, y: 8 },
  show:   {
    opacity: 1,
    y:       0,
    transition: { duration: duration.base / 1000, ease: easing.standard },
  },
} as const;

// ─── Fade up — универсальный fade для блоков ─────────────────────────────────
export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show:   {
    opacity: 1,
    y:       0,
    transition: { duration: duration.base / 1000, ease: easing.standard },
  },
} as const;

// ─── Success / feedback — локальное подтверждение ─────────────────────────────
export const feedbackVariants = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale:   1,
    transition: { duration: duration.fast / 1000, ease: easing.standard },
  },
  exit: {
    opacity: 0,
    scale:   0.94,
    transition: { duration: (duration.fast - 30) / 1000, ease: easing.exit },
  },
} as const;

// ─── Card hover micro-interactions ────────────────────────────────────────────
/**
 * Elevation через border + shadow, без прыжков.
 * Применять через whileHover на motion.div.
 */
export const cardHover = {
  scale:     1.0,   // no scale — SaaS карточки не прыгают
  boxShadow: 'var(--shadow-md)',
  borderColor: 'var(--card-hover-border)',
  transition: { duration: duration.fast / 1000, ease: easing.standard },
} as const;

// ─── Button micro-interactions ────────────────────────────────────────────────
export const buttonTap   = { scale: 0.985, y: 0 } as const;
export const buttonHover = { scale: 1.01, y: -1 } as const;

// ─── Toast / notification ────────────────────────────────────────────────────
export const toastVariants = {
  hidden:  { opacity: 0, y: 12, scale: 0.96 },
  visible: {
    opacity: 1,
    y:       0,
    scale:   1,
    transition: { duration: duration.base / 1000, ease: easing.standard },
  },
  exit: {
    opacity: 0,
    y:       -8,
    scale:   0.96,
    transition: { duration: duration.fast / 1000, ease: easing.exit },
  },
} as const;

// ─── Convenience: framer-motion transition objects ────────────────────────────
export const t = {
  fast:   { duration: duration.fast   / 1000, ease: easing.standard },
  base:   { duration: duration.base   / 1000, ease: easing.standard },
  slow:   { duration: duration.slow   / 1000, ease: easing.standard },
  spring: spring.snappy,
  tight:  spring.tight,
} as const;


export const successBurst = {
  hidden: { opacity: 0, scale: 0.96, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: (duration.slow + 20) / 1000, ease: easing.standard } },
  exit: { opacity: 0, scale: 0.98, y: -6, transition: { duration: duration.fast / 1000, ease: easing.exit } },
} as const;

export const commandInvoke = {
  hidden: { opacity: 0, scale: 0.97, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: (duration.fast + 20) / 1000, ease: easing.standard } },
  exit: { opacity: 0, scale: 0.98, y: 8, transition: { duration: duration.fast / 1000, ease: easing.exit } },
} as const;

export const assistantReply = {
  hidden: { opacity: 0, y: 8, scale: 0.99 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: duration.base / 1000, ease: easing.standard } },
} as const;

export const drawerActionFeedback = {
  idle: { scale: 1, y: 0 },
  confirm: { scale: 0.985, y: 0, transition: { duration: duration.fast / 1000, ease: easing.standard } },
  settle: { scale: 1, y: -1, transition: { duration: duration.fast / 1000, ease: easing.standard } },
} as const;


export const completionPulse = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: duration.base / 1000, ease: easing.standard },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.985,
    transition: { duration: duration.fast / 1000, ease: easing.exit },
  },
} as const;

export const statusPulse = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: [0.98, 1.01, 1],
    transition: { duration: duration.slow / 1000, ease: easing.standard },
  },
  exit: { opacity: 0, scale: 0.96, transition: { duration: duration.fast / 1000, ease: easing.exit } },
} as const;

export const destructiveRecovery = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base / 1000, ease: easing.standard },
  },
  exit: { opacity: 0, y: -8, transition: { duration: duration.fast / 1000, ease: easing.exit } },
} as const;


export const saveCommit = {
  hidden: { opacity: 0, scale: 0.985, y: 6 },
  visible: {
    opacity: 1,
    scale: [0.99, 1.01, 1],
    y: [4, 0, 0],
    transition: { duration: duration.base / 1000, ease: easing.standard },
  },
  exit: { opacity: 0, scale: 0.985, y: -4, transition: { duration: duration.fast / 1000, ease: easing.exit } },
} as const;

export const routeHandoff = {
  hidden: { opacity: 0, y: 8, scale: 0.992 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: (duration.base + 30) / 1000, ease: easing.standard },
  },
  exit: { opacity: 0, y: -6, scale: 0.992, transition: { duration: duration.fast / 1000, ease: easing.exit } },
} as const;

export const recoveryConfirm = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: duration.base / 1000, ease: easing.standard },
  },
  exit: { opacity: 0, y: -6, scale: 0.985, transition: { duration: duration.fast / 1000, ease: easing.exit } },
} as const;
