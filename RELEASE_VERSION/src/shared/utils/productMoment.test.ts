import { describe, expect, it, beforeEach } from 'vitest';
import { clearProductMoment, getProductMoment, setProductMoment } from './productMoment';

describe('productMoment', () => {
  beforeEach(() => clearProductMoment());

  it('writes and reads session-scoped handoff', () => {
    setProductMoment('hello');
    expect(getProductMoment()).toBe('hello');
  });

  it('clears handoff', () => {
    setProductMoment('hello');
    clearProductMoment();
    expect(getProductMoment()).toBeNull();
  });
});
