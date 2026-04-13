/**
 * Sprint 13: Smoke tests for D2/S8 item line format
 * Tests buildItemLine — the unified "Товар - Цвет (пол)" formatter.
 * Separator is dash (-) per requirement #18.
 */
import { describe, expect, it } from 'vitest';
import { buildItemLine } from '../../../../shared/utils/itemLine';

describe('D2/S8: buildItemLine', () => {
  it('product name only', () => {
    expect(buildItemLine({ productName: 'Шапан' })).toBe('Шапан');
  });

  it('product + color', () => {
    expect(buildItemLine({ productName: 'Шапан', color: 'Синий' })).toBe('Шапан - Синий');
  });

  it('product + color + gender', () => {
    expect(buildItemLine({ productName: 'Шапан', color: 'Тёмно-синий', gender: 'муж' }))
      .toBe('Шапан - Тёмно-синий (муж)');
  });

  it('product + gender, no color', () => {
    expect(buildItemLine({ productName: 'Шапан', gender: 'жен' })).toBe('Шапан (жен)');
  });

  it('null color and gender render cleanly', () => {
    expect(buildItemLine({ productName: 'Шапан', color: null, gender: null })).toBe('Шапан');
  });

  it('empty item renders empty string', () => {
    expect(buildItemLine({})).toBe('');
  });

  it('undefined item renders empty string', () => {
    expect(buildItemLine(undefined)).toBe('');
  });

  it('null item renders empty string', () => {
    expect(buildItemLine(null)).toBe('');
  });
});
