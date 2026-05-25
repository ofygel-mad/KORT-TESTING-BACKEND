import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { prisma } from '../../lib/prisma.js';
import * as svc from './warehouse-catalog.service.js';
import * as photosSvc from './warehouse-catalog-photos.service.js';
import {
  generateCatalogTemplate,
  parseCatalogImport,
} from './warehouse-catalog-excel.service.js';
import type {
  OrderTemplate,
  OrderTemplateSection,
} from '../orders/templates.js';

async function loadRows(buffer: Uint8Array): Promise<string[]> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(Buffer.from(buffer) as any);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  return extractColumnValues(ws);
}

function extractColumnValues(ws: ExcelJS.Worksheet): string[] {
  const rows: string[] = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const c2 = String(row.getCell(2).value ?? '').trim();
    const c1 = String(row.getCell(1).value ?? '').trim();
    const val = c2 || c1;
    if (val && val !== '0' && !/^(?:название|цвет|товар)/i.test(val)) {
      rows.push(val);
    }
  });
  return rows;
}

export async function warehouseCatalogRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate, app.resolveOrg] };

  // ── Product catalog ─────────────────────────────────────────────────────────

  app.get('/catalog/products', auth, async (req) => {
    const qs = z.object({ templateId: z.string().optional() }).parse(req.query);
    return svc.getProductCatalog(req.orgId, { templateId: qs.templateId ?? null });
  });

  app.post('/catalog/products', auth, async (req) => {
    const body = z.object({
      name: z.string().min(1),
      source: z.string().optional(),
      templateId: z.string().min(1).nullable().optional(),
      defaultRetailPrice: z.number().nonnegative().nullable().optional(),
      defaultWholesalePrice: z.number().nonnegative().nullable().optional(),
    }).parse(req.body);
    return svc.createProduct(req.orgId, body);
  });

  app.patch('/catalog/products/:id', auth, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({
      name: z.string().min(1).optional(),
      templateId: z.string().min(1).nullable().optional(),
      defaultRetailPrice: z.number().nonnegative().nullable().optional(),
      defaultWholesalePrice: z.number().nonnegative().nullable().optional(),
    }).parse(req.body);
    return svc.updateProduct(id, body);
  });

  app.delete('/catalog/products/:id', auth, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return svc.deleteProduct(id);
  });

  // NOTE: P0 removed WarehouseFieldDefinition/Option/ProductField CRUD endpoints.
  // Field metadata now lives on OrderTemplate.sections and will get its own
  // endpoints in P4. The legacy routes (/catalog/definitions/*, /catalog/products/:id/fields,
  // /catalog/seed-defaults, /catalog/import/field-options/:code, /catalog/smart-import/colors)
  // were removed to keep the surface area honest.

  app.get('/catalog/products/:productId/photos', auth, async (req) => {
    const { productId } = z.object({ productId: z.string() }).parse(req.params);
    return photosSvc.listProductPhotos(req.orgId, productId);
  });

  app.post('/catalog/products/:productId/photos', auth, async (req, reply) => {
    const { productId } = z.object({ productId: z.string() }).parse(req.params);
    const data = await req.file({ limits: { fileSize: photosSvc.MAX_BYTES } });
    if (!data) {
      return reply.status(400).send({ code: 'NO_FILE', message: 'Файл не прикреплён' });
    }
    const photo = await photosSvc.uploadProductPhoto(req.orgId, productId, {
      filename: data.filename,
      mimetype: data.mimetype,
      stream: data.file,
    });
    return reply.status(201).send(photo);
  });

  app.get('/catalog/products/:productId/photos/:photoId/file', auth, async (req, reply) => {
    const { productId, photoId } = z.object({ productId: z.string(), photoId: z.string() }).parse(req.params);
    const url = await photosSvc.getProductPhotoUrl(req.orgId, productId, photoId);
    return reply.redirect(url, 302);
  });

  app.delete('/catalog/products/:productId/photos/:photoId', auth, async (req) => {
    const { photoId } = z.object({ productId: z.string(), photoId: z.string() }).parse(req.params);
    return photosSvc.deleteProductPhoto(req.orgId, photoId);
  });

  app.get('/order-form/catalog', auth, async (req) => {
    const qs = z.object({ templateId: z.string().optional() }).parse(req.query);
    return svc.getOrderFormCatalog(req.orgId, { templateId: qs.templateId ?? null });
  });

  app.post('/availability/check-variant', auth, async (req) => {
    const body = z.object({
      productName: z.string().min(1),
      attributes: z.record(z.string(), z.string()),
    }).parse(req.body);
    return svc.checkVariantAvailability(req.orgId, body);
  });

  app.post('/catalog/smart-import/products', auth, async (req) => {
    const data = await req.file();
    if (!data) throw app.httpErrors.badRequest('Файл не найден');
    const rows = await loadRows(await data.toBuffer());
    return svc.smartImportProducts(req.orgId, rows);
  });

  app.post('/catalog/import/products', auth, async (req) => {
    const data = await req.file();
    if (!data) throw app.httpErrors.badRequest('Файл не найден');
    const rows = await loadRows(await data.toBuffer());
    return svc.importProductsFromRows(req.orgId, rows);
  });

  // ── P2: Template-aware Excel generator + importer ──────────────────────────

  /**
   * GET /catalog/template-excel?templateId=...
   * Streams an .xlsx whose columns are derived from the OrderTemplate's
   * items-section fields. Used by the «Скачать шаблон Excel» button.
   */
  app.get('/catalog/template-excel', auth, async (req, reply) => {
    const qs = z.object({ templateId: z.string().min(1) }).parse(req.query);
    const row = await prisma.orderTemplate.findFirst({
      where: { id: qs.templateId, orgId: req.orgId },
    });
    if (!row) {
      return reply
        .status(404)
        .send({ code: 'TEMPLATE_NOT_FOUND', message: 'Шаблон не найден' });
    }

    const tpl: OrderTemplate = {
      name: row.name,
      itemNoun: row.itemNoun,
      primaryUnit: row.primaryUnit,
      primaryPrecision: row.primaryPrecision,
      sections: (row.sections as unknown as OrderTemplateSection[]) ?? [],
    };

    const buffer = await generateCatalogTemplate(tpl);
    reply.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    reply.header(
      'Content-Disposition',
      `attachment; filename="catalog-${encodeURIComponent(tpl.name)}.xlsx"`,
    );
    return reply.send(buffer);
  });

  /**
   * POST /catalog/import-excel
   * Multipart upload (file) + templateId form-field. Validates that the
   * uploaded workbook's headers match the template; on mismatch returns 422
   * with the missing/found header lists for a clear UI message.
   */
  app.post('/catalog/import-excel', auth, async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply
        .status(400)
        .send({ code: 'NO_FILE', message: 'Файл не прикреплён' });
    }

    // @fastify/multipart surfaces non-file fields as `data.fields`. Each
    // entry holds `.value` for plain text. The frontend appends `templateId`
    // *before* the file so it's reliably present here.
    const fieldsRecord = (data.fields ?? {}) as Record<
      string,
      { value?: unknown } | Array<{ value?: unknown }> | undefined
    >;
    const rawTemplateField = fieldsRecord.templateId;
    const rawTemplateValue = Array.isArray(rawTemplateField)
      ? rawTemplateField[0]?.value
      : rawTemplateField?.value;
    const templateId =
      typeof rawTemplateValue === 'string' ? rawTemplateValue.trim() : '';

    if (!templateId) {
      return reply.status(400).send({
        code: 'TEMPLATE_REQUIRED',
        message: 'Не указан вид деятельности (templateId)',
      });
    }

    const row = await prisma.orderTemplate.findFirst({
      where: { id: templateId, orgId: req.orgId },
    });
    if (!row) {
      return reply
        .status(404)
        .send({ code: 'TEMPLATE_NOT_FOUND', message: 'Шаблон не найден' });
    }

    const tpl: OrderTemplate = {
      name: row.name,
      itemNoun: row.itemNoun,
      primaryUnit: row.primaryUnit,
      primaryPrecision: row.primaryPrecision,
      sections: (row.sections as unknown as OrderTemplateSection[]) ?? [],
    };

    const buffer = await data.toBuffer();
    const parsed = await parseCatalogImport(buffer, tpl);

    if (!parsed.ok) {
      return reply.status(422).send({
        error: 'TEMPLATE_MISMATCH',
        missingHeaders: parsed.missingHeaders,
        foundHeaders: parsed.foundHeaders,
        templateName: tpl.name,
      });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const r of parsed.rows) {
      try {
        await svc.createProduct(req.orgId, {
          name: r.name,
          source: 'excel_import',
          templateId: tpl ? row.id : null,
          defaultRetailPrice: r.defaultRetailPrice ?? null,
          defaultWholesalePrice: r.defaultWholesalePrice ?? null,
        });
        created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`"${r.name}": ${msg}`);
        skipped++;
      }
    }

    return reply.send({
      created,
      skipped,
      errors,
      warnings: parsed.warnings,
    });
  });
}
