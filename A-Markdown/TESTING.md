# Testing Strategy and Guide

## Overview

KORT implements a comprehensive Enterprise-grade CI/CD testing pyramid covering:
- **Unit Tests**: Individual function and module behavior
- **Component Tests**: Frontend component rendering and interactions
- **Integration Tests**: Database interactions and service workflows
- **API Tests**: Backend HTTP endpoint validation
- **E2E Tests**: Complete user workflows across the application
- **Security Scanning**: OWASP, CodeQL, Snyk, and vulnerability detection
- **Performance Testing**: Bundle analysis, Lighthouse audits, backend benchmarks

## Test Structure

### Backend Tests

#### Unit Tests
- **Location**: `server/src/modules/**/__tests__/*.test.ts`
- **Framework**: Vitest
- **Coverage Target**: 80% lines, functions, statements; 75% branches
- **Running**: `pnpm run test` (with watch) or `pnpm run test:run` (single run)

**Example**: `server/src/modules/chapan/__tests__/orders.service.test.ts`
- Tests core order service functions
- Uses mocks for external dependencies (Prisma, Google Sheets)
- 20 tests covering CRUD, filtering, and state transitions

#### Integration Tests
- **Location**: `server/src/modules/**/__tests__/*.integration.test.ts`
- **Framework**: Vitest
- **Database**: PostgreSQL test instance
- **Status**: Skipped by default (require database setup)
- **Running**: `pnpm run test:run` (when DB configured)

**Example**: `server/src/modules/chapan/__tests__/orders.integration.test.ts`
- Tests order lifecycle with real database
- 26 tests covering full workflows (currently skipped)
- Will activate once test database is configured in .env.test

#### Module Tests
- **Location**: `server/src/modules/**/__tests__/*.test.ts`
- **Example**: `sheets.sync.test.ts` - 29 tests for Google Sheets sync

### Frontend Tests

#### Component Tests
- **Location**: `src/pages/**/*.test.ts` and `src/components/**/*.test.ts`
- **Framework**: Vitest (with component-specific test utilities)
- **Examples**:
  - `ChapanOrders.test.ts` - Component behavior and state
  - `ChapanFinancials.test.ts` - Financial calculations
  - `ChapanUrgencySort.test.ts` - Sorting logic

#### E2E Tests
- **Location**: `src/pages/**/*.e2e.test.ts`
- **Framework**: Playwright
- **Browsers**: Chrome, Firefox, Safari
- **Devices**: Desktop, Pixel 5, iPhone 12
- **Running**: `npx playwright test` (or `pnpm run test:e2e`)

**Example**: `src/pages/workzone/chapan/orders/ChapanOrders.e2e.test.ts`
- 100+ test cases covering:
  - Order list display and filtering
  - Order detail navigation
  - Create/edit operations
  - Search and sorting
  - Mobile responsiveness
  - Keyboard accessibility
  - Performance metrics

## Running Tests

### Backend Tests

```bash
# Navigate to server directory
cd server

# Run all tests once
pnpm run test:run

# Run tests in watch mode
pnpm run test

# Run with UI
pnpm run test:ui

# Run with coverage report
pnpm run test:coverage

# Run specific test file
pnpm run test:run src/modules/chapan/__tests__/orders.service.test.ts
```

### Frontend Tests

```bash
# Run all component tests
npm run test

# Run component tests in watch mode
npm run test -- --watch

# Run E2E tests
npx playwright test

# Run E2E tests in UI mode
npx playwright test --ui

# Run E2E tests for specific browser
npx playwright test --project=chromium

# Run E2E tests headed (see browser window)
npx playwright test --headed
```

## Coverage Reports

### Backend Coverage
Generated after running tests:
```bash
cd server && pnpm run test:coverage
open coverage/index.html
```

Reports include:
- Line coverage
- Branch coverage
- Function coverage
- HTML report for interactive exploration

### Coverage Thresholds
- **Lines**: 80% minimum
- **Functions**: 80% minimum
- **Branches**: 75% minimum
- **Statements**: 80% minimum

## CI/CD Integration

### GitHub Actions Workflows

#### 1. **test.yml** - Test Pipeline
Runs on: Every PR and push to main
- Linting with ESLint
- Backend unit tests (Vitest)
- Frontend unit/component tests
- E2E tests (Playwright)
- Coverage reporting to Codecov

#### 2. **security.yml** - Security Scanning
Runs: Daily + on push/PR
- CodeQL for TypeScript/JavaScript
- OWASP Dependency Check
- npm audit
- Snyk vulnerability scanning
- Gitleaks for secret detection
- SBOM generation with CycloneDX

#### 3. **performance.yml** - Performance Benchmarks
Runs: Every PR and main branch
- Bundle size analysis
- Lighthouse CI for frontend performance
- Backend performance benchmarks
- Database query performance
- Reports on PR comments

#### 4. **docker.yml** - Docker Verification
Runs: On Dockerfile changes
- Docker image build verification
- Docker Compose health checks
- Trivy container security scanning

#### 5. **deploy.yml** - Deployment Readiness
Runs: Before deployment
- Environment configuration validation
- Staging environment simulation
- API endpoint verification

## Test Patterns

### Unit Test Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Module Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Function Name', () => {
    it('should handle specific case', () => {
      // Arrange
      const input = { /* test data */ };

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe(expectedValue);
    });
  });
});
```

### E2E Test Pattern

```typescript
import { test, expect } from '@playwright/test';

test.describe('Page/Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/path');
    await page.waitForLoadState('networkidle');
  });

  test('should perform action', async ({ page }) => {
    // Arrange
    const element = page.locator('[data-testid="element"]');

    // Act
    await element.click();

    // Assert
    await expect(element).toBeVisible();
  });
});
```

## Adding New Tests

### Backend Unit Test
1. Create file: `src/modules/feature/__tests__/feature.test.ts`
2. Import test framework: `import { describe, it, expect } from 'vitest'`
3. Write test cases following Arrange-Act-Assert pattern
4. Run: `pnpm run test:run -- src/modules/feature/__tests__/feature.test.ts`

### Backend Integration Test
1. Create file: `src/modules/feature/__tests__/feature.integration.test.ts`
2. Import `prisma` for database access
3. Use `beforeEach`/`afterEach` for data cleanup
4. Mark as `.skip` until database is configured
5. Run with: `pnpm run test:run`

### Frontend Component Test
1. Create file: `src/pages/path/Component.test.ts`
2. Use Vitest + appropriate testing library
3. Test rendering, props, and user interactions
4. Run: `npm run test`

### Frontend E2E Test
1. Create file: `src/pages/path/Component.e2e.test.ts`
2. Use Playwright test syntax
3. Use `data-testid` attributes for selectors
4. Test complete user workflows
5. Run: `npx playwright test src/pages/path/Component.e2e.test.ts`

## Test Data

### Backend Test Database
- **File**: `server/.env.test`
- **Database**: PostgreSQL (kort_db_test)
- **URL**: `postgresql://kort:kort_secret@localhost:5432/kort_db_test`
- **Reset**: Uses `beforeEach`/`afterEach` hooks for cleanup

### Frontend Test Environment
- **Base URL**: `http://localhost:5173`
- **Viewport**: Configured in Playwright config
- **Devices**: Multiple device profiles defined

## Performance Targets

### Frontend
- **Page Load**: < 5 seconds
- **Lighthouse Performance**: ≥ 80
- **Lighthouse Accessibility**: ≥ 90
- **Lighthouse Best Practices**: ≥ 90
- **Lighthouse SEO**: ≥ 90

### Backend
- **API Response Time**: < 1 second (p95)
- **Database Query**: < 100ms (p95)
- **Test Suite Duration**: < 5 minutes

## Debugging Tests

### Backend Tests
```bash
# Run with detailed output
pnpm run test:run -- --reporter=verbose

# Run single test
pnpm run test:run -- -t "test name"

# Run with debugging
NODE_OPTIONS=--inspect-brk pnpm run test:run
```

### Frontend E2E Tests
```bash
# Run with UI mode
npx playwright test --ui

# Run headed (see browser)
npx playwright test --headed

# Debug specific test
npx playwright test --debug src/pages/path/Component.e2e.test.ts

# Generate trace for debugging
npx playwright test --trace=on
```

## Troubleshooting

### "Cannot find module" errors
- Run `pnpm install` or `npm install`
- For backend: Run `pnpm run db:generate` to generate Prisma client

### Database connection errors
- Verify PostgreSQL is running
- Check `.env.test` DATABASE_URL is correct
- Run migrations: `pnpm run db:push`

### E2E test timeouts
- Increase `testTimeout` in `playwright.config.ts`
- Check if app is running on `http://localhost:5173`
- Use `--debug` flag to step through

### Coverage not generated
- Check coverage configuration in `vitest.config.ts`
- Ensure v8 provider is installed: `pnpm install @vitest/coverage-v8`
- Run: `pnpm run test:coverage`

## Best Practices

1. **Test Naming**: Use descriptive names that explain expected behavior
   - ✅ "should create order with valid data"
   - ❌ "test order creation"

2. **Test Isolation**: Each test should be independent
   - Use `beforeEach`/`afterEach` for setup/cleanup
   - Don't share state between tests
   - Mock external dependencies

3. **Avoid Implementation Details**: Test behavior, not implementation
   - ✅ Test that order is created when form submitted
   - ❌ Test that `createOrder` function was called

4. **Keep Tests Simple**: One assertion focus per test when possible
   - Easier to debug failures
   - More maintainable
   - Clearer test intent

5. **Use Meaningful Data**: Test with realistic data
   - Not just placeholder values
   - Consider edge cases and boundaries
   - Include valid and invalid inputs

6. **Performance**: Keep tests fast
   - Don't wait unnecessarily
   - Use mocks instead of real services
   - Run slow tests in separate suite if needed

## Continuous Integration

Tests run automatically on:
- **Push to any branch**: Linting + unit/component tests
- **Pull Request**: Full test suite + security scanning
- **Merge to main**: All tests + performance benchmarks + deployment checks
- **Scheduled (daily)**: Full security audit + performance trending

All PR checks must pass before merging to main.

## Coverage Goals

- **Overall**: 80% minimum
- **Critical paths**: 90%+ (authentication, payments, data export)
- **UI components**: 70%+ (harder to test interactions)
- **Utilities**: 90%+ (core business logic)

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Playwright Documentation](https://playwright.dev)
- [Testing Library Best Practices](https://testing-library.com/docs)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

## Contact & Questions

For testing-related questions or issues:
1. Check this documentation
2. Review existing test examples
3. Run tests in debug mode
4. Check CI/CD logs for error details
