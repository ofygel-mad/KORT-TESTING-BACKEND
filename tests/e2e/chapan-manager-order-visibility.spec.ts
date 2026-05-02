import { expect, test, type APIRequestContext } from '@playwright/test';
import { clearSession, preparePage } from './helpers';

const E2E_BASE_URL = process.env.E2E_BASE_URL || `http://${process.env.E2E_HOST || '127.0.0.1'}:${process.env.E2E_FRONTEND_PORT || '4174'}`;
const E2E_API_BASE_URL = process.env.E2E_API_BASE_URL || `http://${process.env.E2E_HOST || '127.0.0.1'}:${process.env.E2E_BACKEND_PORT || '8002'}/api/v1`;

type AuthSession = {
  access: string;
  refresh: string;
  user: {
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
    status?: string;
    is_owner?: boolean;
    employee_permissions?: string[];
    account_status?: string;
  };
  org: {
    id: string;
    name: string;
    slug: string;
    mode: 'basic' | 'advanced' | 'industrial';
    currency: string;
    onboarding_completed?: boolean;
  } | null;
  capabilities: string[];
  role: 'owner' | 'admin' | 'manager' | 'viewer';
  membership: {
    companyId: string | null;
    companyName: string | null;
    companySlug: string | null;
    status: 'none' | 'pending' | 'active' | 'rejected';
    role: 'owner' | 'admin' | 'manager' | 'viewer' | null;
    source: 'company_registration' | 'employee_registration' | 'invite' | 'request' | 'manual' | null;
    requestId?: string | null;
    inviteToken?: string | null;
    joinedAt?: string | null;
    updatedAt?: string | null;
  };
  orgs?: Array<{
    id: string;
    name: string;
    slug: string;
    mode: 'basic' | 'advanced' | 'industrial';
    currency: string;
    onboarding_completed?: boolean;
    role: 'owner' | 'admin' | 'manager' | 'viewer';
  }>;
};

async function expectOkJson<T>(promise: Promise<import('@playwright/test').APIResponse>): Promise<T> {
  const response = await promise;
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<T>;
}

async function registerOwner(request: APIRequestContext, unique: number) {
  return expectOkJson<AuthSession>(request.post(`${E2E_API_BASE_URL}/auth/register/company`, {
    data: {
      company_name: `Manager Scope ${unique}`,
      full_name: `Owner ${unique}`,
      email: `owner+manager-scope-${unique}@demo.kz`,
      password: 'superpass1',
    },
  }));
}

async function createEmployee(
  request: APIRequestContext,
  ownerSession: AuthSession,
  phone: string,
  fullName: string,
  permissions: string[] = ['chapan_access_orders'],
) {
  return expectOkJson<{ id: string; full_name: string; phone: string }>(
    request.post(`${E2E_API_BASE_URL}/company/employees`, {
      headers: {
        Authorization: `Bearer ${ownerSession.access}`,
        'X-Org-Id': ownerSession.org!.id,
      },
      data: {
        phone,
        full_name: fullName,
        department: 'Sales',
        permissions,
      },
    }),
  );
}

async function upgradeOrgToIndustrial(
  request: APIRequestContext,
  ownerSession: AuthSession,
) {
  return expectOkJson<{ mode: 'industrial'; onboarding_completed: boolean }>(
    request.patch(`${E2E_API_BASE_URL}/organization`, {
      headers: {
        Authorization: `Bearer ${ownerSession.access}`,
        'X-Org-Id': ownerSession.org!.id,
      },
      data: {
        mode: 'industrial',
        onboarding_completed: true,
      },
    }),
  );
}

async function activateEmployee(
  request: APIRequestContext,
  phone: string,
  password: string,
) {
  const lookup = await expectOkJson<{ found: true; temp_token: string }>(
    request.post(`${E2E_API_BASE_URL}/auth/employee/lookup`, {
      data: { phone },
    }),
  );

  await expectOkJson<{ ok: true }>(
    request.post(`${E2E_API_BASE_URL}/auth/set-password`, {
      headers: {
        Authorization: `Bearer ${lookup.temp_token}`,
      },
      data: {
        new_password: password,
        confirm_password: password,
      },
    }),
  );

  return expectOkJson<AuthSession>(
    request.post(`${E2E_API_BASE_URL}/auth/login`, {
      data: {
        phone,
        password,
      },
    }),
  );
}

async function createOrder(
  request: APIRequestContext,
  session: AuthSession,
  clientName: string,
  clientPhone: string,
) {
  return expectOkJson<{ id: string; clientName: string; managerId: string | null }>(
    request.post(`${E2E_API_BASE_URL}/chapan/orders`, {
      headers: {
        Authorization: `Bearer ${session.access}`,
        'X-Org-Id': session.org!.id,
      },
      data: {
        clientName,
        clientPhone,
        priority: 'normal',
        customerType: 'retail',
        items: [
          {
            productName: 'Jacket',
            size: 'M',
            quantity: 1,
            unitPrice: 12000,
          },
        ],
      },
    }),
  );
}

test('employee manager sees only their own chapan orders', async ({ browser, request }) => {
  const unique = Date.now();
  const ownerSession = await registerOwner(request, unique);
  await upgradeOrgToIndustrial(request, ownerSession);

  const employeeOnePhone = `+7701${String(unique).slice(-7)}`;
  const employeeTwoPhone = `+7702${String(unique).slice(-7)}`;

  const managerPermissions = ['chapan_access_orders', 'chapan_access_ready'];
  await createEmployee(request, ownerSession, employeeOnePhone, `Manager One ${unique}`, managerPermissions);
  await createEmployee(request, ownerSession, employeeTwoPhone, `Manager Two ${unique}`, managerPermissions);

  const employeeOneSession = await activateEmployee(request, employeeOnePhone, 'managerpass1');
  const employeeTwoSession = await activateEmployee(request, employeeTwoPhone, 'managerpass2');

  const employeeOneClient = `Client One ${unique}`;
  const employeeTwoClient = `Client Two ${unique}`;

  const employeeOneOrder = await createOrder(request, employeeOneSession, employeeOneClient, `+7761${String(unique).slice(-7)}`);
  const employeeTwoOrder = await createOrder(request, employeeTwoSession, employeeTwoClient, `+7762${String(unique).slice(-7)}`);

  const employeeOneOrders = await expectOkJson<{ count: number; results: Array<{ id: string }> }>(
    request.get(`${E2E_API_BASE_URL}/chapan/orders?mineOnly=true`, {
      headers: {
        Authorization: `Bearer ${employeeOneSession.access}`,
        'X-Org-Id': employeeOneSession.org!.id,
      },
    }),
  );
  expect(employeeOneOrders.count).toBe(1);
  expect(employeeOneOrders.results.map((order) => order.id)).toEqual([employeeOneOrder.id]);

  const forbiddenOrderResponse = await request.get(`${E2E_API_BASE_URL}/chapan/orders/${employeeTwoOrder.id}?mineOnly=true`, {
    headers: {
      Authorization: `Bearer ${employeeOneSession.access}`,
      'X-Org-Id': employeeOneSession.org!.id,
    },
    failOnStatusCode: false,
  });
  expect(forbiddenOrderResponse.status()).toBe(403);

  const uiContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  const uiPage = await uiContext.newPage();

  await preparePage(uiPage);
  await clearSession(uiPage);
  await uiPage.locator('input[type="checkbox"]').check();
  const loginFields = uiPage.locator('form input:not([type="checkbox"])');
  await loginFields.nth(0).fill(employeeOnePhone);
  await uiPage.locator('form button[type="submit"]').click();
  await expect(loginFields).toHaveCount(2);
  await loginFields.nth(1).fill('managerpass1');
  await uiPage.locator('form button[type="submit"]').click();
  await uiPage.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15000 });
  await uiPage.goto('/workzone/chapan/orders', { waitUntil: 'networkidle' });

  await expect(uiPage.getByText(employeeOneClient)).toBeVisible();
  await expect(uiPage.getByText(employeeTwoClient)).toHaveCount(0);

  await uiContext.close();
});
