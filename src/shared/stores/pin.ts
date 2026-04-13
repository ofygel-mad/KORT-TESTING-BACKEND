import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Device ID lives in plain localStorage — survives Zustand clears and logout
export function getDeviceId(): string {
  const KEY = 'kort-device-id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

type PinState = {
  pin: string | null;           // stored PIN digits (4)
  isTrustedDevice: boolean;     // true after successful email/password login on this device
  setPin: (pin: string) => void;
  clearPin: () => void;
  trustDevice: () => void;      // call after successful email/password auth
};

export const usePinStore = create<PinState>()(
  persist(
    (set) => ({
      pin: null,
      isTrustedDevice: false,
      setPin: (pin) => set({ pin }),
      clearPin: () => set({ pin: null }),
      trustDevice: () => set({ isTrustedDevice: true }),
    }),
    { name: 'kort-pin' },
  ),
);
