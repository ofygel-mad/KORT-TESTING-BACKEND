const ORDER_ITEM_SUFFIX_RE = /-(\d+)$/;

function trimOrderNumber(value: string): string {
  return value.trim().replace(/^#/, '').replace(/\s+/g, ' ');
}

export function stripOrderItemSuffix(orderNumber: string): string {
  return trimOrderNumber(orderNumber).replace(ORDER_ITEM_SUFFIX_RE, '');
}

export function formatOrderItemNumber(orderNumber: string, position?: number | null): string {
  const baseOrderNumber = stripOrderItemSuffix(orderNumber);
  const numericPosition = Number(position);

  if (Number.isFinite(numericPosition) && numericPosition > 0) {
    return `${baseOrderNumber}-${Math.trunc(numericPosition)}`;
  }

  return baseOrderNumber;
}
