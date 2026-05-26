/**
 * Unit tests for `warehouse-catalog-excel.service.ts` (P10b).
 *
 * Pure tests (no DB) — exercise the round-trip:
 *   generateCatalogTemplate(template) → .xlsx Buffer → parseCatalogImport(buf, template)
 *
 * Plus negative paths for TEMPLATE_MISMATCH.
 *
 * Fixtures are system templates from `modules/orders/templates.ts` so any
 * future schema drift in those seeds is caught here.
 */

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';

import {
  generateCatalogTemplate,
  parseCatalogImport,
} from '../warehouse-catalog-excel.service.js';
import {
  BLANK_TEMPLATE,
  CHEMICALS_TEMPLATE,
  CLOTHING_TEMPLATE,
  SERVICES_TEMPLATE,
  type OrderTemplate,
  type OrderTemplateSeed,
} from '../../orders/templates.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Seeds carry every field OrderTemplate needs at runtime; the service only
 * reads `sections`, but we keep the rest for fidelity.
 */
function asOrderTemplate(seed: OrderTemplateSeed): OrderTemplate {
  return {
    name: seed.name,
    itemNoun: seed.itemNoun,
    primaryUnit: seed.primaryUnit,
    primaryPrecision: seed.primaryPrecision,
    sections: seed.sections,
  };
}

async function loadBuffer(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buf as any);
  return wb;
}

function getHeaderRow(ws: ExcelJS.Worksheet): string[] {
  const row = ws.getRow(1);
  const cols = ws.columnCount || row.cellCount || 0;
  const out: string[] = [];
  for (let c = 1; c <= cols; c++) {
    const v = row.getCell(c).value;
    out.push(String(v ?? '').trim());
  }
  return out;
}

/**
 * Append a data row to the «Каталог» sheet of an existing generated buffer
 * and return the modified buffer. Header is already row 1, sample at row 2;
 * we append starting at row 3+.
 */
async function appendRows(
  buf: Buffer,
  rows: Array<Array<string | number | null>>,
): Promise<Buffer> {
  const wb = await loadBuffer(buf);
  const ws = wb.getWorksheet('Каталог')!;
  // Drop the sample row at index 2 so parser sees only our data.
  ws.spliceRows(2, 1);
  for (const r of rows) ws.addRow(r);
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

// ── A. generateCatalogTemplate ────────────────────────────────────────────────

describe('generateCatalogTemplate', () => {
  it('Clothing: writes built-in + items-field headers using field labels', async () => {
    const buf = await generateCatalogTemplate(asOrderTemplate(CLOTHING_TEMPLATE));
    const wb = await loadBuffer(buf);
    const ws = wb.getWorksheet('Каталог')!;
    const headers = getHeaderRow(ws);

    // Built-in four come first, then items fields in declaration order.
    expect(headers.slice(0, 4)).toEqual(['Название', 'Артикул', 'Розница', 'Опт']);
    // CLOTHING items: product (text), gender (select), color (text),
    // length (text), size (text) — all of which surface as columns.
    expect(headers).toEqual([
      'Название',
      'Артикул',
      'Розница',
      'Опт',
      'Товар',
      'Пол',
      'Цвет',
      'Длина',
      'Размер',
    ]);
  });

  it('Clothing: «Справочники» sheet lists options for every select field', async () => {
    const buf = await generateCatalogTemplate(asOrderTemplate(CLOTHING_TEMPLATE));
    const wb = await loadBuffer(buf);
    const ref = wb.getWorksheet('Справочники');
    expect(ref).toBeDefined();

    const header = getHeaderRow(ref!);
    // CLOTHING has exactly one select field with options: gender (Пол).
    expect(header).toEqual(['Пол']);

    // The options must appear as rows below the header.
    const collected: string[] = [];
    for (let r = 2; r <= ref!.rowCount; r++) {
      const v = ref!.getRow(r).getCell(1).value;
      const s = String(v ?? '').trim();
      if (s) collected.push(s);
    }
    expect(collected).toEqual(['муж', 'жен']);
  });

  it('Chemicals: headers reflect items-field labels (Концентрация, Класс опасности, …)', async () => {
    const buf = await generateCatalogTemplate(asOrderTemplate(CHEMICALS_TEMPLATE));
    const wb = await loadBuffer(buf);
    const ws = wb.getWorksheet('Каталог')!;
    const headers = getHeaderRow(ws);

    // CHEMICALS items fields surface (file fields are excluded by SUPPORTED_FIELD_TYPES).
    expect(headers).toEqual([
      'Название',
      'Артикул',
      'Розница',
      'Опт',
      'Продукт',
      'Партия',
      'Концентрация',
      'Класс опасности',
      'Упаковка',
    ]);
  });

  it('Chemicals: «Справочники» sheet has columns for hazard + packaging', async () => {
    const buf = await generateCatalogTemplate(asOrderTemplate(CHEMICALS_TEMPLATE));
    const wb = await loadBuffer(buf);
    const ref = wb.getWorksheet('Справочники')!;
    const header = getHeaderRow(ref);
    expect(header).toEqual(['Класс опасности', 'Упаковка']);
  });

  it('Services: headers contain only the four built-ins + text fields (no «Справочники»)', async () => {
    const buf = await generateCatalogTemplate(asOrderTemplate(SERVICES_TEMPLATE));
    const wb = await loadBuffer(buf);
    const ws = wb.getWorksheet('Каталог')!;
    const headers = getHeaderRow(ws);

    // SERVICES items: product (text), performer (text), hours (number),
    // notes (longtext — NOT in SUPPORTED_FIELD_TYPES → skipped).
    expect(headers).toEqual([
      'Название',
      'Артикул',
      'Розница',
      'Опт',
      'Услуга',
      'Исполнитель',
      'Часы',
    ]);

    // SERVICES has zero select fields → no reference sheet.
    expect(wb.getWorksheet('Справочники')).toBeUndefined();
  });

  it('Buffer is a valid .xlsx (ZIP PK signature)', async () => {
    const buf = await generateCatalogTemplate(asOrderTemplate(CLOTHING_TEMPLATE));
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
    // .xlsx is a ZIP — first four bytes are the local-file-header signature.
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it('Header row is bold (row 1 styling)', async () => {
    const buf = await generateCatalogTemplate(asOrderTemplate(CLOTHING_TEMPLATE));
    const wb = await loadBuffer(buf);
    const ws = wb.getWorksheet('Каталог')!;
    const row1 = ws.getRow(1);
    // ExcelJS may serialise font on the row or per cell; check both surfaces.
    const rowBold = (row1.font as ExcelJS.Font | undefined)?.bold === true;
    const firstCellBold = ((row1.getCell(1).font as ExcelJS.Font | undefined)?.bold) === true;
    expect(rowBold || firstCellBold).toBe(true);
  });

  it('Includes a sample row at row 2 with the «Например…» placeholder name', async () => {
    const buf = await generateCatalogTemplate(asOrderTemplate(CLOTHING_TEMPLATE));
    const wb = await loadBuffer(buf);
    const ws = wb.getWorksheet('Каталог')!;
    const row2 = ws.getRow(2);
    const name = String(row2.getCell(1).value ?? '');
    expect(name).toMatch(/^Например/);
  });

  it('Headers use field.label (not field.key) — UX requirement', async () => {
    const buf = await generateCatalogTemplate(asOrderTemplate(CLOTHING_TEMPLATE));
    const wb = await loadBuffer(buf);
    const ws = wb.getWorksheet('Каталог')!;
    const headers = getHeaderRow(ws);

    // CLOTHING's size field has key=`size`, label=`Размер`. The Cyrillic
    // label must be what shows up, not the latin key.
    expect(headers).toContain('Размер');
    expect(headers).not.toContain('size');
  });
});

// ── B. parseCatalogImport — happy path ────────────────────────────────────────

describe('parseCatalogImport (happy path)', () => {
  it('Round-trip Chemicals: 3 rows parsed with attributes by field.key', async () => {
    const tpl = asOrderTemplate(CHEMICALS_TEMPLATE);
    const buf = await generateCatalogTemplate(tpl);

    const filled = await appendRows(buf, [
      // [Название, Артикул, Розница, Опт, Продукт, Партия, Концентрация, Класс опасности, Упаковка]
      ['Серная кислота', 'SKU-1', 1000, 800, 'H2SO4', 'LOT-A', '98%', 'III', 'IBC 1000л'],
      ['Едкий натр',     'SKU-2', 500,  400, 'NaOH',  'LOT-B', '50%', 'IV', 'Мешок 25кг'],
      ['Аммиак',         'SKU-3', 250,  200, 'NH3',   'LOT-C', '25%', '—',  'Россыпь'],
    ]);

    const r = await parseCatalogImport(filled, tpl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.rows).toHaveLength(3);
    expect(r.warnings).toEqual([]);

    expect(r.rows[0]).toMatchObject({
      name: 'Серная кислота',
      sku: 'SKU-1',
      defaultRetailPrice: 1000,
      defaultWholesalePrice: 800,
      attributes: {
        product: 'H2SO4',
        lot: 'LOT-A',
        concentration: '98%',
        hazard: 'III',
        packaging: 'IBC 1000л',
      },
    });
    expect(r.rows[2].name).toBe('Аммиак');
    expect(r.rows[2].attributes.hazard).toBe('—');
  });

  it('Parses Russian-style numbers ("1 500,50" → 1500.5)', async () => {
    const tpl = asOrderTemplate(BLANK_TEMPLATE);
    const buf = await generateCatalogTemplate(tpl);

    // BLANK items field is `product` (text, required) — column 5.
    const filled = await appendRows(buf, [
      ['Тестовый товар', 'SKU-X', '1 500,50', '1 200,00', 'Описание'],
    ]);

    const r = await parseCatalogImport(filled, tpl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].defaultRetailPrice).toBe(1500.5);
    expect(r.rows[0].defaultWholesalePrice).toBe(1200);
  });

  it('Empty optional cells are absent from attributes map', async () => {
    const tpl = asOrderTemplate(CHEMICALS_TEMPLATE);
    const buf = await generateCatalogTemplate(tpl);

    // Leave hazard + packaging + concentration empty.
    const filled = await appendRows(buf, [
      ['Соль', '', 100, 80, 'NaCl', '', '', '', ''],
    ]);

    const r = await parseCatalogImport(filled, tpl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.rows).toHaveLength(1);
    const attrs = r.rows[0].attributes;
    expect(attrs.product).toBe('NaCl');
    expect(attrs).not.toHaveProperty('lot');
    expect(attrs).not.toHaveProperty('concentration');
    expect(attrs).not.toHaveProperty('hazard');
    expect(attrs).not.toHaveProperty('packaging');
    expect(r.rows[0].sku).toBeUndefined();
  });

  it('Whitespace is trimmed from name + attribute values', async () => {
    const tpl = asOrderTemplate(CHEMICALS_TEMPLATE);
    const buf = await generateCatalogTemplate(tpl);

    const filled = await appendRows(buf, [
      ['  Соляная кислота  ', '  SKU-W  ', 300, 250, '  HCl  ', '  LOT-W  ', ' 36% ', 'II', 'Россыпь'],
    ]);

    const r = await parseCatalogImport(filled, tpl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.rows[0].name).toBe('Соляная кислота');
    expect(r.rows[0].sku).toBe('SKU-W');
    expect(r.rows[0].attributes.product).toBe('HCl');
    expect(r.rows[0].attributes.lot).toBe('LOT-W');
    expect(r.rows[0].attributes.concentration).toBe('36%');
  });

  it('Select value not in options → warning, attribute skipped, row still kept', async () => {
    const tpl = asOrderTemplate(CHEMICALS_TEMPLATE);
    const buf = await generateCatalogTemplate(tpl);

    // hazard cell carries an invalid value "X" — must produce a warning.
    const filled = await appendRows(buf, [
      ['Кислота', 'SKU-Q', 100, 80, 'HX', 'LOT-Q', '10%', 'X', 'Россыпь'],
    ]);

    const r = await parseCatalogImport(filled, tpl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].attributes).not.toHaveProperty('hazard');
    expect(r.rows[0].attributes.packaging).toBe('Россыпь');
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings.some((w) => w.includes('Класс опасности'))).toBe(true);
  });
});

// ── C. parseCatalogImport — TEMPLATE_MISMATCH ─────────────────────────────────

describe('parseCatalogImport (TEMPLATE_MISMATCH)', () => {
  it('Excel generated for Clothing parsed as Chemicals → mismatch with diagnostics', async () => {
    const clothingBuf = await generateCatalogTemplate(asOrderTemplate(CLOTHING_TEMPLATE));
    const r = await parseCatalogImport(clothingBuf, asOrderTemplate(CHEMICALS_TEMPLATE));

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('TEMPLATE_MISMATCH');
    // CHEMICALS required headers include «Название» (present) + «Продукт» (the
    // only items field with required=true). «Название» exists in clothing too.
    expect(r.missingHeaders).toContain('Продукт');
    // foundHeaders should reflect the clothing template columns.
    expect(r.foundHeaders).toEqual(
      expect.arrayContaining(['Название', 'Артикул', 'Розница', 'Опт', 'Пол']),
    );
  });

  it('Empty .xlsx (no headers at all) → mismatch citing «Название»', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Каталог');
    const ab = await wb.xlsx.writeBuffer();
    const buf = Buffer.from(ab as ArrayBuffer);

    const r = await parseCatalogImport(buf, asOrderTemplate(CLOTHING_TEMPLATE));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('TEMPLATE_MISMATCH');
    expect(r.missingHeaders).toContain('Название');
  });

  it('Wrong arbitrary headers → mismatch (all required missing, found echoed back)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Каталог');
    ws.addRow(['Foo', 'Bar', 'Baz']);
    const ab = await wb.xlsx.writeBuffer();
    const buf = Buffer.from(ab as ArrayBuffer);

    const r = await parseCatalogImport(buf, asOrderTemplate(CLOTHING_TEMPLATE));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('TEMPLATE_MISMATCH');
    expect(r.missingHeaders).toEqual(expect.arrayContaining(['Название']));
    expect(r.foundHeaders).toEqual(['Foo', 'Bar', 'Baz']);
  });

  it('Optional fields absent in workbook → still ok (only required headers gate)', async () => {
    // Hand-build a sheet with ONLY the four built-ins + the one required
    // CHEMICALS items field («Продукт»). Drop all optional headers.
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Каталог');
    ws.addRow(['Название', 'Артикул', 'Розница', 'Опт', 'Продукт']);
    ws.addRow(['Серная', 'S-1', 100, 80, 'H2SO4']);
    const ab = await wb.xlsx.writeBuffer();
    const buf = Buffer.from(ab as ArrayBuffer);

    const r = await parseCatalogImport(buf, asOrderTemplate(CHEMICALS_TEMPLATE));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].name).toBe('Серная');
    expect(r.rows[0].attributes.product).toBe('H2SO4');
  });
});

// ── D. Edge cases ─────────────────────────────────────────────────────────────

describe('parseCatalogImport (edge cases)', () => {
  it('Headers only, no data rows → ok with empty rows + no warnings', async () => {
    const tpl = asOrderTemplate(CHEMICALS_TEMPLATE);
    const buf = await generateCatalogTemplate(tpl);

    // Drop the sample row so the worksheet has only the header row.
    const wb = await loadBuffer(buf);
    const ws = wb.getWorksheet('Каталог')!;
    ws.spliceRows(2, 1);
    const ab = await wb.xlsx.writeBuffer();
    const empty = Buffer.from(ab as ArrayBuffer);

    const r = await parseCatalogImport(empty, tpl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('Non-numeric price cell → row kept, price set to undefined (no throw, no warning)', async () => {
    const tpl = asOrderTemplate(BLANK_TEMPLATE);
    const buf = await generateCatalogTemplate(tpl);

    const filled = await appendRows(buf, [
      ['Товар', 'SKU-Z', 'не число', '???', 'Опис'],
    ]);

    const r = await parseCatalogImport(filled, tpl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].defaultRetailPrice).toBeUndefined();
    expect(r.rows[0].defaultWholesalePrice).toBeUndefined();
    expect(r.rows[0].name).toBe('Товар');
  });

  it('Blank-name rows are skipped silently', async () => {
    const tpl = asOrderTemplate(BLANK_TEMPLATE);
    const buf = await generateCatalogTemplate(tpl);

    const filled = await appendRows(buf, [
      ['Реальная позиция', 'SKU-A', 10, 8, 'p1'],
      ['', '', '', '', ''],
      ['Ещё одна', 'SKU-B', 20, 16, 'p2'],
    ]);

    const r = await parseCatalogImport(filled, tpl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows.map((x) => x.name)).toEqual(['Реальная позиция', 'Ещё одна']);
  });
});
