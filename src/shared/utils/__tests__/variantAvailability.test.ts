import { describe, it, expect } from 'vitest';
import {
  buildVariantAvailabilityInput,
  buildVariantLookupKey,
  pickVariantAvailabilityAttributes,
} from '../variantAvailability';

const ALL_AXES = [
  { code: 'color',  label: 'Цвет',   inputType: 'select', isRequired: false, affectsAvailability: true,  options: [] },
  { code: 'gender', label: 'Пол',    inputType: 'select', isRequired: false, affectsAvailability: true,  options: [] },
  { code: 'length', label: 'Длина',  inputType: 'select', isRequired: false, affectsAvailability: true,  options: [] },
  { code: 'size',   label: 'Размер', inputType: 'select', isRequired: false, affectsAvailability: true,  options: [] },
];

const GENDER_OFF = ALL_AXES.map((f) => f.code === 'gender' ? { ...f, affectsAvailability: false } : f);

describe('buildVariantLookupKey', () => {
  it('builds key with all four axes when product gender axis is on', () => {
    const key = buildVariantLookupKey(
      'Абай бомбер',
      { color: 'Белый', gender: 'Мужской', length: 'Длинный', size: '38' },
      ALL_AXES,
    );
    expect(key).toBe('абай бомбер|color:белый|gender:мужской|length:длинный|size:38');
  });

  it('omits gender from key when product gender axis is off (legacy behavior)', () => {
    const key = buildVariantLookupKey(
      'Абай бомбер',
      { color: 'Белый', gender: 'Мужской', length: 'Длинный', size: '38' },
      GENDER_OFF,
    );
    expect(key).toBe('абай бомбер|color:белый|length:длинный|size:38');
  });

  it('falls back to all-axes when no fields passed (preserves prior behavior)', () => {
    const key = buildVariantLookupKey(
      'Абай бомбер',
      { color: 'Белый', gender: 'Мужской', length: 'Длинный', size: '38' },
    );
    expect(key).toBe('абай бомбер|color:белый|gender:мужской|length:длинный|size:38');
  });
});

describe('buildVariantAvailabilityInput', () => {
  it('returns null when productName is empty', () => {
    expect(buildVariantAvailabilityInput('', { color: 'red' }, ALL_AXES)).toBeNull();
  });

  it('returns null when no axes are provided', () => {
    expect(buildVariantAvailabilityInput('Абай', {}, ALL_AXES)).toBeNull();
  });

  it('drops attributes whose axis has affectsAvailability=false', () => {
    const result = buildVariantAvailabilityInput(
      'Абай',
      { color: 'Белый', gender: 'Мужской', size: '38' },
      GENDER_OFF,
    );
    // P4: input shape switched from flat to { name, attributes: {...} } so
    // arbitrary template-driven axes (concentration, material, …) can survive
    // the round-trip to the warehouse.
    expect(result).toEqual({ name: 'Абай', attributes: { color: 'Белый', size: '38' } });
  });
});

describe('pickVariantAvailabilityAttributes', () => {
  it('returns only filled attrs that pass affectsAvailability', () => {
    const result = pickVariantAvailabilityAttributes(
      'Абай',
      { color: 'Белый', gender: '', size: '38', length: undefined as unknown as string },
      ALL_AXES,
    );
    expect(result).toEqual({ color: 'Белый', size: '38' });
  });

  it('returns null when no attrs match', () => {
    const result = pickVariantAvailabilityAttributes('Абай', {}, ALL_AXES);
    expect(result).toBeNull();
  });
});
