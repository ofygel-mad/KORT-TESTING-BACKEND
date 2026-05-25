// P3 — OrderTemplate types + seeded templates.
//
// Schema mirrors new orders/design_handoff_new_order/SCHEMA_SHAPE.md and is
// the source of truth for the server's understanding of template shape.
// Validation against this shape runs at write time in P7 when admins can
// edit templates. For P3 the only writers are the system seed + backfill.

import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

type Db = Prisma.TransactionClient | typeof prisma;

export type FieldType =
  | 'text' | 'longtext' | 'number' | 'money'
  | 'select' | 'multiselect' | 'toggle'
  | 'date' | 'file'
  | 'customer'   // future
  | 'computed';  // future

export interface OrderTemplateField {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  grow?: 1 | 2 | 3 | 4;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
  options?: string[];
  unit?: string;
  precision?: number;
  min?: number;
  max?: number;
  multiple?: boolean;
  /**
   * Stage 5: variant-axis flag. When the warehouse module reads orders, it
   * uses fields with this flag set to derive distinct SKUs/balances.
   * Distinct values across all marked fields = distinct warehouse positions.
   */
  affectsAvailability?: boolean;
}

export type SectionKind = 'client' | 'items' | 'meta' | 'custom';

export interface OrderTemplateSection {
  id: string;
  kind: SectionKind;
  title: string;
  fields: OrderTemplateField[];
}

export interface OrderTemplateSeed {
  name: string;
  itemNoun: string;
  primaryUnit: string;
  primaryPrecision: number;
  sections: OrderTemplateSection[];
}

/**
 * Minimal runtime shape used by services that consume templates (Excel
 * generator/parser, etc.). Compatible both with seeds and with hydrated
 * Prisma rows once their `sections` Json is parsed to the typed shape.
 */
export interface OrderTemplate {
  name: string;
  itemNoun?: string;
  primaryUnit?: string;
  primaryPrecision?: number;
  sections: OrderTemplateSection[];
}

/**
 * "Чистый шаблон" — minimal items section with only product/qty/price. Used
 * as a starting point for orgs that want to build a form from scratch.
 */
export const BLANK_TEMPLATE: OrderTemplateSeed = {
  name: 'Чистый шаблон',
  itemNoun: 'позицию',
  primaryUnit: 'шт',
  primaryPrecision: 0,
  sections: [
    {
      id: 'client',
      kind: 'client',
      title: 'Клиент',
      fields: [
        { id: 'f_name',  key: 'name',  label: 'ФИО клиента', type: 'text', required: true, grow: 3 },
        { id: 'f_phone', key: 'phone', label: 'Телефон',     type: 'text', required: true, grow: 2 },
      ],
    },
    {
      id: 'items',
      kind: 'items',
      title: 'Позиции',
      fields: [
        { id: 'f_product', key: 'product', label: 'Товар/услуга', type: 'text', required: true, grow: 3 },
      ],
    },
  ],
};

/**
 * Clothing template — mirrors today's hardcoded LineItemsBlock fields one
 * for one (gender, color, length, size). After P5 wires the form to read
 * from this template, any org tagged 'clothing_workshop' sees the same form
 * they see today, but now driven by data instead of TSX.
 */
export const CLOTHING_TEMPLATE: OrderTemplateSeed = {
  name: 'Одежда (по умолчанию)',
  itemNoun: 'позицию',
  primaryUnit: 'шт',
  primaryPrecision: 0,
  sections: [
    {
      id: 'client',
      kind: 'client',
      title: 'Клиент и доставка',
      fields: [
        { id: 'f_name',    key: 'name',    label: 'ФИО клиента',    type: 'text', required: true, grow: 3 },
        { id: 'f_phone',   key: 'phone',   label: 'Телефон',        type: 'text', required: true, grow: 2 },
        { id: 'f_city',    key: 'city',    label: 'Город',          type: 'text', grow: 2 },
        { id: 'f_address', key: 'address', label: 'Адрес доставки', type: 'text', grow: 3 },
        { id: 'f_dueDate', key: 'dueDate', label: 'Срок',           type: 'date', grow: 2 },
      ],
    },
    {
      id: 'items',
      kind: 'items',
      title: 'Позиции',
      fields: [
        { id: 'f_product', key: 'product', label: 'Товар',  type: 'text',   required: true, grow: 2 },
        { id: 'f_gender',  key: 'gender',  label: 'Пол',    type: 'select', options: ['муж', 'жен'], affectsAvailability: true },
        { id: 'f_color',   key: 'color',   label: 'Цвет',   type: 'text', affectsAvailability: true },
        { id: 'f_length',  key: 'length',  label: 'Длина',  type: 'text', affectsAvailability: true },
        { id: 'f_size',    key: 'size',    label: 'Размер', type: 'text', required: true, affectsAvailability: true },
      ],
    },
  ],
};

/**
 * Watches / electronics — high-value items, serial numbers, warranty.
 * No workshop module needed; profile `watches_retail` uses this template.
 */
export const WATCHES_TEMPLATE: OrderTemplateSeed = {
  name: 'Аксессуары / электроника',
  itemNoun: 'модель',
  primaryUnit: 'шт',
  primaryPrecision: 0,
  sections: [
    {
      id: 'client',
      kind: 'client',
      title: 'Клиент',
      fields: [
        { id: 'f_name',    key: 'name',    label: 'ФИО клиента',    type: 'text', required: true, grow: 3 },
        { id: 'f_phone',   key: 'phone',   label: 'Телефон',        type: 'text', required: true, grow: 2 },
        { id: 'f_email',   key: 'email',   label: 'Email',          type: 'text', grow: 2 },
        { id: 'f_city',    key: 'city',    label: 'Город',          type: 'text', grow: 2 },
        { id: 'f_address', key: 'address', label: 'Адрес доставки', type: 'text', grow: 3 },
      ],
    },
    {
      id: 'items',
      kind: 'items',
      title: 'Модели',
      fields: [
        { id: 'f_product',  key: 'product',  label: 'Модель',     type: 'text', required: true, grow: 2 },
        { id: 'f_sku',      key: 'sku',      label: 'Артикул',    type: 'text', mono: true },
        { id: 'f_serial',   key: 'serial',   label: 'S/N',        type: 'text', mono: true },
        { id: 'f_case',     key: 'case',     label: 'Корпус',     type: 'select',
          options: ['Сталь', 'Титан', 'Сталь PVD', 'Золото 18K', 'Керамика'] },
        { id: 'f_strap',    key: 'strap',    label: 'Ремешок',    type: 'select',
          options: ['Кожа', 'Сталь', 'Каучук', 'Текстиль', 'Milanese'] },
        { id: 'f_warranty', key: 'warranty', label: 'Гарантия',   type: 'select',
          options: ['12 мес', '24 мес', '36 мес'] },
      ],
    },
  ],
};

/**
 * Chemicals / bulk B2B — by-tonnage with hazard class and lot number.
 */
export const CHEMICALS_TEMPLATE: OrderTemplateSeed = {
  name: 'Химия / насыпь',
  itemNoun: 'позицию',
  primaryUnit: 'т',
  primaryPrecision: 3,
  sections: [
    {
      id: 'client',
      kind: 'client',
      title: 'Контрагент',
      fields: [
        { id: 'f_name', key: 'name', label: 'Юр. лицо', type: 'text', required: true, grow: 3 },
        { id: 'f_bin',  key: 'bin',  label: 'БИН/ИИН',  type: 'text', mono: true, grow: 1 },
        { id: 'f_phone', key: 'phone', label: 'Телефон', type: 'text', grow: 2 },
        { id: 'f_address', key: 'address', label: 'Адрес отгрузки', type: 'text', grow: 3 },
      ],
    },
    {
      id: 'items',
      kind: 'items',
      title: 'Позиции',
      fields: [
        { id: 'f_product', key: 'product',  label: 'Продукт',           type: 'text',   required: true, grow: 2, affectsAvailability: true },
        { id: 'f_lot',     key: 'lot',      label: 'Партия',            type: 'text', mono: true },
        { id: 'f_concentration', key: 'concentration', label: 'Концентрация', type: 'text', affectsAvailability: true },
        { id: 'f_hazard',  key: 'hazard',   label: 'Класс опасности',   type: 'select',
          options: ['—', 'I', 'II', 'III', 'IV'] },
        { id: 'f_pack',    key: 'packaging',label: 'Упаковка',          type: 'select',
          options: ['Россыпь', 'Биг-бэг 1т', 'Биг-бэг 500кг', 'Мешок 25кг', 'IBC 1000л'], affectsAvailability: true },
        { id: 'f_msds',    key: 'msds',     label: 'MSDS',              type: 'file', multiple: false },
      ],
    },
  ],
};

/**
 * Furniture / made-to-order — dimensions, material, assembly, lift access.
 */
export const FURNITURE_TEMPLATE: OrderTemplateSeed = {
  name: 'Мебель на заказ',
  itemNoun: 'изделие',
  primaryUnit: 'шт',
  primaryPrecision: 0,
  sections: [
    {
      id: 'client',
      kind: 'client',
      title: 'Клиент и доставка',
      fields: [
        { id: 'f_name',     key: 'name',     label: 'ФИО клиента',    type: 'text', required: true, grow: 3 },
        { id: 'f_phone',    key: 'phone',    label: 'Телефон',        type: 'text', required: true, grow: 2 },
        { id: 'f_address',  key: 'address',  label: 'Адрес',          type: 'text', grow: 3 },
        { id: 'f_floor',    key: 'floor',    label: 'Этаж',           type: 'number' },
        { id: 'f_elevator', key: 'elevator', label: 'Грузовой лифт?', type: 'toggle' },
        { id: 'f_assembly', key: 'assembly', label: 'Сборка',         type: 'toggle' },
        { id: 'f_dueDate',  key: 'dueDate',  label: 'Срок',           type: 'date', grow: 2 },
      ],
    },
    {
      id: 'items',
      kind: 'items',
      title: 'Изделия',
      fields: [
        { id: 'f_product', key: 'product', label: 'Изделие',  type: 'text', required: true, grow: 2 },
        { id: 'f_width',   key: 'width',   label: 'Ширина, мм',  type: 'number', affectsAvailability: true },
        { id: 'f_height',  key: 'height',  label: 'Высота, мм',  type: 'number', affectsAvailability: true },
        { id: 'f_depth',   key: 'depth',   label: 'Глубина, мм', type: 'number', affectsAvailability: true },
        { id: 'f_material',key: 'material',label: 'Материал', type: 'select',
          options: ['ЛДСП', 'МДФ', 'Массив дуба', 'Массив бука', 'Фанера', 'Металл'], affectsAvailability: true },
        { id: 'f_sketch',  key: 'sketch',  label: 'Эскиз',    type: 'file' },
      ],
    },
  ],
};

/**
 * Grocery / B2B distribution — barcode, expiry, pallet count.
 */
export const GROCERY_TEMPLATE: OrderTemplateSeed = {
  name: 'Продукты B2B',
  itemNoun: 'позицию',
  primaryUnit: 'шт',
  primaryPrecision: 0,
  sections: [
    {
      id: 'client',
      kind: 'client',
      title: 'Контрагент',
      fields: [
        { id: 'f_name',    key: 'name',    label: 'Юр. лицо', type: 'text', required: true, grow: 3 },
        { id: 'f_outlet',  key: 'outlet',  label: 'Точка/магазин', type: 'text', grow: 2 },
        { id: 'f_address', key: 'address', label: 'Адрес',    type: 'text', grow: 3 },
        { id: 'f_dueDate', key: 'dueDate', label: 'Доставка', type: 'date', grow: 2 },
      ],
    },
    {
      id: 'items',
      kind: 'items',
      title: 'Позиции',
      fields: [
        { id: 'f_product', key: 'product', label: 'Товар',         type: 'text', required: true, grow: 2 },
        { id: 'f_sku',     key: 'sku',     label: 'SKU',           type: 'text', mono: true },
        { id: 'f_barcode', key: 'barcode', label: 'Штрих-код',     type: 'text', mono: true },
        { id: 'f_expiry',  key: 'expiry',  label: 'Срок годности', type: 'date' },
        { id: 'f_pallets', key: 'pallets', label: 'Паллет',        type: 'number' },
      ],
    },
  ],
};

/**
 * Services — no inventory, time-based, performer and venue.
 */
export const SERVICES_TEMPLATE: OrderTemplateSeed = {
  name: 'Услуги',
  itemNoun: 'услугу',
  primaryUnit: 'ч',
  primaryPrecision: 1,
  sections: [
    {
      id: 'client',
      kind: 'client',
      title: 'Клиент',
      fields: [
        { id: 'f_name',     key: 'name',     label: 'ФИО клиента',  type: 'text', required: true, grow: 3 },
        { id: 'f_phone',    key: 'phone',    label: 'Телефон',      type: 'text', required: true, grow: 2 },
        { id: 'f_location', key: 'location', label: 'Объект работ', type: 'text', grow: 3 },
        { id: 'f_dueDate',  key: 'dueDate',  label: 'Дата работ',   type: 'date', grow: 2 },
      ],
    },
    {
      id: 'items',
      kind: 'items',
      title: 'Услуги',
      fields: [
        { id: 'f_product',   key: 'product',   label: 'Услуга',     type: 'text', required: true, grow: 2 },
        { id: 'f_performer', key: 'performer', label: 'Исполнитель',type: 'text' },
        { id: 'f_hours',     key: 'hours',     label: 'Часы',       type: 'number', precision: 1 },
        { id: 'f_notes',     key: 'notes',     label: 'Заметки',    type: 'longtext', grow: 3 },
      ],
    },
  ],
};

/** Seeded templates that ship with KORT. Marked isSystem on save. */
export const SYSTEM_TEMPLATES: OrderTemplateSeed[] = [
  BLANK_TEMPLATE,
  CLOTHING_TEMPLATE,
  WATCHES_TEMPLATE,
  CHEMICALS_TEMPLATE,
  FURNITURE_TEMPLATE,
  GROCERY_TEMPLATE,
  SERVICES_TEMPLATE,
];

/**
 * Ensures the org has its system templates. Idempotent — re-running is
 * safe; updates the sections payload to the latest shipped version. Returns
 * the org's default (Clothing) template id, which orders backfill into
 * Order.templateId.
 */
export async function ensureSystemTemplatesForOrg(
  orgId: string,
  db: Db = prisma,
): Promise<string> {
  let defaultId: string | null = null;
  for (const seed of SYSTEM_TEMPLATES) {
    const row = await db.orderTemplate.upsert({
      where: { orgId_name: { orgId, name: seed.name } },
      create: {
        orgId,
        name: seed.name,
        itemNoun: seed.itemNoun,
        primaryUnit: seed.primaryUnit,
        primaryPrecision: seed.primaryPrecision,
        sections: seed.sections as unknown as object,
        isSystem: true,
      },
      update: {
        itemNoun: seed.itemNoun,
        primaryUnit: seed.primaryUnit,
        primaryPrecision: seed.primaryPrecision,
        sections: seed.sections as unknown as object,
        isSystem: true,
      },
    });
    if (seed === CLOTHING_TEMPLATE) {
      defaultId = row.id;
    }
  }
  if (!defaultId) {
    throw new Error('Failed to seed Clothing template');
  }
  return defaultId;
}

/**
 * Backfills Order.templateId for legacy orders missing it — assigns the
 * org's Clothing template. Safe to re-run; affects only NULL rows.
 */
export async function backfillOrdersWithDefaultTemplate(orgId: string): Promise<number> {
  const defaultId = await ensureSystemTemplatesForOrg(orgId);
  const result = await prisma.order.updateMany({
    where: { orgId, templateId: null },
    data: { templateId: defaultId },
  });
  return result.count;
}
