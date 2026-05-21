import { create } from 'zustand';

interface OperationsUiState {
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  invoicesDrawerOpen: boolean;
  invoicesDrawerFilter: string;
  setInvoicesDrawerOpen: (open: boolean) => void;
  openInvoicesDrawer: (filter?: string) => void;
  // Order filters state
  orderFilters: {
    search: string;
    statusFilter: string;
    payFilter: string;
    managerFilter: string;
    calendarDate: Date | null;
  };
  setOrderFilters: (filters: Partial<OperationsUiState['orderFilters']>) => void;
  resetOrderFilters: () => void;
}

export const useOperationsUiStore = create<OperationsUiState>((set) => {
  const initialFilters = {
    search: '',
    statusFilter: '',
    payFilter: '',
    managerFilter: '',
    calendarDate: null as Date | null,
  };

  return {
    // selectedOrderId is transient UI navigation state — not durable business data.
    selectedOrderId: null,
    setSelectedOrderId: (id) => set({ selectedOrderId: id }),
    invoicesDrawerOpen: false,
    invoicesDrawerFilter: 'all',
    setInvoicesDrawerOpen: (open) => set({ invoicesDrawerOpen: open }),
    openInvoicesDrawer: (filter = 'all') => set({ invoicesDrawerOpen: true, invoicesDrawerFilter: filter }),
    orderFilters: initialFilters,
    setOrderFilters: (filters) => set((state) => ({
      orderFilters: { ...state.orderFilters, ...filters },
    })),
    resetOrderFilters: () => set({ orderFilters: initialFilters }),
  };
});
