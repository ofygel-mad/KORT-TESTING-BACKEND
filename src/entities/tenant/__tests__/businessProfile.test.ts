// P1 — Defends the contract that the frontend's clothing_workshop profile
// reproduces server/src/modules/orders/status-validator.ts STATUS_TRANSITIONS
// exactly. If the server-side transitions change without an equivalent edit
// here, P2's switch to a profile-driven validator silently changes behavior.

import { describe, it, expect } from 'vitest';
import {
  CLOTHING_WORKSHOP_PROFILE,
  getBusinessProfile,
  useBusinessProfile,
} from '../businessProfile';

const SERVER_STATUS_TRANSITIONS = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['in_production', 'on_warehouse', 'cancelled'],
  in_production: ['ready', 'cancelled'],
  ready: ['transferred', 'on_warehouse', 'cancelled'],
  transferred: ['on_warehouse', 'cancelled'],
  on_warehouse: ['shipped', 'ready', 'cancelled'],
  shipped: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['ready'],
} as const;

describe('CLOTHING_WORKSHOP_PROFILE', () => {
  it('mirrors server STATUS_TRANSITIONS one-to-one', () => {
    expect(CLOTHING_WORKSHOP_PROFILE.lifecycle.transitions).toEqual(
      SERVER_STATUS_TRANSITIONS,
    );
  });

  it('lists every transitioned status in stages', () => {
    const stageSet = new Set(CLOTHING_WORKSHOP_PROFILE.lifecycle.stages);
    for (const from of Object.keys(SERVER_STATUS_TRANSITIONS)) {
      expect(stageSet.has(from as never)).toBe(true);
    }
    for (const targets of Object.values(SERVER_STATUS_TRANSITIONS)) {
      for (const to of targets) {
        expect(stageSet.has(to as never)).toBe(true);
      }
    }
  });

  it('marks completed as the only terminal status', () => {
    expect(CLOTHING_WORKSHOP_PROFILE.lifecycle.terminal).toEqual(['completed']);
  });

  it('enables every module (no gating for the original profile)', () => {
    expect(CLOTHING_WORKSHOP_PROFILE.modules).toEqual({
      production: true,
      warehouse: true,
      transit: true,
      returns: true,
      invoices: true,
    });
  });
});

describe('useBusinessProfile / getBusinessProfile', () => {
  it('returns the clothing_workshop default in P1', () => {
    expect(useBusinessProfile()).toBe(CLOTHING_WORKSHOP_PROFILE);
    expect(getBusinessProfile()).toBe(CLOTHING_WORKSHOP_PROFILE);
  });
});
