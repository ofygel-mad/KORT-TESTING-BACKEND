import { describe, expect, it } from 'vitest';
import {
  autocompleteConsoleCommand,
  parseConsoleCommand,
  sanitizeCommandForLog,
} from './commands';
import { filterConsoleEntries } from './store';
import type { ConsoleLogEntry } from './types';

describe('console command parser', () => {
  it('parses quoted arguments', () => {
    expect(parseConsoleCommand('access "1234"')).toEqual({
      name: 'access',
      args: ['1234'],
      raw: 'access "1234"',
    });
  });

  it('redacts sensitive commands', () => {
    expect(sanitizeCommandForLog('change "super-secret"')).toBe('change "[redacted]"');
  });

  it('autocompletes command names', () => {
    expect(autocompleteConsoleCommand('sta')).toBe('status');
  });
});

describe('console entry filter', () => {
  const entries: ConsoleLogEntry[] = [
    {
      id: '1',
      timestamp: '2026-03-20T00:00:00.000Z',
      level: 'info',
      source: 'api',
      message: 'REQ GET /customers',
    },
    {
      id: '2',
      timestamp: '2026-03-20T00:00:01.000Z',
      level: 'error',
      source: 'system',
      message: 'Unhandled error',
    },
  ];

  it('filters by source and text query', () => {
    const filtered = filterConsoleEntries(entries, {
      source: 'api',
      level: 'all',
      query: 'customers',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('1');
  });
});
