// P2 — Excel template generator + header-aware Excel importer for the Catalog.
//
// Generates an .xlsx template whose columns are derived from an OrderTemplate's
// items-section fields, and parses incoming files against the same template,
// failing hard if the headers do not match (TEMPLATE_MISMATCH).
//
// Mainstream dependency: `exceljs` (already in server/package.json).

import ExcelJS from 'exceljs';
import type { OrderTemplate, OrderTemplateField } from '../orders/templates.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Built-in column labels — always present regardless of template. */
const NAME_HEADER = 'Название';
const SKU_HEADER = 'Артикул';
const RETAIL_HEADER = 'Розница';
const WHOLESALE_HEADER = 'Опт';

/** Field kinds we surface as columns in the import/export template. */
const SUPPORTED_FIELD_TYPES: ReadonlySet<string> = new Set(['select', 'text', 'number']);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedCatalogRow {
  name: string;
  sku?: string;
  defaultRetailPrice?: number;
  defaultWholesalePrice?: number;
  attributes: Record<string, string>;
}

export type ParseResult =
  | {
      ok: true;
      rows: ParsedCatalogRow[];
      warnings: string[];
    }
  | {
      ok: false;
      error: 'TEMPLATE_MISMATCH';
      missingHeaders: string[];
      foundHeaders: string[];
    };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getItemsFields(template: OrderTemplate): OrderTemplateField[] {
  const items = template.sections.find((s) => s.kind === 'items');
  if (!items) return [];
  return items.fields.filter((f) => SUPPORTED_FIELD_TYPES.has(f.type));
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim();
}

function parseDecimal(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim().replace(/\s+/g, '').replace(',', '.');
  if (!raw) return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

function safeSheetName(name: string): string {
  // Excel sheet names: max 31 chars, no []:*?/\
  const cleaned = name.replace(/[\[\]:*?/\\]/g, '').slice(0, 31);
  return cleaned || 'Лист';
}

// ── Generator ─────────────────────────────────────────────────────────────────

export async function generateCatalogTemplate(template: OrderTemplate): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KORT';
  wb.created = new Date();

  const fields = getItemsFields(template);

  // ── Sheet 1: «Каталог» ────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Каталог');

  const headerRow: string[] = [NAME_HEADER, SKU_HEADER, RETAIL_HEADER, WHOLESALE_HEADER];
  for (const f of fields) headerRow.push(f.label);

  ws.addRow(headerRow);
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };
  header.height = 22;

  // Reasonable column widths
  ws.columns = headerRow.map((label) => ({
    header: label,
    width: Math.max(14, Math.min(40, label.length + 6)),
  }));

  // Example row (placeholders)
  const exampleRow: Array<string | number> = [];
  exampleRow.push('Например: Худи жёлтое'); // name
  exampleRow.push(''); // sku
  exampleRow.push(0); // retail
  exampleRow.push(0); // wholesale
  for (const f of fields) {
    if (f.type === 'select' && f.options && f.options.length > 0) {
      exampleRow.push(f.options[0] ?? '');
    } else if (f.type === 'number') {
      exampleRow.push(0);
    } else {
      exampleRow.push('');
    }
  }
  ws.addRow(exampleRow);

  // ── Sheet 2: «Справочники» (only if there are select-fields) ───────────────
  const selectFields = fields.filter(
    (f) => f.type === 'select' && (f.options?.length ?? 0) > 0,
  );

  if (selectFields.length > 0) {
    const refSheet = wb.addWorksheet(safeSheetName('Справочники'));
    // One column per select-field; header bold, options below.
    refSheet.addRow(selectFields.map((f) => f.label));
    refSheet.getRow(1).font = { bold: true };

    const maxOptions = Math.max(...selectFields.map((f) => f.options?.length ?? 0));
    for (let i = 0; i < maxOptions; i++) {
      const row = selectFields.map((f) => f.options?.[i] ?? '');
      refSheet.addRow(row);
    }

    refSheet.columns = selectFields.map((f) => ({
      header: f.label,
      width: Math.max(14, Math.min(40, f.label.length + 6)),
    }));
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

// ── Parser ────────────────────────────────────────────────────────────────────

export async function parseCatalogImport(
  buffer: Buffer,
  template: OrderTemplate,
): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS types are picky about Node Buffer here; cast through any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any);

  const ws = wb.worksheets[0];
  if (!ws) {
    return {
      ok: false,
      error: 'TEMPLATE_MISMATCH',
      missingHeaders: [NAME_HEADER],
      foundHeaders: [],
    };
  }

  // Read header row (first row)
  const headerRow = ws.getRow(1);
  const foundHeaders: string[] = [];
  const headerIndex = new Map<string, number>(); // label -> column index (1-based)

  // ExcelJS rows are 1-based and cells include 0/null indices — iterate explicitly.
  const colCount = ws.columnCount || headerRow.cellCount || 0;
  for (let c = 1; c <= colCount; c++) {
    const raw = headerRow.getCell(c).value;
    const label = normalizeHeader(raw);
    if (!label) continue;
    foundHeaders.push(label);
    if (!headerIndex.has(label)) headerIndex.set(label, c);
  }

  // ── Required headers: «Название» + every required template field ──────────
  const fields = getItemsFields(template);
  const requiredHeaders: string[] = [NAME_HEADER];
  for (const f of fields) {
    if (f.required) requiredHeaders.push(f.label);
  }

  const missingHeaders = requiredHeaders.filter((h) => !headerIndex.has(h));
  if (missingHeaders.length > 0) {
    return {
      ok: false,
      error: 'TEMPLATE_MISMATCH',
      missingHeaders,
      foundHeaders,
    };
  }

  // ── Row-by-row parsing ────────────────────────────────────────────────────
  const rows: ParsedCatalogRow[] = [];
  const warnings: string[] = [];

  const nameCol = headerIndex.get(NAME_HEADER)!;
  const skuCol = headerIndex.get(SKU_HEADER);
  const retailCol = headerIndex.get(RETAIL_HEADER);
  const wholesaleCol = headerIndex.get(WHOLESALE_HEADER);

  const fieldColumns = fields
    .map((f) => ({ field: f, col: headerIndex.get(f.label) }))
    .filter((x): x is { field: OrderTemplateField; col: number } => x.col !== undefined);

  const totalRows = ws.rowCount;
  for (let r = 2; r <= totalRows; r++) {
    const row = ws.getRow(r);
    const rawName = normalizeHeader(row.getCell(nameCol).value);
    if (!rawName) continue; // skip blank rows

    const attributes: Record<string, string> = {};
    for (const { field, col } of fieldColumns) {
      const raw = normalizeHeader(row.getCell(col).value);
      if (!raw) continue;
      // Validate select-options
      if (field.type === 'select' && field.options && field.options.length > 0) {
        if (!field.options.includes(raw)) {
          warnings.push(
            `Строка ${r}, поле «${field.label}»: значение «${raw}» не в списке допустимых.`,
          );
          continue;
        }
      }
      attributes[field.key] = raw;
    }

    const sku = skuCol ? normalizeHeader(row.getCell(skuCol).value) : '';
    const retail = retailCol ? parseDecimal(row.getCell(retailCol).value) : undefined;
    const wholesale = wholesaleCol ? parseDecimal(row.getCell(wholesaleCol).value) : undefined;

    rows.push({
      name: rawName,
      sku: sku || undefined,
      defaultRetailPrice: retail,
      defaultWholesalePrice: wholesale,
      attributes,
    });
  }

  return { ok: true, rows, warnings };
}
