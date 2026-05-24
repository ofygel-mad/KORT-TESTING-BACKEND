/**
 * Shared item-line formatters for order screens.
 *
 * buildItemLine     — Orders, Ready, Warehouse, OrderDetail, Production, Documents
 *                     Format: «Товар - Цвет (пол)»  (dash per requirement #18)
 *
 * buildTaskMetaLine — Production card metaLine (secondary row)
 *                     Format: «ткань · размер · дл. XX · × N»
 *                     Color / gender are now in the primary line — not repeated here.
 */

export function buildItemLine(
  item: {
    productName?: string;
    color?: string | null;
    gender?: string | null;
    attributes?: Record<string, unknown> | null;
  } | undefined | null,
): string {
  if (!item) return '';
  const productName = (item.productName ?? '').trim();

  // P5/Stage 4: when attributes exist, defer to per-attribute rendering
  // elsewhere — the primary line is just the product name. Legacy
  // clothing format kicks in only when there's no attributes payload.
  const hasAttributes =
    item.attributes
    && typeof item.attributes === 'object'
    && Object.keys(item.attributes).length > 0;

  if (hasAttributes) {
    return productName;
  }

  const color  = (item.color  ?? '').trim();
  const gender = (item.gender ?? '').trim();
  const parts: string[] = [];
  if (productName) parts.push(productName);
  if (color)       parts.push(color);
  const line = parts.join(' - ');
  if (!line) return '';
  return gender ? `${line} (${gender})` : line;
}

export function buildTaskMetaLine(task: {
  size?: string | null;
  length?: string | null;
  quantity?: number;
  // color / gender intentionally excluded — they go in the primary buildItemLine row
}): string {
  return [
    task.size,
    task.length ? `дл. ${task.length}` : '',
    (task.quantity ?? 0) > 1 ? `× ${task.quantity}` : '',
  ].filter(Boolean).join(' · ');
}
