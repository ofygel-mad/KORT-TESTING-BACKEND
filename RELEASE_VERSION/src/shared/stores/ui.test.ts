import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore, type User } from './auth';
import { useUIStore } from './ui';

const USER_ONE: User = {
  id: 'user-1',
  full_name: 'User One',
  email: 'one@example.com',
};

const USER_TWO: User = {
  id: 'user-2',
  full_name: 'User Two',
  email: 'two@example.com',
};

describe('useUIStore action requests', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearAuth();
    useUIStore.setState({
      theme: 'system',
      themePack: 'neutral',
      sidebarCollapsed: false,
      focusMode: false,
      workspaceAddMenuOpen: false,
      createCustomerRequest: { nonce: 0, payload: undefined },
      createDealRequest: { nonce: 0, payload: undefined },
      createTaskRequest: { nonce: 0, payload: undefined },
      assistantPromptRequest: { nonce: 0, payload: undefined },
    });
  });

  it('increments customer request nonce', () => {
    const before = useUIStore.getState().createCustomerRequest.nonce;
    useUIStore.getState().openCreateCustomer();
    const after = useUIStore.getState().createCustomerRequest;

    expect(after.nonce).toBe(before + 1);
  });

  it('increments deal request nonce and stores payload', () => {
    const before = useUIStore.getState().createDealRequest.nonce;
    useUIStore.getState().openCreateDeal({ customerId: 'c-9', title: 'New shipment' });
    const after = useUIStore.getState().createDealRequest;

    expect(after.nonce).toBe(before + 1);
    expect(after.payload).toEqual({ customerId: 'c-9', title: 'New shipment' });
  });

  it('increments task request nonce and stores payload', () => {
    const before = useUIStore.getState().createTaskRequest.nonce;
    useUIStore.getState().openCreateTask({ customerId: 'c-1', title: 'Call back' });
    const after = useUIStore.getState().createTaskRequest;

    expect(after.nonce).toBe(before + 1);
    expect(after.payload).toEqual({ customerId: 'c-1', title: 'Call back' });
  });

  it('increments assistant prompt nonce', () => {
    const before = useUIStore.getState().assistantPromptRequest.nonce;
    useUIStore.getState().openAssistantPrompt('What should I do next?');
    const after = useUIStore.getState().assistantPromptRequest;

    expect(after.nonce).toBe(before + 1);
    expect(after.payload).toBe('What should I do next?');
  });

  it('keeps appearance preferences separate for each account', () => {
    useAuthStore.getState().setAuth(USER_ONE, null, 'access-1', 'refresh-1', [], 'viewer');
    useUIStore.getState().setTheme('light');
    useUIStore.getState().setThemePack('sand');

    useAuthStore.getState().setAuth(USER_TWO, null, 'access-2', 'refresh-2', [], 'viewer');
    expect(useUIStore.getState().theme).toBe('system');
    expect(useUIStore.getState().themePack).toBe('neutral');

    useUIStore.getState().setTheme('dark');
    useUIStore.getState().setThemePack('obsidian');

    useAuthStore.getState().setAuth(USER_ONE, null, 'access-1', 'refresh-1', [], 'viewer');
    expect(useUIStore.getState().theme).toBe('light');
    expect(useUIStore.getState().themePack).toBe('sand');
  });

  it('returns to default appearance after logout', () => {
    useAuthStore.getState().setAuth(USER_ONE, null, 'access-1', 'refresh-1', [], 'viewer');
    useUIStore.getState().setTheme('dark');
    useUIStore.getState().setThemePack('enterprise');

    useAuthStore.getState().clearAuth();

    expect(useUIStore.getState().theme).toBe('system');
    expect(useUIStore.getState().themePack).toBe('neutral');
  });
});
