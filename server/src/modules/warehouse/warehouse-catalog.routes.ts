import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import * as svc from './warehouse-catalog.service.js';
import * as photosSvc from './warehouse-catalog-photos.service.js';

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
    return svc.getProductCatalog(req.orgId);
  });

  app.post('/catalog/products', auth, async (req) => {
    const body = z.object({
      name: z.string().min(1),
      source: z.string().optional(),
    }).parse(req.body);
    return svc.createProduct(req.orgId, body);
  });

  app.patch('/catalog/products/:id', auth, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ name: z.string().min(1) }).parse(req.body);
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
    return svc.getOrderFormCatalog(req.orgId);
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
}
