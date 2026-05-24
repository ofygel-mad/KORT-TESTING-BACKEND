// ЧАСТЬ X / P2a — context that shares the new-order form state (RHF instance,
// catalogs, derived financials, helpers) with every block component.

import { createContext, useContext } from 'react';
import type { NewOrderFormState } from './useNewOrderFormState';

const NewOrderFormContext = createContext<NewOrderFormState | null>(null);

export const NewOrderFormProvider = NewOrderFormContext.Provider;

export function useNewOrderForm(): NewOrderFormState {
  const ctx = useContext(NewOrderFormContext);
  if (!ctx) {
    throw new Error('useNewOrderForm must be used within <NewOrderFormProvider>');
  }
  return ctx;
}
