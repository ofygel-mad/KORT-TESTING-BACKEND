import { createBrowserRouter, Navigate, NavLink, RouterProvider } from 'react-router-dom';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { AppShell } from '../layout/AppShell';
import { PageLoader } from '@/shared/ui/PageLoader';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { isChunkLoadError, reloadForChunkErrorOnce } from '@/shared/lib/browser';
import { useAuthStore } from '@/shared/stores/auth';
import { usePlan, planIncludes, PLAN_LABELS, type OrgMode } from '@/shared/hooks/usePlan';
import { useEmployeePermissions } from '@/shared/hooks/useEmployeePermissions';
import { RequireSection } from './RequireSection';
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
const CustomersPage  = makePage(() => import('@/features/auth/pages/crm/customers'));
const TasksPage      = makePage(() => import('@/features/auth/pages/crm/tasks'));
const WarehousePage  = makePage(() => import('@/features/auth/pages/warehouse/WarehousePage'));
const FinancePage    = makePage(() => import('@/features/auth/pages/finance'));
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

// Warehouse purchase
const PurchasePage       = makePage(() => import('@/features/auth/pages/warehouse/purchase/PurchasePage'));

// Documents (invoices)
const InvoicesPage = makePage(() => import('@/features/auth/pages/documents/InvoicesPage'));

// Reports (analytics)
const AnalyticsPage = makePage(() => import('@/features/auth/pages/reports/AnalyticsPage'));

// CRM customer detail (rich order history)
const ClientDetailPage = makePage(() => import('@/features/auth/pages/crm/customers/ClientDetailPage'));

// Operations settings (catalogs, delivery defaults, clients reference)
const OperationsSettingsPage = makePage(() => import('@/features/auth/pages/settings/OperationsSettingsPage'));

// Order Templates Library (P5)
const TemplatesLibraryPage = makePage(() => import('@/features/auth/pages/settings/templates/TemplatesLibraryPage'));
// Field Designer (P7)
const FieldDesignerPage = makePage(() => import('@/features/auth/pages/settings/templates/FieldDesignerPage'));

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

/**
 * ЧАСТЬ X — composes the standard guard stack for an org-scoped feature route:
 * RequireAuth → RequireOrg → RequireSection → RequirePlan → RequirePermission.
 */
function protect(
  node: ReactNode,
  opts: { section: string; plan?: OrgMode; permission?: Permission },
): ReactNode {
  let el: ReactNode = node;
  if (opts.permission) {
    el = <RequirePermission check={opts.permission}>{el}</RequirePermission>;
  }
  if (opts.plan) {
    el = <RequirePlan tier={opts.plan}>{el}</RequirePlan>;
  }
  return (
    <RequireAuth>
      <RequireOrg>
        <RequireSection section={opts.section}>{el}</RequireSection>
      </RequireOrg>
    </RequireAuth>
  );
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
        element: protect(<LeadsPage />, { section: 'leads', permission: 'customers.read' }),
      },
      {
        // The "Deals" concept was retired — sales orders cover the same
        // ground. Old bookmarks redirect to the unified Sales section.
        path: 'crm/deals',
        element: <Navigate to="/sales" replace />,
      },
      {
        path: 'crm/customers',
        element: protect(<CustomersPage />, { section: 'customers', permission: 'customers.read' }),
      },
      {
        path: 'crm/customers/:id',
        element: protect(<ClientDetailPage />, { section: 'customers', permission: 'customers.read' }),
      },
      {
        path: 'crm/tasks',
        element: protect(<TasksPage />, { section: 'tasks', plan: 'advanced', permission: 'customers.read' }),
      },
      // ── Sales (orders) ──
      {
        path: 'sales',
        element: protect(<OrdersPage />, { section: 'sales', permission: 'orders.read' }),
      },
      {
        path: 'sales/new',
        element: protect(<NewOrderPage />, { section: 'sales', permission: 'orders.write' }),
      },
      {
        path: 'sales/archive',
        element: protect(<ArchivePage />, { section: 'sales', permission: 'orders.read' }),
      },
      {
        path: 'sales/trash',
        element: protect(<OrderTrashPage />, { section: 'sales', permission: 'orders.admin' }),
      },
      {
        path: 'sales/returns',
        element: protect(<ReturnsPage />, { section: 'sales', permission: 'returns.read' }),
      },
      {
        path: 'sales/kaspi',
        element: protect(<KaspiOrdersPage />, { section: 'sales', permission: 'orders.read' }),
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
        element: protect(<OrderDetailPage />, { section: 'sales', permission: 'orders.read' }),
      },
      {
        path: 'sales/:id/edit',
        element: protect(<EditOrderPage />, { section: 'sales', permission: 'orders.write' }),
      },
      // ── Warehouse ──
      {
        path: 'warehouse',
        element: protect(<WarehousePage />, { section: 'warehouse', permission: 'warehouse.read' }),
      },
      {
        path: 'warehouse/purchase',
        element: protect(<PurchasePage />, { section: 'warehouse', permission: 'purchase.read' }),
      },
      // ── Production ──
      {
        path: 'production',
        element: protect(<ProductionFloorPage />, { section: 'production', permission: 'production.read' }),
      },
      {
        path: 'production/ready',
        element: protect(<ReadyPage />, { section: 'production', permission: 'production.read' }),
      },
      // ── Logistics ──
      {
        path: 'logistics',
        element: protect(<LogisticsPage />, { section: 'logistics', permission: 'logistics.read' }),
      },
      {
        path: 'logistics/:id',
        element: protect(<OrderDetailPage />, { section: 'logistics', permission: 'logistics.read' }),
      },
      // ── Products ──
      {
        path: 'products',
        element: protect(<ProductsPage />, { section: 'products', permission: 'products.read' }),
      },
      // ── Finance / Reports / Documents ──
      {
        path: 'finance',
        element: protect(<FinancePage />, { section: 'finance', plan: 'advanced', permission: 'reports.read' }),
      },
      {
        // "Сотрудники" as a top-level page was retired — the same management
        // lives inside Settings now. Old bookmarks redirect there.
        path: 'employees',
        element: <Navigate to="/settings" replace />,
      },
      {
        path: 'reports',
        element: protect(<ReportsPage />, { section: 'reports', plan: 'advanced', permission: 'reports.read' }),
      },
      {
        path: 'reports/analytics',
        element: protect(<AnalyticsPage />, { section: 'reports', plan: 'advanced', permission: 'reports.read' }),
      },
      {
        path: 'documents',
        element: protect(<DocumentsPage />, { section: 'documents', plan: 'advanced', permission: 'documents.read' }),
      },
      {
        path: 'documents/invoices',
        element: protect(<InvoicesPage />, { section: 'documents', permission: 'invoices.read' }),
      },
      {
        path: 'settings',
        element: <RequireAuth><SettingsPage /></RequireAuth>,
      },
      {
        path: 'settings/operations',
        element: <RequireAuth><RequireOrg><RequirePermission check="company.admin"><OperationsSettingsPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      // P5: read-only Templates Library — must precede the catch-all below.
      {
        path: 'settings/order-templates',
        element: <RequireAuth><RequireOrg><RequirePermission check="company.admin"><TemplatesLibraryPage /></RequirePermission></RequireOrg></RequireAuth>,
      },
      // P7: Field Designer
      {
        path: 'settings/order-templates/:id',
        element: <RequireAuth><RequireOrg><RequirePermission check="company.admin"><FieldDesignerPage /></RequirePermission></RequireOrg></RequireAuth>,
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

  // ── Legacy workzone URLs → redirect home ──────────────
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
