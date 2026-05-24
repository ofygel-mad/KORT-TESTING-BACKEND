// ЧАСТЬ X / P1 — route guard for the section catalog. A top-level section
// disabled by the Control Plane composition config is unreachable by URL, not
// just hidden from the sidebar. Non-removable sections and the absence of a
// config always pass — layered on top of RequirePlan / RequirePermission.

import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTenantConfig } from '@/shared/composition/useTenantConfig';

export function RequireSection({
  section,
  children,
}: {
  section: string;
  children: ReactNode;
}) {
  const config = useTenantConfig();
  if (config?.data.sections?.[section]?.enabled === false) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
