// ЧАСТЬ X / P2b — new-order block registry: manifest block id → component.
// Co-located with the blocks (the feature owns its registry; shared/ must not
// import features/). Every manifest `new-order` block id must have an entry —
// guarded by the parity test.

import type { ComponentType } from 'react';
import { ClientBlock } from './blocks/ClientBlock';
import { LineItemsBlock } from './blocks/LineItemsBlock';
import { DatesBlock } from './blocks/DatesBlock';
import { PaymentBlock } from './blocks/PaymentBlock';
import { NotesBlock } from './blocks/NotesBlock';

export const NEW_ORDER_BLOCKS: Record<string, ComponentType> = {
  'client': ClientBlock,
  'line-items': LineItemsBlock,
  'dates': DatesBlock,
  'payment': PaymentBlock,
  'notes': NotesBlock,
};
