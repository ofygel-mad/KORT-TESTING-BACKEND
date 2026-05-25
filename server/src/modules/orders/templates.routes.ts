// P5 — Read-only OrderTemplate routes.
//
// Mounted at /api/v1/order-templates. CRUD (create/update/delete) is
// deferred to P7 when the Field Designer ships; until then admins can only
// LIST and READ templates seeded by the system or by future imports.

import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import {
  ensureSystemTemplatesForOrg,
  type OrderTemplateSection,
  type OrderTemplateField,
  type FieldType,
} from './templates.js';

const VALID_FIELD_TYPES: ReadonlySet<FieldType> = new Set([
  'text', 'longtext', 'number', 'money',
  'select', 'multiselect', 'toggle',
  'date', 'file', 'customer', 'computed',
]);

const RESERVED_KEYS = new Set(['qty', 'quantity', 'unitPrice', 'unit_price', 'id', 'attributes', 'position']);

/**
 * Validates a template body against the design-handoff rules. Throws on any
 * violation (route handlers convert to a 400/422).
 */
function validateTemplateBody(body: unknown): {
  name: string;
  itemNoun: string;
  primaryUnit: string;
  primaryPrecision: number;
  sections: OrderTemplateSection[];
} {
  const b = body as Record<string, unknown>;
  if (typeof b?.name !== 'string' || b.name.trim().length === 0 || b.name.length > 80) {
    throw new ValidationError('Имя шаблона обязательно (1..80 символов).');
  }
  if (typeof b?.itemNoun !== 'string' || !b.itemNoun.trim()) {
    throw new ValidationError('Поле "Единица позиции" обязательно.');
  }
  if (typeof b?.primaryUnit !== 'string' || !b.primaryUnit.trim()) {
    throw new ValidationError('Поле "Основная единица" обязательно.');
  }
  if (typeof b?.primaryPrecision !== 'number' || b.primaryPrecision < 0 || b.primaryPrecision > 6) {
    throw new ValidationError('Точность должна быть числом 0..6.');
  }
  if (!Array.isArray(b?.sections) || b.sections.length === 0) {
    throw new ValidationError('Шаблон должен содержать хотя бы одну секцию.');
  }
  const sections = b.sections as OrderTemplateSection[];
  let hasItems = false;
  for (const sec of sections) {
    if (!sec || typeof sec !== 'object') throw new ValidationError('Секция должна быть объектом.');
    if (!['client', 'items', 'meta', 'custom'].includes(sec.kind)) {
      throw new ValidationError(`Неизвестный тип секции: ${sec.kind}.`);
    }
    if (sec.kind === 'items') hasItems = true;
    if (!Array.isArray(sec.fields)) {
      throw new ValidationError('Секция должна содержать массив полей.');
    }
    const seenKeys = new Set<string>();
    for (const f of sec.fields as OrderTemplateField[]) {
      if (!f.key || typeof f.key !== 'string') {
        throw new ValidationError('У поля должен быть key (snake_case).');
      }
      if (RESERVED_KEYS.has(f.key)) {
        throw new ValidationError(`Ключ "${f.key}" зарезервирован.`);
      }
      if (seenKeys.has(f.key)) {
        throw new ValidationError(`Дублирующийся key в секции: "${f.key}".`);
      }
      seenKeys.add(f.key);
      if (!f.label || typeof f.label !== 'string') {
        throw new ValidationError('У поля должен быть label.');
      }
      if (!VALID_FIELD_TYPES.has(f.type)) {
        throw new ValidationError(`Неизвестный тип поля: ${f.type}.`);
      }
      if (f.type === 'select' && (!Array.isArray(f.options) || f.options.length === 0)) {
        throw new ValidationError(`Для типа "select" нужно хотя бы одно значение в options (поле "${f.key}").`);
      }
      if (f.grow !== undefined && (![1, 2, 3, 4].includes(f.grow as number))) {
        throw new ValidationError(`Поле "${f.key}": grow должен быть 1..4.`);
      }
      if (f.affectsAvailability !== undefined && typeof f.affectsAvailability !== 'boolean') {
        throw new ValidationError(`Поле "${f.key}": affectsAvailability должен быть boolean.`);
      }
    }
  }
  if (!hasItems) {
    throw new ValidationError('Шаблон должен содержать хотя бы одну секцию с kind="items".');
  }
  return {
    name: (b.name as string).trim(),
    itemNoun: (b.itemNoun as string).trim(),
    primaryUnit: (b.primaryUnit as string).trim(),
    primaryPrecision: b.primaryPrecision as number,
    sections,
  };
}

export async function orderTemplatesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.resolveOrg);

  /**
   * GET /api/v1/order-templates
   * List all OrderTemplates available to the current org. Lazily seeds the
   * system templates on first access so the list is never empty.
   */
  app.get('/', async (request) => {
    await ensureSystemTemplatesForOrg(request.orgId);
    const templates = await prisma.orderTemplate.findMany({
      where: { orgId: request.orgId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return { count: templates.length, results: templates };
  });

  /**
   * GET /api/v1/order-templates/:id
   * Read a single template.
   */
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const tpl = await prisma.orderTemplate.findFirst({
      where: { id: request.params.id, orgId: request.orgId },
    });
    if (!tpl) {
      throw new NotFoundError('OrderTemplate', request.params.id);
    }
    return tpl;
  });

  /**
   * POST /api/v1/order-templates
   * Create a new (non-system) template. P7: powers the Field Designer.
   */
  app.post('/', async (request, reply) => {
    const body = validateTemplateBody(request.body);
    const created = await prisma.orderTemplate.create({
      data: {
        orgId: request.orgId,
        name: body.name,
        itemNoun: body.itemNoun,
        primaryUnit: body.primaryUnit,
        primaryPrecision: body.primaryPrecision,
        sections: body.sections as unknown as object,
        isSystem: false,
      },
    });
    return reply.status(201).send(created);
  });

  /**
   * PUT /api/v1/order-templates/:id
   * Update an existing template. System templates (isSystem=true) are
   * immutable — clone them via POST instead.
   */
  app.put<{ Params: { id: string } }>('/:id', async (request) => {
    const existing = await prisma.orderTemplate.findFirst({
      where: { id: request.params.id, orgId: request.orgId },
    });
    if (!existing) throw new NotFoundError('OrderTemplate', request.params.id);
    if (existing.isSystem) {
      throw new ValidationError('Системные шаблоны нельзя редактировать. Сначала клонируйте.');
    }
    const body = validateTemplateBody(request.body);
    // P6: bump `version` on every edit so existing orders' templateSnapshot can
    // later be diffed against the live template ("эта правка не повлияет на N
    // существующих заказов — они используют версию X").
    return prisma.orderTemplate.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        itemNoun: body.itemNoun,
        primaryUnit: body.primaryUnit,
        primaryPrecision: body.primaryPrecision,
        sections: body.sections as unknown as object,
        version: { increment: 1 },
      },
    });
  });

  /**
   * DELETE /api/v1/order-templates/:id
   * Delete a non-system template. Orders that still reference it via
   * `templateId` keep their custom attributes (the FK is nullable).
   */
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.orderTemplate.findFirst({
      where: { id: request.params.id, orgId: request.orgId },
    });
    if (!existing) throw new NotFoundError('OrderTemplate', request.params.id);
    if (existing.isSystem) {
      throw new ValidationError('Системные шаблоны нельзя удалить.');
    }
    await prisma.orderTemplate.delete({ where: { id: existing.id } });
    return reply.status(204).send();
  });

  /**
   * POST /api/v1/order-templates/:id/clone
   * Clone any template (including system) into a new editable one.
   */
  app.post<{ Params: { id: string }; Body: { name?: string } }>('/:id/clone', async (request, reply) => {
    const source = await prisma.orderTemplate.findFirst({
      where: { id: request.params.id, orgId: request.orgId },
    });
    if (!source) throw new NotFoundError('OrderTemplate', request.params.id);
    const targetName = request.body?.name?.trim() || `${source.name} (копия)`;
    const created = await prisma.orderTemplate.create({
      data: {
        orgId: request.orgId,
        name: targetName,
        itemNoun: source.itemNoun,
        primaryUnit: source.primaryUnit,
        primaryPrecision: source.primaryPrecision,
        sections: source.sections as unknown as object,
        isSystem: false,
      },
    });
    return reply.status(201).send(created);
  });
}
