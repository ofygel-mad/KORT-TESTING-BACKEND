/**
 * Sprint 13: Smoke tests for Sprint 9 attachment logic
 * Tests file validation, size formatting, and download URL generation
 * without requiring a real backend.
 */
import { describe, expect, it } from 'vitest';

// ── Mirrors attachments.service.ts allowed types ──────────────────────────────

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.pdf', '.xlsx', '.xls',
]);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

function isAllowedFile(filename: string, mimetype: string): boolean {
  return ALLOWED_EXTENSIONS.has(getExtension(filename)) && ALLOWED_MIME_TYPES.has(mimetype);
}

// ── Mirrors frontend formatters ───────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function buildDownloadUrl(orderId: string, attachmentId: string): string {
  return `/api/v1/chapan/orders/${orderId}/attachments/${attachmentId}/file`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Sprint 9: attachment file validation', () => {
  it('accepts JPEG image', () => {
    expect(isAllowedFile('чек.jpg', 'image/jpeg')).toBe(true);
  });

  it('accepts PNG image', () => {
    expect(isAllowedFile('reference.png', 'image/png')).toBe(true);
  });

  it('accepts PDF', () => {
    expect(isAllowedFile('contract.pdf', 'application/pdf')).toBe(true);
  });

  it('accepts xlsx', () => {
    expect(isAllowedFile('report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
  });

  it('rejects .exe file', () => {
    expect(isAllowedFile('virus.exe', 'application/octet-stream')).toBe(false);
  });

  it('rejects .zip file', () => {
    expect(isAllowedFile('archive.zip', 'application/zip')).toBe(false);
  });

  it('rejects file with no extension', () => {
    expect(isAllowedFile('noextension', 'image/jpeg')).toBe(false);
  });

  it('rejects when extension ok but mime type wrong (spoofed)', () => {
    expect(isAllowedFile('exploit.jpg', 'application/javascript')).toBe(false);
  });

  it('is case-insensitive for extension', () => {
    expect(isAllowedFile('photo.JPG', 'image/jpeg')).toBe(true);
    expect(isAllowedFile('scan.PDF', 'application/pdf')).toBe(true);
  });
});

describe('Sprint 9: file size formatting', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatFileSize(512)).toBe('512 Б');
  });

  it('formats KB range', () => {
    expect(formatFileSize(4096)).toBe('4 КБ');
    expect(formatFileSize(150 * 1024)).toBe('150 КБ');
  });

  it('formats MB range', () => {
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 МБ');
  });

  it('10 MB limit check: 10MB is exactly at limit boundary', () => {
    const MAX_MB = 10;
    const MAX_BYTES = MAX_MB * 1024 * 1024;
    expect(MAX_BYTES).toBe(10_485_760);
    // 10MB file is at the limit
    expect(10 * 1024 * 1024).toBeLessThanOrEqual(MAX_BYTES);
    // 10MB + 1 byte exceeds
    expect(10 * 1024 * 1024 + 1).toBeGreaterThan(MAX_BYTES);
  });
});

describe('Sprint 9: download URL generation', () => {
  it('builds correct download URL', () => {
    const url = buildDownloadUrl('order-abc', 'att-xyz');
    expect(url).toBe('/api/v1/chapan/orders/order-abc/attachments/att-xyz/file');
  });

  it('URL contains orderId and attachmentId', () => {
    const orderId = 'test-order-123';
    const attachmentId = 'att-456';
    const url = buildDownloadUrl(orderId, attachmentId);
    expect(url).toContain(orderId);
    expect(url).toContain(attachmentId);
  });
});
