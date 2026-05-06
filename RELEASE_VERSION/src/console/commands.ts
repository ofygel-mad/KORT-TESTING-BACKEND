import { appRouter } from '../app/router';
import { copyToClipboard, readStorage, reloadWindow, removeStorage, writeStorage } from '../shared/lib/browser';
import { useAuthStore } from '../shared/stores/auth';
import { useUIStore } from '../shared/stores/ui';
import type { ThemePack } from '../shared/stores/ui';
import {
  MOCK_AUTH_SESSIONS,
  MOCK_COMPANIES,
  MOCK_CUSTOMERS,
  MOCK_DEALS,
  MOCK_TASKS,
  MOCK_PIPELINE,
  MOCK_DASHBOARD,
} from '../shared/api/mock-data';
import {
  activateConsoleAccess,
  activateConsoleAccessFromResponse,
  canUseLocalConsoleAccess,
  captureAuthSnapshot,
  deactivateConsoleAccess,
  getConsolePasswordChangedAt,
  requestBackendServiceSession,
  updateConsolePassword,
  verifyConsolePassword,
} from './devAccess';
import { filterConsoleEntries, useConsoleStore } from './store';
import type { ConsoleCommandResult } from './types';

type ParsedConsoleCommand = {
  name: string;
  args: string[];
  raw: string;
};

const TOKEN_PATTERN = /"([^"]*)"|(\S+)/g;

const COMMAND_HELP: Record<string, string> = {
  help: 'List available commands.',
  clear: 'Clear the console log buffer.',
  status: 'Show current route, auth, filter, and access state.',
  history: 'Show recent command history.',
  filter: 'Apply a text filter. Use filter "api" or filter off.',
  export: 'Copy current visible logs as JSON to clipboard.',
  goto: 'Navigate to a route. Example: goto "/admin".',
  access: 'Войти в god-mode. Пример: access "kortdev1234"',
  change: 'Сменить локальный пароль. Пример: change "новый-пароль"',
  lock: 'Выйти из god-mode / заблокировать воркспейс.',
  logout: 'Выйти из аккаунта.',
  close: 'Hide the console overlay.',
  // ── god-mode commands ──
  users: 'List all mock users.',
  switch: 'Switch to another user. Usage: switch "email@demo.kz".',
  role: 'Change current role. Usage: role "owner"|"admin"|"manager"|"viewer".',
  caps: 'Show or modify capabilities. Usage: caps / caps add "cap" / caps rm "cap".',
  customers: 'List all mock customers.',
  deals: 'List all mock deals.',
  tasks: 'List all mock tasks.',
  pipeline: 'Show pipeline stages.',
  dashboard: 'Show dashboard metrics.',
  storage: 'Manage localStorage. Usage: storage list / get "key" / set "key" "val" / rm "key" / clear.',
  state: 'Dump current store state. Usage: state auth / state ui / state console / state all.',
  theme: 'Change theme pack. Usage: theme "neutral"|"graphite"|"sand"|"obsidian"|"enterprise".',
  focus: 'Toggle focus mode.',
  sidebar: 'Toggle sidebar.',
  reload: 'Reload the page.',
  env: 'Show environment info.',
  org: 'Show or modify organization. Usage: org / org set-name "name" / org set-mode "mode" / org set-currency "code".',
  eval: 'Evaluate a safe arithmetic expression. Usage: eval "1+1".',
  broadcast: 'Emit a custom console event. Usage: broadcast "source" "message".',
  purge: 'Clear all localStorage and reload.',
};

const COMMAND_ALIASES: Record<string, string> = {
  '?': 'help',
  cls: 'clear',
  quit: 'close',
  exit: 'close',
  whoami: 'status',
  su: 'switch',
  ls: 'storage',
  dump: 'state',
  reset: 'purge',
};

export function parseConsoleCommand(input: string): ParsedConsoleCommand | null {
  const raw = input.trim();
  if (!raw) {
    return null;
  }

  const tokens = Array.from(raw.matchAll(TOKEN_PATTERN)).map((match) => match[1] ?? match[2] ?? '');
  if (tokens.length === 0) {
    return null;
  }

  const [firstToken, ...args] = tokens;
  const normalizedName = COMMAND_ALIASES[firstToken.toLowerCase()] ?? firstToken.toLowerCase();

  return {
    name: normalizedName,
    args,
    raw,
  };
}

export function sanitizeCommandForLog(input: string) {
  const parsed = parseConsoleCommand(input);
  if (!parsed) {
    return input.trim();
  }

  if (parsed.name === 'access' || parsed.name === 'change') {
    return `${parsed.name} "[redacted]"`;
  }

  return parsed.raw;
}

export function getConsoleCommandNames() {
  return Object.keys(COMMAND_HELP);
}

export function autocompleteConsoleCommand(input: string) {
  const value = input.trimStart().toLowerCase();
  if (!value || value.includes(' ')) {
    return input;
  }

  const match = getConsoleCommandNames().find((commandName) => commandName.startsWith(value));
  return match ?? input;
}

function formatStatusDetails() {
  const authState = useAuthStore.getState();
  const consoleState = useConsoleStore.getState();
  const location = appRouter.state.location;
  const userLabel = authState.user ? `${authState.user.full_name} <${authState.user.email}>` : 'anonymous';
  const roleLabel = authState.membership.role ?? authState.role ?? 'viewer';
  const passwordChangedAt = getConsolePasswordChangedAt() ?? 'default';

  return [
    `route: ${location.pathname}${location.search}`,
    `user: ${userLabel}`,
    `workspace: ${authState.isUnlocked ? 'unlocked' : 'locked'}`,
    `membership: ${authState.membership.status}/${roleLabel}`,
    `company: ${authState.membership.companyName ?? 'none'}`,
    `logs: ${consoleState.entries.length}`,
    `filter: ${consoleState.filter.query || 'none'}`,
    `local_access: ${canUseLocalConsoleAccess() ? 'enabled' : 'disabled'}`,
    `password_changed_at: ${passwordChangedAt}`,
    `capabilities: ${authState.capabilities.join(', ') || 'none'}`,
  ].join('\n');
}

function formatHistory() {
  const history = useConsoleStore.getState().commandHistory;

  if (history.length === 0) {
    return 'No commands executed yet.';
  }

  return history
    .slice(-10)
    .map((command, index) => `${index + 1}. ${sanitizeCommandForLog(command)}`)
    .join('\n');
}

async function exportVisibleLogs() {
  const consoleState = useConsoleStore.getState();
  const visibleEntries = filterConsoleEntries(consoleState.entries, consoleState.filter);
  const payload = JSON.stringify(visibleEntries, null, 2);
  const copied = await copyToClipboard(payload);

  return {
    copied,
    count: visibleEntries.length,
  };
}

// ── god-mode helpers ──

function formatUsers() {
  return MOCK_AUTH_SESSIONS.map((s) =>
    `${s.user.id}  ${s.user.email.padEnd(22)}  ${s.role.padEnd(8)}  ${s.membership.status}`,
  ).join('\n');
}

function formatCustomers() {
  return MOCK_CUSTOMERS.map((c) =>
    `${c.id}  ${c.full_name.padEnd(22)}  ${c.status.padEnd(10)}  ${c.email}`,
  ).join('\n');
}

function formatDeals() {
  return MOCK_DEALS.map((d) =>
    `${d.id}  ${d.title.padEnd(26)}  ${d.amount.toLocaleString()} ${d.currency}  ${d.stage}`,
  ).join('\n');
}

function formatTasks() {
  return MOCK_TASKS.map((t) =>
    `${t.id}  ${t.title.padEnd(30)}  ${t.priority.padEnd(7)}  ${t.status}`,
  ).join('\n');
}

function formatPipeline() {
  return [
    `Pipeline: ${MOCK_PIPELINE.name} (${MOCK_PIPELINE.id})`,
    ...MOCK_PIPELINE.stages.map((s) =>
      `  ${s.position}. ${s.name.padEnd(28)} [${s.stage_type}]  ${s.deals.length} deals  ${s.color}`,
    ),
  ].join('\n');
}

function formatDashboard() {
  const d = MOCK_DASHBOARD;
  return [
    `customers:        ${d.customers_count} (+${d.customers_delta})`,
    `active deals:     ${d.active_deals_count}`,
    `monthly revenue:  ${d.revenue_month.toLocaleString()} KZT`,
    `tasks today:      ${d.tasks_today}`,
    `overdue tasks:    ${d.overdue_tasks}`,
    `deals no activity: ${d.deals_no_activity}`,
    `stalled deals:    ${d.stalled_deals.length}`,
    `silent customers: ${d.silent_customers.length}`,
  ].join('\n');
}

function formatEnvironment() {
  return [
    `mode: ${import.meta.env.MODE}`,
    `dev: ${import.meta.env.DEV}`,
    `prod: ${import.meta.env.PROD}`,
    `base_url: ${import.meta.env.BASE_URL}`,
    `user_agent: ${navigator.userAgent}`,
    `language: ${navigator.language}`,
    `online: ${navigator.onLine}`,
    `screen: ${screen.width}x${screen.height}`,
    `viewport: ${window.innerWidth}x${window.innerHeight}`,
    `pixel_ratio: ${devicePixelRatio}`,
    `time: ${new Date().toISOString()}`,
    `timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
  ].join('\n');
}

function dumpStoreState(storeName: string): string {
  switch (storeName) {
    case 'auth': {
      const s = useAuthStore.getState();
      return JSON.stringify({
        user: s.user,
        org: s.org,
        role: s.role,
        capabilities: s.capabilities,
        membership: s.membership,
        isUnlocked: s.isUnlocked,
        hasToken: !!s.token,
        hasRefreshToken: !!s.refreshToken,
      }, null, 2);
    }
    case 'ui': {
      const s = useUIStore.getState();
      return JSON.stringify({
        theme: s.theme,
        themePack: s.themePack,
        sidebarCollapsed: s.sidebarCollapsed,
        focusMode: s.focusMode,
      }, null, 2);
    }
    case 'console': {
      const s = useConsoleStore.getState();
      return JSON.stringify({
        isOpen: s.isOpen,
        entriesCount: s.entries.length,
        commandHistoryCount: s.commandHistory.length,
        filter: s.filter,
        serviceSession: s.serviceSession,
      }, null, 2);
    }
    case 'all':
      return [
        '── auth ──',
        dumpStoreState('auth'),
        '',
        '── ui ──',
        dumpStoreState('ui'),
        '',
        '── console ──',
        dumpStoreState('console'),
      ].join('\n');
    default:
      return `Unknown store: ${storeName}. Available: auth, ui, console, all`;
  }
}

function listLocalStorage(): string {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) ?? '';
      const preview = value.length > 80 ? value.slice(0, 80) + '...' : value;
      keys.push(`${key.padEnd(40)} ${preview}`);
    }
  }
  return keys.length > 0 ? keys.join('\n') : 'localStorage is empty.';
}

class ArithmeticExpressionParser {
  private index = 0;

  constructor(private readonly input: string) {}

  parse() {
    const value = this.parseExpression();
    this.skipWhitespace();

    if (this.index !== this.input.length) {
      throw new Error(`Unexpected token at position ${this.index + 1}`);
    }

    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();

    while (true) {
      this.skipWhitespace();

      if (this.match('+')) {
        value += this.parseTerm();
        continue;
      }

      if (this.match('-')) {
        value -= this.parseTerm();
        continue;
      }

      return value;
    }
  }

  private parseTerm(): number {
    let value = this.parseFactor();

    while (true) {
      this.skipWhitespace();

      if (this.match('*')) {
        value *= this.parseFactor();
        continue;
      }

      if (this.match('/')) {
        const divisor = this.parseFactor();
        if (divisor === 0) {
          throw new Error('Division by zero');
        }
        value /= divisor;
        continue;
      }

      if (this.match('%')) {
        const divisor = this.parseFactor();
        if (divisor === 0) {
          throw new Error('Division by zero');
        }
        value %= divisor;
        continue;
      }

      return value;
    }
  }

  private parseFactor(): number {
    this.skipWhitespace();

    if (this.match('+')) {
      return this.parseFactor();
    }

    if (this.match('-')) {
      return -this.parseFactor();
    }

    if (this.match('(')) {
      const value = this.parseExpression();
      this.skipWhitespace();
      if (!this.match(')')) {
        throw new Error('Missing closing parenthesis');
      }
      return value;
    }

    return this.parseNumber();
  }

  private parseNumber(): number {
    this.skipWhitespace();
    const start = this.index;

    while (this.index < this.input.length) {
      const char = this.input[this.index];
      if ((char >= '0' && char <= '9') || char === '.') {
        this.index += 1;
        continue;
      }

      break;
    }

    if (start === this.index) {
      throw new Error(`Expected number at position ${this.index + 1}`);
    }

    const value = Number(this.input.slice(start, this.index));
    if (!Number.isFinite(value)) {
      throw new Error('Invalid number');
    }

    return value;
  }

  private skipWhitespace() {
    while (this.input[this.index] === ' ' || this.input[this.index] === '\t' || this.input[this.index] === '\n') {
      this.index += 1;
    }
  }

  private match(expected: string) {
    if (this.input[this.index] !== expected) {
      return false;
    }

    this.index += 1;
    return true;
  }
}

function evaluateArithmeticExpression(expression: string) {
  if (!/^[\d+\-*/%().\s]+$/.test(expression)) {
    throw new Error('Only arithmetic expressions are supported');
  }

  return new ArithmeticExpressionParser(expression).parse();
}

export async function executeConsoleCommand(input: string): Promise<ConsoleCommandResult> {
  const parsed = parseConsoleCommand(input);

  if (!parsed) {
    return {
      level: 'warn',
      message: 'Empty command.',
    };
  }

  switch (parsed.name) {
    case 'help':
      return {
        level: 'info',
        message: 'Available commands.',
        details: Object.entries(COMMAND_HELP)
          .map(([name, description]) => `${name.padEnd(12)} ${description}`)
          .join('\n'),
      };

    case 'clear':
      return {
        level: 'success',
        message: 'Console log cleared.',
        clearBeforeLog: true,
      };

    case 'status':
      return {
        level: 'info',
        message: 'Current session status.',
        details: formatStatusDetails(),
      };

    case 'history':
      return {
        level: 'info',
        message: 'Recent command history.',
        details: formatHistory(),
      };

    case 'filter': {
      const nextValue = parsed.args.join(' ').trim();

      if (!nextValue || nextValue.toLowerCase() === 'off') {
        useConsoleStore.getState().setFilter({ query: '' });
        return {
          level: 'success',
          message: 'Text filter cleared.',
        };
      }

      useConsoleStore.getState().setFilter({ query: nextValue });
      return {
        level: 'success',
        message: `Filter applied: ${nextValue}`,
      };
    }

    case 'export': {
      const { copied, count } = await exportVisibleLogs();
      return {
        level: copied ? 'success' : 'warn',
        message: copied
          ? `Copied ${count} visible log entries to clipboard.`
          : `Unable to copy ${count} log entries to clipboard.`,
      };
    }

    case 'goto': {
      const target = parsed.args[0] ?? '/';
      await appRouter.navigate(target);
      return {
        level: 'success',
        message: `Navigated to ${target}.`,
      };
    }

    case 'access': {
      const password = parsed.args[0] ?? '';
      if (!password) {
        return {
          level: 'error',
          message: 'Usage: access "ваш-пароль"',
          details: [
            'Пароли:',
            '  Бэкенд  → CONSOLE_SERVICE_PASSWORD в server/.env  (сейчас: "kortdev1234")',
            '  Локально → хэш в браузере, по умолчанию: "1234"',
          ].join('\n'),
        };
      }

      const consoleState = useConsoleStore.getState();
      if (consoleState.serviceSession.active) {
        return {
          level: 'info',
          message: 'Сервисная сессия уже активна.',
        };
      }

      const snapshot = captureAuthSnapshot();

      // ── Шаг 1: пробуем бэкенд ──────────────────────────────
      const backendResult = await requestBackendServiceSession(password);

      if (backendResult.type === 'ok') {
        activateConsoleAccessFromResponse(backendResult.session);
        useConsoleStore.getState().setServiceSession({
          active: true,
          activatedAt: new Date().toISOString(),
          snapshot,
        });
        await appRouter.navigate('/');
        return {
          level: 'success',
          message: 'Сервисная сессия активна. God-mode включён.',
          details: `Авторизован как ${backendResult.session.user.full_name} (${backendResult.session.user.email}).`,
        };
      }

      // ── Шаг 2: пробуем локальный хэш (оба пути) ────────────
      // Это нужно и когда бэкенд недоступен, и когда пароль в .env другой
      const accepted = await verifyConsolePassword(password);

      if (accepted) {
        activateConsoleAccess();
        useConsoleStore.getState().setServiceSession({
          active: true,
          activatedAt: new Date().toISOString(),
          snapshot,
        });
        await appRouter.navigate('/');
        return {
          level: 'success',
          message: backendResult.type === 'offline'
            ? 'God-mode активен (оффлайн-режим). API-вызовы могут не работать.'
            : 'God-mode активен (локальный режим). Бэкенд пароль не совпал.',
        };
      }

      // ── Оба способа не сработали ────────────────────────────
      const backendLine = backendResult.type === 'offline'
        ? '  Бэкенд:  недоступен (сервер выключен или порт 8000 закрыт)'
        : '  Бэкенд:  отклонил — пароль не совпадает с CONSOLE_SERVICE_PASSWORD';

      return {
        level: 'error',
        message: 'Неверный пароль.',
        details: [
          backendLine,
          '  Локально: хэш не совпадает',
          '',
          'Что попробовать:',
          '  access "kortdev1234"   ← пароль из server/.env',
          '  access "1234"          ← дефолтный локальный пароль',
        ].join('\n'),
      };
    }

    case 'change': {
      if (!canUseLocalConsoleAccess()) {
        return {
          level: 'error',
          message: 'Смена пароля недоступна вне DEV-режима.',
        };
      }

      const nextPassword = parsed.args[0] ?? '';
      if (!nextPassword) {
        return {
          level: 'error',
          message: 'Использование: change "новый-пароль"',
          details: 'Меняет только локальный пароль браузера.\nПароль бэкенда — CONSOLE_SERVICE_PASSWORD в server/.env',
        };
      }

      if (nextPassword.length < 4) {
        return {
          level: 'error',
          message: 'Пароль должен быть минимум 4 символа.',
        };
      }

      if (!useConsoleStore.getState().serviceSession.active) {
        return {
          level: 'error',
          message: 'Сначала войдите: access "ваш-пароль"',
        };
      }

      await updateConsolePassword(nextPassword);
      return {
        level: 'success',
        message: 'Локальный пароль обновлён.',
        details: 'Пароль бэкенда меняйте в server/.env → CONSOLE_SERVICE_PASSWORD',
      };
    }

    case 'lock': {
      const consoleState = useConsoleStore.getState();

      if (consoleState.serviceSession.active) {
        deactivateConsoleAccess(consoleState.serviceSession.snapshot);
        useConsoleStore.getState().resetServiceSession();

        if (consoleState.serviceSession.snapshot?.user) {
          await appRouter.navigate('/');
          return {
            level: 'success',
            message: 'Returned to the previous session.',
          };
        }

        await appRouter.navigate('/');
        return {
          level: 'success',
          message: 'Service session disabled.',
        };
      }

      useAuthStore.getState().lock();
      await appRouter.navigate('/');
      return {
        level: 'success',
        message: 'Workspace locked.',
      };
    }

    case 'logout':
      deactivateConsoleAccess(useConsoleStore.getState().serviceSession.snapshot);
      useConsoleStore.getState().resetServiceSession();
      useAuthStore.getState().clearAuth();
      await appRouter.navigate('/');
      return {
        level: 'success',
        message: 'Session cleared.',
      };

    case 'close':
      return {
        level: 'info',
        message: 'Console hidden.',
        closeConsole: true,
      };

    // ══════════════════════════════════════════
    // GOD-MODE COMMANDS
    // ══════════════════════════════════════════

    case 'users':
      return {
        level: 'info',
        message: `Mock users (${MOCK_AUTH_SESSIONS.length}):`,
        details: formatUsers(),
      };

    case 'switch': {
      const email = parsed.args[0] ?? '';
      if (!email) {
        return {
          level: 'error',
          message: 'Usage: switch "email@demo.kz"',
          details: `Available:\n${MOCK_AUTH_SESSIONS.map((s) => `  ${s.user.email} (${s.role})`).join('\n')}`,
        };
      }

      const session = MOCK_AUTH_SESSIONS.find(
        (s) => s.user.email.toLowerCase() === email.toLowerCase(),
      );
      if (!session) {
        return {
          level: 'error',
          message: `User not found: ${email}`,
          details: `Available:\n${MOCK_AUTH_SESSIONS.map((s) => `  ${s.user.email}`).join('\n')}`,
        };
      }

      const authStore = useAuthStore.getState();
      authStore.setAuth(
        session.user,
        session.org,
        session.access,
        session.refresh,
        session.capabilities,
        session.role,
        { membership: session.membership },
      );
      if (session.membership.status === 'active') {
        authStore.unlock();
      }
      await appRouter.navigate('/');

      return {
        level: 'success',
        message: `Switched to ${session.user.full_name} <${session.user.email}>.`,
        details: `role: ${session.role}\ncapabilities: ${session.capabilities.join(', ') || 'none'}`,
      };
    }

    case 'role': {
      const newRole = parsed.args[0]?.toLowerCase() ?? '';
      const validRoles = ['owner', 'admin', 'manager', 'viewer'];
      if (!validRoles.includes(newRole)) {
        return {
          level: 'error',
          message: `Usage: role "owner"|"admin"|"manager"|"viewer"`,
          details: `Current role: ${useAuthStore.getState().role}`,
        };
      }

      const authStore = useAuthStore.getState();
      authStore.setRole(newRole);
      authStore.setMembership({ role: newRole as 'owner' | 'admin' | 'manager' | 'viewer' });

      // Recalculate capabilities based on role
      const shared = [
        'customers:read', 'customers:write', 'deals:read', 'deals:write',
        'tasks:read', 'tasks:write', 'reports.basic', 'customers.import',
      ];
      let caps = ['reports.basic'];
      if (newRole === 'owner') {
        caps = [...shared, 'billing.manage', 'integrations.manage', 'audit.read', 'team.manage', 'automations.manage'];
      } else if (newRole === 'admin') {
        caps = [...shared, 'integrations.manage', 'audit.read', 'team.manage', 'automations.manage'];
      } else if (newRole === 'manager') {
        caps = shared;
      }
      useAuthStore.setState({ capabilities: caps });

      return {
        level: 'success',
        message: `Role changed to ${newRole}.`,
        details: `capabilities: ${caps.join(', ')}`,
      };
    }

    case 'caps': {
      const sub = parsed.args[0]?.toLowerCase() ?? '';
      const authStore = useAuthStore.getState();

      if (!sub || sub === 'list') {
        return {
          level: 'info',
          message: `Capabilities (${authStore.capabilities.length}):`,
          details: authStore.capabilities.join('\n') || 'none',
        };
      }

      if (sub === 'add') {
        const cap = parsed.args[1] ?? '';
        if (!cap) {
          return { level: 'error', message: 'Usage: caps add "capability.name"' };
        }
        if (authStore.capabilities.includes(cap)) {
          return { level: 'warn', message: `Already has capability: ${cap}` };
        }
        useAuthStore.setState({ capabilities: [...authStore.capabilities, cap] });
        return { level: 'success', message: `Added capability: ${cap}` };
      }

      if (sub === 'rm' || sub === 'remove') {
        const cap = parsed.args[1] ?? '';
        if (!cap) {
          return { level: 'error', message: 'Usage: caps rm "capability.name"' };
        }
        useAuthStore.setState({
          capabilities: authStore.capabilities.filter((c) => c !== cap),
        });
        return { level: 'success', message: `Removed capability: ${cap}` };
      }

      return { level: 'error', message: 'Usage: caps / caps add "cap" / caps rm "cap"' };
    }

    case 'customers':
      return {
        level: 'info',
        message: `Customers (${MOCK_CUSTOMERS.length}):`,
        details: formatCustomers(),
      };

    case 'deals':
      return {
        level: 'info',
        message: `Deals (${MOCK_DEALS.length}):`,
        details: formatDeals(),
      };

    case 'tasks':
      return {
        level: 'info',
        message: `Tasks (${MOCK_TASKS.length}):`,
        details: formatTasks(),
      };

    case 'pipeline':
      return {
        level: 'info',
        message: 'Pipeline configuration.',
        details: formatPipeline(),
      };

    case 'dashboard':
      return {
        level: 'info',
        message: 'Dashboard metrics.',
        details: formatDashboard(),
      };

    case 'storage': {
      const sub = parsed.args[0]?.toLowerCase() ?? 'list';

      if (sub === 'list' || sub === 'ls') {
        return {
          level: 'info',
          message: `localStorage (${localStorage.length} keys):`,
          details: listLocalStorage(),
        };
      }

      if (sub === 'get') {
        const key = parsed.args[1] ?? '';
        if (!key) {
          return { level: 'error', message: 'Usage: storage get "key"' };
        }
        const value = readStorage(key);
        if (value === null) {
          return { level: 'warn', message: `Key not found: ${key}` };
        }
        let formatted = value;
        try { formatted = JSON.stringify(JSON.parse(value), null, 2); } catch { /* use raw */ }
        return { level: 'info', message: `${key}:`, details: formatted };
      }

      if (sub === 'set') {
        const key = parsed.args[1] ?? '';
        const val = parsed.args[2] ?? '';
        if (!key) {
          return { level: 'error', message: 'Usage: storage set "key" "value"' };
        }
        writeStorage(key, val);
        return { level: 'success', message: `Set ${key} = ${val.length > 60 ? val.slice(0, 60) + '...' : val}` };
      }

      if (sub === 'rm' || sub === 'remove' || sub === 'del' || sub === 'delete') {
        const key = parsed.args[1] ?? '';
        if (!key) {
          return { level: 'error', message: 'Usage: storage rm "key"' };
        }
        removeStorage(key);
        return { level: 'success', message: `Removed key: ${key}` };
      }

      if (sub === 'clear') {
        const count = localStorage.length;
        localStorage.clear();
        return { level: 'success', message: `Cleared ${count} localStorage keys.` };
      }

      return { level: 'error', message: 'Usage: storage list / get "key" / set "key" "val" / rm "key" / clear' };
    }

    case 'state': {
      const storeName = parsed.args[0]?.toLowerCase() ?? 'all';
      const result = dumpStoreState(storeName);
      const isError = result.startsWith('Unknown store');
      return {
        level: isError ? 'error' : 'info',
        message: isError ? result : `Store dump: ${storeName}`,
        details: isError ? undefined : result,
      };
    }

    case 'theme': {
      const pack = parsed.args[0]?.toLowerCase() ?? '';
      const validPacks: ThemePack[] = ['neutral', 'graphite', 'sand', 'obsidian', 'enterprise'];
      if (!pack || !validPacks.includes(pack as ThemePack)) {
        const current = useUIStore.getState().themePack;
        return {
          level: 'error',
          message: `Usage: theme "neutral"|"graphite"|"sand"|"obsidian"|"enterprise"`,
          details: `Current theme pack: ${current}`,
        };
      }
      useUIStore.getState().setThemePack(pack as ThemePack);
      return { level: 'success', message: `Theme pack changed to ${pack}.` };
    }

    case 'focus':
      useUIStore.getState().toggleFocusMode();
      return {
        level: 'success',
        message: `Focus mode ${useUIStore.getState().focusMode ? 'enabled' : 'disabled'}.`,
      };

    case 'sidebar':
      useUIStore.getState().toggleSidebar();
      return {
        level: 'success',
        message: `Sidebar ${useUIStore.getState().sidebarCollapsed ? 'collapsed' : 'expanded'}.`,
      };

    case 'reload':
      setTimeout(() => reloadWindow(), 200);
      return { level: 'warn', message: 'Reloading page...' };

    case 'env':
      return {
        level: 'info',
        message: 'Environment info.',
        details: formatEnvironment(),
      };

    case 'org': {
      const sub = parsed.args[0]?.toLowerCase() ?? '';
      const authStore = useAuthStore.getState();

      if (!sub) {
        return {
          level: 'info',
          message: 'Organization.',
          details: authStore.org
            ? JSON.stringify(authStore.org, null, 2)
            : 'No organization set.',
        };
      }

      if (sub === 'set-name') {
        const name = parsed.args[1] ?? '';
        if (!name) return { level: 'error', message: 'Usage: org set-name "New Name"' };
        authStore.setOrg({ name });
        authStore.setMembership({ companyName: name });
        return { level: 'success', message: `Organization name changed to "${name}".` };
      }

      if (sub === 'set-mode') {
        const mode = parsed.args[1]?.toLowerCase() ?? '';
        if (!['basic', 'advanced', 'industrial'].includes(mode)) {
          return { level: 'error', message: 'Usage: org set-mode "basic"|"advanced"|"industrial"' };
        }
        authStore.setOrg({ mode: mode as 'basic' | 'advanced' | 'industrial' });
        return { level: 'success', message: `Organization mode changed to ${mode}.` };
      }

      if (sub === 'set-currency') {
        const currency = parsed.args[1]?.toUpperCase() ?? '';
        if (!currency) return { level: 'error', message: 'Usage: org set-currency "USD"' };
        authStore.setOrg({ currency });
        return { level: 'success', message: `Currency changed to ${currency}.` };
      }

      if (sub === 'companies') {
        return {
          level: 'info',
          message: `Companies (${MOCK_COMPANIES.length}):`,
          details: MOCK_COMPANIES.map((c) =>
            `${c.id}  ${c.name.padEnd(22)}  ${c.slug}  ${c.mode}  ${c.currency}`,
          ).join('\n'),
        };
      }

      return { level: 'error', message: 'Usage: org / org set-name "n" / org set-mode "m" / org set-currency "c" / org companies' };
    }

    case 'eval': {
      const expr = parsed.args.join(' ').trim();
      if (!expr) {
        return { level: 'error', message: 'Usage: eval "expression"' };
      }

      try {
        const result = evaluateArithmeticExpression(expr);
        return {
          level: 'success',
          message: `eval result:`,
          details: String(result),
        };
      } catch (error) {
        return {
          level: 'error',
          message: 'Eval error.',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    }

    case 'broadcast': {
      const source = parsed.args[0] ?? 'console';
      const message = parsed.args.slice(1).join(' ') || 'Custom broadcast event';
      return {
        level: 'info',
        message: `[${source}] ${message}`,
      };
    }

    case 'purge': {
      const count = localStorage.length;
      localStorage.clear();
      sessionStorage.clear();
      setTimeout(() => reloadWindow(), 500);
      return {
        level: 'warn',
        message: `Purged ${count} keys from localStorage. Reloading...`,
      };
    }

    default:
      return {
        level: 'error',
        message: `Unknown command: ${parsed.name}`,
        details: 'Type help to list available commands.',
      };
  }
}
