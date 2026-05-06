import { describe, expect, it } from 'vitest';
import { sanitizeDraft } from './ChapanNewOrder';

describe('ChapanNewOrder draft sanitization', () => {
  it('removes workshop comments from restored drafts', () => {
    const draft = sanitizeDraft({
      clientName: 'Client',
      items: [
        {
          productName: 'Chapan',
          size: '48',
          quantity: 1,
          unitPrice: 50000,
          workshopNotes: 'trim sleeves',
        },
      ],
    });

    expect(draft.items?.[0]?.workshopNotes).toBe('');
  });

  it('keeps other item fields untouched', () => {
    const draft = sanitizeDraft({
      items: [
        {
          productName: 'Chapan Premium',
          color: 'Blue',
          size: '50',
          quantity: 2,
          unitPrice: 65000,
          workshopNotes: 'do not persist',
        },
      ],
    });

    expect(draft.items?.[0]).toMatchObject({
      productName: 'Chapan Premium',
      color: 'Blue',
      size: '50',
      quantity: 2,
      unitPrice: 65000,
      workshopNotes: '',
    });
  });
});
