import { createBrowserRouter, Navigate, NavLink, RouterProvider } from 'react-router-dom';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { AppShell } from '../layout/AppShell';
import { PageLoader } from '@/shared/ui/PageLoader';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { isChunkLoadError, reloadForChunkErrorOnce } from '@/shared/lib/browser';
import { useAuthStore } from '@/shared/stores/auth';
import { usePlan, planIncludes, PLAN_LABELS, type OrgMode } from '@/shared/hooks/usePlan';
import { useEmployeePermissions } from '@/shared/hooks/useEmployeePermissions';
import type { Permission } from '@/entities/employee/types';
import KaspiStagePage from '@/features/auth/pages/sales/channels/kaspi/KaspiStagePage';
import KaspiStockPage from '@/features/auth/pages/sales/channels/kaspi/KaspiStockPage';

import { Settings } from 'lucide-react';

function makePage(imp: () => Promise<{ default: ComponentType }>) {
  const Comp = lazy(async () => {
    try {
      return await imp();
    } catch (error) {
      if (isChunkLoadError(error) && reloadForChunkErrorOnce()) {
        return new Promise<{ default: ComponentType }>(() => undefined);
      }
      throw error;
    }
  });
  return function LazyPage() {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Comp />
        </Suspense>
      </ErrorBoundary>
    );
  };
}

// Core pages
const CanvasPage     = makePage(() => import('@/features/auth/pages/canvas'));
const LeadsPage      = makePage(() => import('@/features/auth/pages/crm/leads'));
const DealsPage      = makePage(() => import('@/features/auth/pages/crm/deals'));
const CustomersPage  = makePage(() => import('@/features/auth/pages/crm/customers'));
const TasksPage      = makePage(() => import('@/features/auth/pages/crm/tasks'));
const WarehousePage  = makePage(() => import('@/features/auth/pages/warehouse'));
const WarehouseTwinPage = makePage(() => import('@/features/auth/pages/warehouse/Twin'));
const WarehouseOperationsPage = makePage(() => import('@/features/auth/pages/warehouse/Operations'));
const WarehouseControlTowerPage = makePage(() => import('@/features/auth/pages/warehouse/ControlTower'));
const FinancePage    = makePage(() => import('@/features/auth/pages/finance'));
const EmployeesPage  = makePage(() => import('@/features/auth/pages/employees'));
const ReportsPage    = makePage(() => import('@/features/auth/pages/reports'));
const DocumentsPage  = makePage(() => import('@/features/auth/pages/documents'));
const SettingsPage   = makePage(() => import('@/features/auth/pages/settings'));
const OnboardingPage = makePage(() => import('@/features/auth/pages/onboarding'));

// Landing page (public)
const LandingPage = makePage(() => import('@/features/auth/pages/landing'));

// Dev panel — no auth, service password only
const DevPanelPage = makePage(() => import('@/features/auth/pages/dev'));

// Auth pages
const LoginPage         = makePage(() => import('@/features/auth/pages/auth/login'));
const AcceptInvitePage  = makePage(() => import('@/features/auth/pages/auth/accept-invite'));
const ResetPasswordPage = makePage(() => import('@/features/auth/pages/auth/reset-password'));

// Sales (orders, archive, returns, Kaspi channel)
const OrdersPage        = makePage(() => import('@/features/auth/pages/sales/OrdersPage'));
const NewOrderPage      = makePage(() => import('@/features/auth/pages/sales/NewOrderPage'));
const OrderDetailPage   = makePage(() => import('@/features/auth/pages/sales/OrderDetailPage'));
const EditOrderPage     = makePage(() => import('@/features/auth/pages/sales/EditOrderPage'));
const OrderTrashPage    = makePage(() => import('@/features/auth/pages/sales/OrderTrashPage'));
const ArchivePage       = makePage(() => import('@/features/auth/pages/sales/ArchivePage'));
const ReturnsPage       = makePage(() => import('@/features/auth/pages/sales/returns/ReturnsPage'));
const KaspiOrdersPage   = makePage(() => import('@/features/auth/pages/sales/channels/kaspi/KaspiOrdersPage'));
const KaspiOrderDetailPage = makePage(() => import('@/features/auth/pages/sales/channels/kaspi/KaspiOrderDetailPage'));

// Production (workshop + ready stage)
const ProductionFloorPage = makePage(() => import('@/features/auth/pages/production/ProductionFloorPage'));
const ReadyPage           = makePage(() => import('@/features/auth/pages/production/ReadyPage'));

// Logistics (shipping)
const LogisticsPage = makePage(() => import('@/features/auth/pages/logistics/LogisticsPage'));

// Products catalog
const ProductsPage = makePage(() => import('@/features/auth/pages/products/ProductsPage'));

// Warehouse stock + purchase
const WarehouseStockPage = makePage(() => import('@/features/auth/pages/warehouse/stock/WarehousePage'));
const PurchasePage       = makePage(() => import('@/features/auth/pages/warehouse/purchase/PurchasePage'));

// Documents (invoices)
const InvoicesPage = makePage(() => import('@/features/auth/pages/documents/InvoicesPage'));

// Reports (analytics)
const AnalyticsPage = makePage(() => import('@/features/auth/pages/reports/AnalyticsPage'));

// CRM customer detail (rich order history)
const ClientDetailPage = makePage(() => import('@/features/auth/pages/crm/customers/ClientDetailPage'));

// Operations settings (catalogs, delivery defaults, clients reference)
const OperationsSettingsPage = makePage(() => import('@/features/auth/pages/settings/OperationsSettingsPage'));

function RootIndex() {
  const user = useAuthStore((s) => s.user);
  if (user) return <CanvasPage />;
  return <LandingPage />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireOrg({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.membership.status);
  if (!user) return null; // Wait for bootstrap to complete
  if (status !== 'active') return <Navigate to="/settings" replace />;
  return <>{children}</>;
}

const PLAN_COLORS: Record<OrgMode, string> = {
  basic: '#5C8DFF',
  advanced: '#D97706',
  industrial: '#7C3AED',
};

function PlanGate({ required }: { required: OrgMode }) {
  const color = PLAN_COLORS[required];
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px',
      textAlign: 'center',
      padding: '40px 24px',
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: `color-mix(in srgb, ${color} 14%, var(--bg-surface-elevated))`,
        border: `1.5px solid color-mix(in srgb, ${color} 30%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
      }}>
        🔒
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          Требуется план «{PLAN_LABELS[required]}»
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.5 }}>
          Этот модуль недоступен в вашем текущем режиме. Измените план в настройках организации.
        </div>
      </div>
      <NavLink
        to="/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 8,
          background: `color-mix(in srgb, ${color} 12%, var(--bg-surface))`,
          border: `1px solid color-mix(in srgb, ${color} 28%, var(--brand-panel-border))`,
          color: color,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        <Settings size={14} />
        Перейти в настройки
      </NavLink>
    </div>
  );
}

function RequirePlan({ tier, children }: { tier: OrgMode; children: ReactNode }) {
  const plan = usePlan();
  if (!planIncludes(plan, tier)) return <PlanGate required={tier} />;
  return <>{children}</>;
}

function PermissionDenied() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px',
      textAlign: 'center',
      padding: '40px 24px',
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'color-mix(in srgb, var(--fill-danger, #ef4444) 12%, var(--bg-surface-elevated))',
        border: '1.5px solid color-mix(in srgb, var(--fill-danger, #ef4444) 28%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
      }}>
        🔒
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          Нет доступа
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.5 }}>
          У вас нет прав для просмотра этого раздела. Обратитесь к администратору.
        </div>
      </div>
      <NavLink
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 8,
          background: 'color-mix(in srgb, var(--fill-danger, #ef4444) 10%, var(--bg-surface))',
          border: '1px solid color-mix(in srgb, var(--fill-danger, #ef4444) 24%, var(--brand-panel-border))',
          color: 'var(--fill-danger, #ef4444)',
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        На главную
      </NavLink>
    </div>
  );
}

/**
 * Restricts a route to holders of a given scope.action permission.
 * Owners and company admins pass automatically (handled inside `can`).
 */
function RequirePermission({ check, children }: { check: Permission; children: ReactNode }) {
  const { can } = useEmployeePermissions();
  if (!can(check)) return <PermissionDenied />;
  return <>{children}</>;
}

export const appRouter = createBrowserRouter([
  // ── KORT Core ─────────────────────────────────────────
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <RootIndex />,
      },
      // ── CRM ──
      {
        path: 'crm/leads',
        element: <RequireAuth><RequireOrg><RequirePermission check="customers.read"><LeadsPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'crm/deals',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="customers.read"><DealsPage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'crm/customers',
        element: <RequireAuth><RequireOrg><RequirePermission check="customers.read"><CustomersPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'crm/customers/:id',
        element: <RequireAuth><RequireOrg><RequirePermission check="customers.read"><ClientDetailPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'crm/tasks',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="customers.read"><TasksPage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      // ── Sales (orders) ──
      {
        path: 'sales',
        element: <RequireAuth><RequireOrg><RequirePermission check="orders.read"><OrdersPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'sales/new',
        element: <RequireAuth><RequireOrg><RequirePermission check="orders.write"><NewOrderPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'sales/archive',
        element: <RequireAuth><RequireOrg><RequirePermission check="orders.read"><ArchivePage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'sales/trash',
        element: <RequireAuth><RequireOrg><RequirePermission check="orders.admin"><OrderTrashPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'sales/returns',
        element: <RequireAuth><RequireOrg><RequirePermission check="returns.read"><ReturnsPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'sales/kaspi',
        element: <RequireAuth><RequireOrg><RequirePermission check="orders.read"><KaspiOrdersPage /></RequirePermission></RequireOrg></RequireAuth>,
        children: [
          { index: true, element: <Navigate to="new" replace /> },
          { path: 'new', element: <KaspiStagePage stage="new" /> },
          { path: 'in-progress', element: <KaspiStagePage stage="in_progress" /> },
          { path: 'completed', element: <KaspiStagePage stage="completed" /> },
          { path: 'cancelled', element: <KaspiStagePage stage="cancelled" /> },
          { path: 'issues', element: <KaspiStagePage stage="issues" /> },
          { path: 'stock', element: <KaspiStockPage /> },
          { path: ':externalOrderId', element: <KaspiOrderDetailPage /> },
        ],
      },
      {
        path: 'sales/:id',
        element: <RequireAuth><RequireOrg><RequirePermission check="orders.read"><OrderDetailPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'sales/:id/edit',
        element: <RequireAuth><RequireOrg><RequirePermission check="orders.write"><EditOrderPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      // ── Warehouse ──
      {
        path: 'warehouse',
        element: <RequireAuth><RequireOrg><RequirePermission check="warehouse.read"><WarehousePage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse/stock',
        element: <RequireAuth><RequireOrg><RequirePermission check="warehouse.read"><WarehouseStockPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse/purchase',
        element: <RequireAuth><RequireOrg><RequirePermission check="purchase.read"><PurchasePage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse/twin',
        element: <RequireAuth><RequireOrg><RequirePermission check="warehouse.read"><WarehouseTwinPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse/control-tower',
        element: <RequireAuth><RequireOrg><RequirePermission check="warehouse.read"><WarehouseControlTowerPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'warehouse/operations',
        element: <RequireAuth><RequireOrg><RequirePermission check="warehouse.read"><WarehouseOperationsPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      // ── Production ──
      {
        path: 'production',
        element: <RequireAuth><RequireOrg><RequirePermission check="production.read"><ProductionFloorPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'production/ready',
        element: <RequireAuth><RequireOrg><RequirePermission check="production.read"><ReadyPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      // ── Logistics ──
      {
        path: 'logistics',
        element: <RequireAuth><RequireOrg><RequirePermission check="logistics.read"><LogisticsPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'logistics/:id',
        element: <RequireAuth><RequireOrg><RequirePermission check="logistics.read"><OrderDetailPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      // ── Products ──
      {
        path: 'products',
        element: <RequireAuth><RequireOrg><RequirePermission check="products.read"><ProductsPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      // ── Finance / Reports / Documents ──
      {
        path: 'finance',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="reports.read"><FinancePage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'employees',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="company.admin"><EmployeesPage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'reports',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="reports.read"><ReportsPage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'reports/analytics',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="reports.read"><AnalyticsPage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'documents',
        element: <RequireAuth><RequireOrg><RequirePlan tier="advanced"><RequirePermission check="documents.read"><DocumentsPage /></RequirePermission></RequirePlan></RequireOrg></RequireAuth>,
      },
      {
        path: 'documents/invoices',
        element: <RequireAuth><RequireOrg><RequirePermission check="invoices.read"><InvoicesPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'settings',
        element: <RequireAuth><SettingsPage /></RequireAuth>,
      },
      {
        path: 'settings/operations',
        element: <RequireAuth><RequireOrg><RequirePermission check="company.admin"><OperationsSettingsPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      {
        path: 'settings/:section',
        element: <RequireAuth><SettingsPage /></RequireAuth>,
      },
    ],
  },

  // ── Onboarding — own fullscreen layout, no sidebar ────
  {
    path: '/onboarding',
    element: <RequireAuth><OnboardingPage /></RequireAuth>,
  },

  // ── Auth ───────────────────────────────────────────────
  { path: '/auth/login',         element: <LoginPage /> },
  { path: '/auth/register',      element: <Navigate to="/" replace /> },
  { path: '/auth/accept-invite', element: <AcceptInvitePage /> },
  { path: '/reset-password',     element: <ResetPasswordPage /> },

  // ── Dev panel — service password, no normal auth ──────
  { path: '/dev', element: <DevPanelPage /> },

  // ── Legacy Chapan workzone URLs → redirect home ───────
  { path: '/workzone/*', element: <Navigate to="/" replace /> },

  // ── Fallback ───────────────────────────────────────────
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function AppRouter() {
  return (
    <ErrorBoundary>
      <RouterProvider router={appRouter} />
    </ErrorBoundary>
  );
}
