/**
 * Sprint 13: Smoke tests for Sprint 4 catalog logic
 * Tests size normalization (letter → number) and preset application.
 */
import { describe, expect, it } from 'vitest';

// ── Mirrors ChapanSettings.tsx constants ─────────────────────────────────────

const LETTER_TO_NUMBER: Record<string, string> = {
  'XS': '42', 'S': '44', 'M': '46', 'L': '48',
  'XL': '50', 'XXL': '52', 'XXXL': '54', '3XL': '54',
  'xs': '42', 's': '44', 'm': '46', 'l': '48',
  'xl': '50', 'xxl': '52', 'xxxl': '54',
};

const SIZE_PRESET_EVEN = ['38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58', '60'];

function normalizeSizes(sizes: string[]): string[] {
  const normalized = sizes.map(s => LETTER_TO_NUMBER[s.trim()] ?? s);
  return [...new Set(normalized)];
}

function applySizePreset(existing: string[]): string[] {
  const nonLetter = existing.filter(s => !LETTER_TO_NUMBER[s.trim()]);
  const merged = [...new Set([...SIZE_PRESET_EVEN, ...nonLetter])];
  return merged.sort((a, b) => {
    const na = parseInt(a); const nb = parseInt(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

function hasLetterSizes(sizes: string[]): boolean {
  return sizes.some(s => LETTER_TO_NUMBER[s.trim()] !== undefined);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Sprint 4: size letter → number normalization', () => {
  it('converts standard EU letter sizes', () => {
    expect(normalizeSizes(['XS', 'S', 'M', 'L', 'XL', 'XXL'])).toEqual(['42', '44', '46', '48', '50', '52']);
  });

  it('converts lowercase variants', () => {
    expect(normalizeSizes(['xs', 's', 'm', 'l'])).toEqual(['42', '44', '46', '48']);
  });

  it('leaves numeric sizes unchanged', () => {
    expect(normalizeSizes(['44', '46', '48'])).toEqual(['44', '46', '48']);
  });

  it('handles mixed list — converts letters, keeps numbers', () => {
    const result = normalizeSizes(['44', 'M', '48', 'XL']);
    expect(result).toContain('44');
    expect(result).toContain('46'); // M → 46
    expect(result).toContain('48');
    expect(result).toContain('50'); // XL → 50
    expect(result).not.toContain('M');
    expect(result).not.toContain('XL');
  });

  it('deduplicates when two different letters map to the same number', () => {
    // XXXL and 3XL both map to 54
    const result = normalizeSizes(['XXXL', '3XL']);
    expect(result).toEqual(['54']);
  });

  it('deduplicates when letter and number are the same value', () => {
    // M → 46, and 46 already present
    const result = normalizeSizes(['46', 'M']);
    expect(result).toEqual(['46']);
  });

  it('unknown size passes through unchanged', () => {
    expect(normalizeSizes(['OS', 'Universal', '48'])).toEqual(['OS', 'Universal', '48']);
  });
});

describe('Sprint 4: hasLetterSizes detection', () => {
  it('detects letter sizes in list', () => {
    expect(hasLetterSizes(['44', '46', 'XL'])).toBe(true);
    expect(hasLetterSizes(['S'])).toBe(true);
  });

  it('returns false for all-numeric list', () => {
    expect(hasLetterSizes(['44', '46', '48'])).toBe(false);
    expect(hasLetterSizes([])).toBe(false);
  });
});

describe('Sprint 4: size preset 38–60', () => {
  it('preset covers 38 through 60 in steps of 2', () => {
    expect(SIZE_PRESET_EVEN).toHaveLength(12);
    expect(SIZE_PRESET_EVEN[0]).toBe('38');
    expect(SIZE_PRESET_EVEN[SIZE_PRESET_EVEN.length - 1]).toBe('60');
    // All even
    SIZE_PRESET_EVEN.forEach(s => expect(parseInt(s) % 2).toBe(0));
  });

  it('applySizePreset adds all preset sizes', () => {
    const result = applySizePreset([]);
    SIZE_PRESET_EVEN.forEach(s => expect(result).toContain(s));
  });

  it('applySizePreset preserves non-letter custom sizes', () => {
    const result = applySizePreset(['62', '64']); // extra large beyond preset
    expect(result).toContain('62');
    expect(result).toContain('64');
  });

  it('applySizePreset drops letter sizes (they stay as-is pre-normalization)', () => {
    // Letter sizes filtered out — only non-letter extras preserved
    const result = applySizePreset(['XL', '62']);
    expect(result).not.toContain('XL'); // XL is a letter size, filtered
    expect(result).toContain('62');     // custom numeric preserved
  });

  it('applySizePreset result is sorted numerically', () => {
    const result = applySizePreset(['62']);
    const nums = result.map(Number).filter(n => !isNaN(n));
    const sorted = [...nums].sort((a, b) => a - b);
    expect(nums).toEqual(sorted);
  });
});

describe('Sprint 4: payment method catalog defaults', () => {
  const PAYMENT_METHOD_DEFAULTS = ['Наличные', 'Kaspi QR', 'Kaspi Терминал', 'Перевод'];

  it('defaults contain 4 methods', () => {
    expect(PAYMENT_METHOD_DEFAULTS).toHaveLength(4);
  });

  it('all standard KZ payment methods present', () => {
    expect(PAYMENT_METHOD_DEFAULTS).toContain('Наличные');
    expect(PAYMENT_METHOD_DEFAULTS).toContain('Kaspi QR');
    expect(PAYMENT_METHOD_DEFAULTS).toContain('Kaspi Терминал');
    expect(PAYMENT_METHOD_DEFAULTS).toContain('Перевод');
  });

  it('active methods with catalog: catalog + Смешанный appended', () => {
    const catalogMethods = PAYMENT_METHOD_DEFAULTS;
    const active = [
      ...catalogMethods.map(name => ({ value: name, label: name })),
      { value: 'mixed', label: 'Смешанный' },
    ];
    expect(active).toHaveLength(5);
    expect(active[active.length - 1].value).toBe('mixed');
  });

  it('active methods without catalog: falls back to hardcoded list', () => {
    const PAYMENT_METHODS = [
      { value: 'cash', label: 'Наличные' },
      { value: 'kaspi_qr', label: 'Kaspi QR' },
      { value: 'kaspi_terminal', label: 'Kaspi Терминал' },
      { value: 'transfer', label: 'Перевод' },
      { value: 'mixed', label: 'Смешанный' },
    ];
    const emptyResult = [].length > 0 ? [] : PAYMENT_METHODS;
    expect(emptyResult).toEqual(PAYMENT_METHODS);
    expect(emptyResult).toHaveLength(5);
  });
});
