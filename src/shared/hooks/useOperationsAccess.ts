import { useEmployeePermissions } from './useEmployeePermissions';

/**
 * Access flags for the operations screens (orders, production, warehouse,
 * logistics, invoices, etc). Maps the scope.action permission model onto the
 * boolean flags those screens consume.
 */
export function useOperationsAccess() {
  const { can, canAny, isCompanyAdmin } = useEmployeePermissions();

  const canAccessOrders = canAny('orders.read', 'orders.write', 'orders.admin');
  const canAccessProduction = canAny('production.read', 'production.write', 'production.manage');
  const canAccessReady = canAny('production.read', 'production.write', 'production.manage');
  const canAccessArchive = canAccessOrders;
  const canAccessInvoices = canAny('invoices.read', 'invoices.write', 'invoices.confirm');
  const canAccessShipping = canAny('logistics.read', 'logistics.write');
  const isWarehouseOperator = canAny('warehouse.write', 'warehouse.admin');
  const canAccessWarehouseNav = canAny('warehouse.read', 'warehouse.write', 'warehouse.admin');

  return {
    canAccessOrders,
    canCreateOrder: can('orders.write'),
    canAccessProduction,
    canManageProduction: can('production.manage'),
    canAccessReady,
    canAccessArchive,
    canRestoreArchive: can('orders.write'),
    canReassignManager: can('orders.admin'),
    canAccessInvoices,
    canConfirmInvoice: can('invoices.confirm'),
    canConfirmInvoiceReceipt: can('invoices.confirm'),
    canRejectInvoice: can('invoices.confirm'),
    canEditInvoicePrices: can('invoices.write'),
    canAccessWarehouseNav,
    isWarehouseOperator,
    canAccessShipping,
    canShipOrders: can('logistics.write'),
    canShipWithoutPayment: can('logistics.write'),
    canAccessAnalytics: can('reports.read'),
    canAccessPurchase: canAny('purchase.read', 'purchase.write'),
    canAccessClients: canAny('customers.read', 'customers.write'),
    canManageSettings: isCompanyAdmin,
    hasAnyAccess:
      canAccessOrders || canAccessProduction || canAccessReady
      || canAccessArchive || canAccessInvoices || isCompanyAdmin,
  };
}
