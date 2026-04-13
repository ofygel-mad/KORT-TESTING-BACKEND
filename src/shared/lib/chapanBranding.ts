type ChapanBrandingSource = {
  displayName?: string | null;
  descriptor?: string | null;
  orderPrefix?: string | null;
  publicIntakeTitle?: string | null;
  publicIntakeDescription?: string | null;
  supportLabel?: string | null;
};

export const DEFAULT_CHAPAN_DISPLAY_NAME = 'Экспериментальный модуль';
export const DEFAULT_CHAPAN_DESCRIPTOR = 'Рабочее пространство производства';
export const DEFAULT_CHAPAN_ORDER_PREFIX = 'EXP';
export const DEFAULT_CHAPAN_PUBLIC_INTAKE_TITLE = 'Экспериментальный модуль';
export const DEFAULT_CHAPAN_PUBLIC_INTAKE_DESCRIPTION = '';
export const DEFAULT_CHAPAN_SUPPORT_LABEL = '';
export const DEFAULT_CHAPAN_NAV_DESCRIPTION =
  'Рабочий модуль для управления заказами, производством и связанными процессами.';

function pickText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export function resolveChapanBranding(source?: ChapanBrandingSource | null) {
  return {
    displayName: pickText(source?.displayName, DEFAULT_CHAPAN_DISPLAY_NAME),
    descriptor: pickText(source?.descriptor, DEFAULT_CHAPAN_DESCRIPTOR),
    orderPrefix: pickText(source?.orderPrefix, DEFAULT_CHAPAN_ORDER_PREFIX),
    publicIntakeTitle: pickText(source?.publicIntakeTitle, DEFAULT_CHAPAN_PUBLIC_INTAKE_TITLE),
    publicIntakeDescription: pickText(
      source?.publicIntakeDescription,
      DEFAULT_CHAPAN_PUBLIC_INTAKE_DESCRIPTION,
    ),
    supportLabel: pickText(source?.supportLabel, DEFAULT_CHAPAN_SUPPORT_LABEL),
  };
}
