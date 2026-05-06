/**
 * features/shared-bus/index.ts
 * ─────────────────────────────────────────────────────────────
 * Единственный канал связи между всеми SPA.
 * Ни одна SPA не импортирует другую — только шину.
 *
 * Очереди (publish → consume, FIFO):
 *   Leads ↔ Deals
 *     leadConvertedQueue    — лид передан → создать сделку
 *     dealReturnedQueue     — сделка слита → вернуть лид
 *
 *   Deals → Summary
 *     dealWonQueue          — сделка выиграна (финальная сумма)
 *     dealLostQueue         — сделка проиграна (причина)
 *
 *   Any SPA → Tasks
 *     taskRequestQueue      — попросить Tasks SPA создать задачу
 *                             (из Сделки, Лида, любого контекста)
 *
 *   Tasks → Summary
 *     taskDoneQueue         — задача завершена
 *
 *   Any SPA → Summary (снэпшоты данных для дашборда)
 *     snapshotQueue         — любое SPA публикует свежий снэпшот своих данных;
 *                             Summary читает и агрегирует
 *
 * Расширение в будущем:
 *   — добавить новую очередь здесь
 *   — новая SPA публикует / читает только свои типы
 *   — ни одна из старых SPA ничего не знает о новой
 */
import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────
//  Event payload types
// ─────────────────────────────────────────────────────────────

/** Leads → Deals: лид прошёл квалификацию */
export interface LeadConvertedEvent {
  leadId: string;
  fullName: string;
  phone: string;
  email?: string;
  companyName?: string;
  source: string;
  budget?: number;
  assignedName?: string;
  qualifierName?: string;
  meetingAt?: string;
  comment?: string;
  convertedAt: string;
}

/** Deals → Leads: сделка проиграна с опцией «вернуть клиента» */
export interface DealReturnedEvent {
  dealId: string;
  leadId: string;
  fullName: string;
  phone: string;
  source: string;
  reason: string;
  comment: string;
  returnedAt: string;
}

/** Deals → Summary: сделка выиграна */
export interface DealWonEvent {
  dealId: string;
  leadId: string;
  fullName: string;
  value: number;
  currency?: string;
  assignedName?: string;
  wonAt: string;
}

/** Deals → Summary: сделка слита */
export interface DealLostEvent {
  dealId: string;
  leadId: string;
  fullName: string;
  value: number;
  reason: string;
  lostAt: string;
}

/** Any SPA → Tasks: запрос создать задачу из внешнего контекста */
export interface TaskRequestEvent {
  /** Кто инициировал */
  sourceSpа: 'leads' | 'deals' | 'summary' | 'standalone';
  /** Привязка к сущности */
  linkedEntityType?: 'lead' | 'deal';
  linkedEntityId?: string;
  linkedEntityTitle?: string;
  /** Предзаполнение формы */
  suggestedTitle?: string;
  suggestedAssignee?: string;
  suggestedDueAt?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

/** Tasks → Summary: задача завершена */
export interface TaskDoneEvent {
  taskId: string;
  title: string;
  assignedName?: string;
  linkedEntityType?: 'lead' | 'deal';
  linkedEntityId?: string;
  doneAt: string;
}

/** Любой SPA → Topbar Bell: показать уведомление в колокольчике */
export interface GlobalNotifEvent {
  id: string;
  title: string;
  body: string;
  /** 'info' | 'success' | 'warning' | 'error' */
  kind: 'info' | 'success' | 'warning' | 'error';
  /** ISO timestamp */
  createdAt: string;
  /** Источник для иконки */
  source: 'leads' | 'deals' | 'tasks' | 'system' | 'warehouse';
}

/** Warehouse → Production: нехватка материала для заказа */
export interface WarehouseShortageEvent {
  orderId: string;
  orderNumber?: string;
  items: Array<{
    itemId: string;
    itemName: string;
    unit: string;
    needed: number;
    available: number;
    shortage: number;
  }>;
  detectedAt: string;
}

/** Warehouse → Production: материалы восполнены, заказ разблокирован */
export interface WarehouseStockAvailableEvent {
  orderId: string;
  itemIds: string[];
  resolvedAt: string;
}

/**
 * Snapshot: любое SPA публикует статистический слепок своих данных.
 * Summary-SPA подписана на снэпшоты всех источников.
 * Добавление нового SPA = добавление нового union-члена сюда.
 */
export type SpaSnapshot =
  | {
      source: 'leads';
      totalLeads: number;
      byStage: Record<string, number>;
      convertedThisMonth: number;
      snapshotAt: string;
    }
  | {
      source: 'deals';
      totalActive: number;
      totalWon: number;
      totalLost: number;
      pipelineValue: number;
      weightedValue: number;
      wonValueThisMonth: number;
      wonCountThisMonth: number;
      lostCountThisMonth: number;
      byStage: Record<string, { count: number; value: number }>;
      lostReasonBreakdown: Record<string, number>;
      snapshotAt: string;
    }
  | {
      source: 'tasks';
      totalTasks: number;
      todo: number;
      inProgress: number;
      done: number;
      overdueCount: number;
      completionRateThisMonth: number; // 0–100
      snapshotAt: string;
    }
  | {
      source: 'warehouse';
      totalItems: number;
      openAlerts: number;
      lowStockCount: number;
      snapshotAt: string;
    };

// ─────────────────────────────────────────────────────────────
//  Bus store
// ─────────────────────────────────────────────────────────────

interface SharedBusState {
  // Queues — raw arrays, consumed via consume* helpers (FIFO, non-blocking)
  leadConvertedQueue: LeadConvertedEvent[];
  dealReturnedQueue:  DealReturnedEvent[];
  dealWonQueue:       DealWonEvent[];
  dealLostQueue:      DealLostEvent[];
  taskRequestQueue:   TaskRequestEvent[];
  taskDoneQueue:      TaskDoneEvent[];
  snapshotQueue:      SpaSnapshot[];
  globalNotifQueue:   GlobalNotifEvent[];
  warehouseShortageQueue:      WarehouseShortageEvent[];
  warehouseStockAvailableQueue: WarehouseStockAvailableEvent[];

  // ── Publishers ────────────────────────────────────────────
  publishLeadConverted: (ev: LeadConvertedEvent) => void;
  publishDealReturned:  (ev: DealReturnedEvent)  => void;
  publishDealWon:       (ev: DealWonEvent)        => void;
  publishDealLost:      (ev: DealLostEvent)       => void;
  publishTaskRequest:   (ev: TaskRequestEvent)    => void;
  publishTaskDone:      (ev: TaskDoneEvent)        => void;
  publishSnapshot:      (snap: SpaSnapshot)       => void;
  publishGlobalNotif:   (ev: GlobalNotifEvent)    => void;
  publishWarehouseShortage:       (ev: WarehouseShortageEvent)       => void;
  publishWarehouseStockAvailable: (ev: WarehouseStockAvailableEvent) => void;

  // ── Consumers (drain queue → return consumed items) ───────
  consumeLeadConverted: () => LeadConvertedEvent[];
  consumeDealReturned:  () => DealReturnedEvent[];
  consumeDealWon:       () => DealWonEvent[];
  consumeDealLost:      () => DealLostEvent[];
  consumeTaskRequests:  () => TaskRequestEvent[];
  consumeTaskDone:      () => TaskDoneEvent[];
  consumeSnapshots:     () => SpaSnapshot[];
  consumeGlobalNotifs:  () => GlobalNotifEvent[];
  consumeWarehouseShortages:       () => WarehouseShortageEvent[];
  consumeWarehouseStockAvailable:  () => WarehouseStockAvailableEvent[];
}

export const useSharedBus = create<SharedBusState>((set, get) => ({
  leadConvertedQueue: [],
  dealReturnedQueue:  [],
  dealWonQueue:       [],
  dealLostQueue:      [],
  taskRequestQueue:   [],
  taskDoneQueue:      [],
  snapshotQueue:      [],
  globalNotifQueue: [],
  warehouseShortageQueue: [],
  warehouseStockAvailableQueue: [],

  publishLeadConverted: (ev) =>
    set(s => ({ leadConvertedQueue: [...s.leadConvertedQueue, ev] })),
  publishDealReturned: (ev) =>
    set(s => ({ dealReturnedQueue: [...s.dealReturnedQueue, ev] })),
  publishDealWon: (ev) =>
    set(s => ({ dealWonQueue: [...s.dealWonQueue, ev] })),
  publishDealLost: (ev) =>
    set(s => ({ dealLostQueue: [...s.dealLostQueue, ev] })),
  publishTaskRequest: (ev) =>
    set(s => ({ taskRequestQueue: [...s.taskRequestQueue, ev] })),
  publishTaskDone: (ev) =>
    set(s => ({ taskDoneQueue: [...s.taskDoneQueue, ev] })),
  publishSnapshot: (snap) =>
    set(s => ({ snapshotQueue: [...s.snapshotQueue, snap] })),
  publishGlobalNotif: (ev) =>
    set(s => ({ globalNotifQueue: [...s.globalNotifQueue, ev] })),
  publishWarehouseShortage: (ev) =>
    set(s => ({ warehouseShortageQueue: [...s.warehouseShortageQueue, ev] })),
  publishWarehouseStockAvailable: (ev) =>
    set(s => ({ warehouseStockAvailableQueue: [...s.warehouseStockAvailableQueue, ev] })),

  consumeLeadConverted: () => {
    const items = get().leadConvertedQueue;
    set({ leadConvertedQueue: [] });
    return items;
  },
  consumeDealReturned: () => {
    const items = get().dealReturnedQueue;
    set({ dealReturnedQueue: [] });
    return items;
  },
  consumeDealWon: () => {
    const items = get().dealWonQueue;
    set({ dealWonQueue: [] });
    return items;
  },
  consumeDealLost: () => {
    const items = get().dealLostQueue;
    set({ dealLostQueue: [] });
    return items;
  },
  consumeTaskRequests: () => {
    const items = get().taskRequestQueue;
    set({ taskRequestQueue: [] });
    return items;
  },
  consumeTaskDone: () => {
    const items = get().taskDoneQueue;
    set({ taskDoneQueue: [] });
    return items;
  },
  consumeSnapshots: () => {
    const items = get().snapshotQueue;
    set({ snapshotQueue: [] });
    return items;
  },
  consumeGlobalNotifs: () => {
    const items = get().globalNotifQueue;
    set({ globalNotifQueue: [] });
    return items;
  },
  consumeWarehouseShortages: () => {
    const items = get().warehouseShortageQueue;
    set({ warehouseShortageQueue: [] });
    return items;
  },
  consumeWarehouseStockAvailable: () => {
    const items = get().warehouseStockAvailableQueue;
    set({ warehouseStockAvailableQueue: [] });
    return items;
  },
}));
