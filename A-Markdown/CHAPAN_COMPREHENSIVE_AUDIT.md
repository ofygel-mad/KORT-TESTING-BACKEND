# 🚨 CHAPAN COMPREHENSIVE AUDIT - ALL SUBSYSTEMS

**Date:** 2026-04-11  
**Scope:** Full Chapan system audit (Orders, Returns, Invoices, Production, Warehouse Integration)  
**Status:** 🔴 Multiple critical and major issues found

---

## 🔴 CRITICAL ISSUES

### Issue #1: INVOICE TYPE DEFINITIONS MISMATCH

**Location:** `types.ts` vs `invoices.service.ts`  
**Severity:** 🔴 CRITICAL

**Problem:**
- In `invoices.service.ts` line 521-524, code uses `rejectedAt` and `rejectedBy` fields
- But in `types.ts` (line 435-436), ChapanInvoice defines: `rejectedBy: string | null` and `rejectionReason: string | null`
- **Missing field:** `rejectedAt` is NOT defined in ChapanInvoice type!

**Impact:** Type mismatch when rejecting invoices

**Fix needed:**
```typescript
// In types.ts, ChapanInvoice interface should have:
rejectedAt: string | null;  // ADD THIS
rejectedBy: string | null;
rejectionReason: string | null;
```

---

### Issue #2: INVOICE DOCUMENT PAYLOAD MISSING FIELDS

**Location:** `invoices.service.ts` lines 99-109, 304-310  
**Severity:** 🔴 CRITICAL

**Problem:**
In `loadInvoiceSourceOrders`, the select only includes:
```typescript
select: {
  productName: true,
  fabric: true,
  size: true,
  quantity: true,
  unitPrice: true,
  color: true,
  // MISSING: gender, length
}
```

But `InvoiceDocumentRow` expects all attribute fields including `gender` and `length` (lines 384-387 in types.ts).

**Impact:** Incomplete invoice documents - missing gender and length info

**Fix needed:**
```typescript
select: {
  productName: true,
  fabric: true,
  size: true,
  quantity: true,
  unitPrice: true,
  color: true,
  gender: true,      // ADD THIS
  length: true,      // ADD THIS
}
```

---

### Issue #3: RETURNS.SERVICE WAREHOUSE INTEGRATION BUG

**Location:** `returns.service.ts` lines 238-241  
**Severity:** 🔴 CRITICAL

**Problem:**
When resolving warehouseItemId from orderItemId → variantKey, the code:
```typescript
const warehouseItem = await prisma.warehouseItem.findFirst({
  where: { orgId, variantKey: orderItem.variantKey },
  select: { id: true },
});
```

**BUT** the orderItem's variantKey was built with OLD format (before our fix)!  
If items were created before variantKey fix, they have format: `товар:цвет=синий:размер=44`  
But warehouse now expects: `товар|цвет:синий|размер:44`

**Impact:** Returns can't find warehouse items → stock replenishment fails silently (line 259)

**Fix needed:**
1. Apply warehouse variantKey migration first
2. Rebuild all orderItem.variantKey values OR
3. Add fallback logic that tries both formats

---

### Issue #4: PAYMENT STATUS ENFORCEMENT TOO STRICT

**Location:** `invoices.service.ts` lines 144-151  
**Severity:** 🟠 MAJOR

**Problem:**
```typescript
const unpaid = orders.filter((order) => order.paymentStatus !== 'paid');
if (unpaid.length > 0) {
  throw new ValidationError(`Невозможно передать неоплаченные заказы...`);
}
```

This requires ALL payment to be collected before invoice creation.  
**But** types.ts defines `paymentStatus: 'not_paid' | 'partial' | 'paid'`

**Is this intentional?** Should partial payments be allowed?  
If not documented in business requirements, this may be **overly restrictive**.

**Recommendation:**
- Document this as intentional requirement OR
- Change to allow 'partial' payments based on business rules

---

### Issue #5: ORDER STATUS TRANSITIONS NOT VALIDATED

**Location:** `orders.service.ts` and `invoices.service.ts`  
**Severity:** 🟠 MAJOR

**Problem:**
Order status has defined sequence:
```
new → confirmed → in_production → ready → transferred → on_warehouse → shipped → completed
                                                                    ↘ cancelled
```

**But** no centralized validation exists for transitions. Examples of issues:

1. **invoices.service.ts line 137**: Only allows 'ready' status
   - But what if order is in 'in_production'? Should it be allowed?
   - No documentation of business rule

2. **orders.service.ts line 586**: `returnToReady` only allows 'on_warehouse'
   - What about 'shipped' status orders? Can they return?

3. **returns.service.ts line 131**: Only allows 'shipped' or 'completed'
   - Inconsistent with workflow! Why not 'on_warehouse'?

**Impact:** Inconsistent state transitions between modules

**Fix needed:**
Create centralized `validateOrderStatusTransition(fromStatus, toStatus)` function used by all modules

---

### Issue #6: VARIANTKEY CONSISTENCY IN PRODUCTION TASKS

**Location:** `orders.service.ts` line 112  
**Severity:** 🟠 MAJOR

**Problem:**
`ProductionTask` type includes `color`, `gender`, `length` fields (lines 110-112 in types.ts)

But in `orders.service.ts` buildOrderItemVariantSnapshot (lines 139-192), variantKey is built and stored.

**Question:** Is variantKey stored on ProductionTask? NO - it's NOT in the model!

**But** when production completes, how does it know which warehouse item to update?  
If using variantKey fallback, it must be rebuilt from order item attributes each time.

**Impact:** Potential data loss if attributes are missing from production task

**Fix needed:**
Store variantKey on ProductionTask directly OR  
Ensure order item attributes are always preserved

---

## 🟡 MAJOR ISSUES

### Issue #7: WAREHOUSE INTEGRATION ERROR HANDLING

**Location:** `returns.service.ts` lines 246-260  
**Severity:** 🟡 MAJOR

**Code:**
```typescript
if (!warehouseItemId) continue;

try {
  await addMovement(orgId, {
    itemId: warehouseItemId,
    type: 'return',
    ...
  });
} catch (err) {
  // Log but don't fail
  console.error(`[returns] Failed to create warehouse movement...`);
}
```

**Problem:** 
- If warehouse integration fails, return is still confirmed but stock NOT replenished
- User has no indication that warehouse movement failed
- Only logs to console (may not be visible)

**Fix needed:**
- Either fail the return confirmation if warehouse movement fails
- OR return a warning status to frontend so user knows

---

### Issue #8: INVOICE CONFIRMATION SIDE EFFECTS

**Location:** `invoices.service.ts` lines 440, 487  
**Severity:** 🟡 MAJOR

**Code:**
```typescript
if (bothConfirmed) {
  await advanceOrdersToWarehouse(orgId, tx, invoice.items, userId, userName, invoice.invoiceNumber);
}
```

This automatically advances orders to 'on_warehouse' status.

**Questions:**
1. What if order doesn't have warehouse items? (only production items)
   - Should it still advance?
2. What if warehouse rejects the order?
   - Order is already 'on_warehouse' with no rollback

**Fix needed:**
- Validate orders can actually go to warehouse (have warehouse fulfillment mode)
- Add pre-checks before automatic status advancement

---

### Issue #9: DUPLICATE ORDER NUMBER GENERATION

**Location:** `orders.service.ts` line 239-251  
**Severity:** 🟡 MAJOR

**Code:**
```typescript
const rows = await tx.$queryRaw<...>`
  UPDATE chapan_profiles
  SET    order_counter = order_counter + 1
  WHERE  org_id = ${orgId}
  RETURNING order_counter, order_prefix
`;
```

Uses raw SQL with race condition protection.  
**But** is there equivalent logic for invoice numbers?

**Location:** `invoices.service.ts` line 170  
```typescript
const invoiceNumber = await nextInvoiceNumber(tx, orgId, createdAt);
```

This delegates to `invoice-number.js` - need to verify it has same race condition protection.

**Fix needed:**
- Verify both use atomic operations
- Document the pattern for future number generation

---

### Issue #10: RETURNS REFUND METHOD OPTIONAL

**Location:** `returns.service.ts` line 89  
**Severity:** 🟡 MAJOR

**Code:**
```typescript
export interface CreateReturnDto {
  ...
  refundMethod?: 'cash' | 'bank';  // OPTIONAL!
  ...
}
```

But later in database creation (line 157), `refundMethod` is saved as-is.

**Problem:**
- If refundMethod is not provided, it's stored as NULL
- Backend accepts partial returns without specifying refund method
- Frontend may not enforce selection

**Impact:** Incomplete return records

**Fix needed:**
- Make refundMethod REQUIRED in CreateReturnDto
- Validate in routes/API

---

## 🟢 MINOR ISSUES

### Issue #11: INCONSISTENT ERROR MESSAGES

**Severity:** 🟢 MINOR

**Examples:**
- `invoices.service.ts` line 134: "Некоторые заказы не найдены"
- `orders.service.ts`: Various error messages without consistent format

**Fix:** Standardize error message format across modules

---

### Issue #12: MISSING VALIDATION

**Location:** Multiple  
**Severity:** 🟢 MINOR

- Order items quantity > 0?
- Refund amounts positive?
- Order discounts not exceeding total?
- Client phone format validation

---

## 📊 SUMMARY TABLE

| Issue | Severity | Module | Type | Status |
|-------|----------|--------|------|--------|
| #1 - Invoice type mismatch | 🔴 CRITICAL | types.ts + invoices | Type | ❌ Not Fixed |
| #2 - Missing invoice fields | 🔴 CRITICAL | invoices | Logic | ❌ Not Fixed |
| #3 - Returns variantKey bug | 🔴 CRITICAL | returns | Integration | ❌ Not Fixed |
| #4 - Payment enforcement | 🟠 MAJOR | invoices | Logic | ⚠️ Needs Review |
| #5 - Status transitions | 🟠 MAJOR | orders + invoices | Design | ❌ Not Fixed |
| #6 - variantKey on ProductionTask | 🟠 MAJOR | orders + production | Design | ❌ Not Fixed |
| #7 - Warehouse error handling | 🟡 MAJOR | returns | Error Handling | ❌ Not Fixed |
| #8 - Invoice auto-advance | 🟡 MAJOR | invoices | Logic | ❌ Not Fixed |
| #9 - Number generation | 🟡 MAJOR | orders + invoices | Design | ⚠️ Verify |
| #10 - Refund method optional | 🟡 MAJOR | returns | Validation | ❌ Not Fixed |
| #11 - Error messages | 🟢 MINOR | All | Style | 🔄 Low Priority |
| #12 - Input validation | 🟢 MINOR | All | Validation | 🔄 Low Priority |

---

## ✅ NEXT STEPS

### IMMEDIATE (Before Production):
1. [ ] Fix Issue #1 - Add rejectedAt to ChapanInvoice type
2. [ ] Fix Issue #2 - Add gender, length to invoice document loads
3. [ ] Fix Issue #3 - Handle variantKey format in returns (with migration)
4. [ ] Fix Issue #10 - Make refundMethod required

### SHORT-TERM:
5. [ ] Fix Issue #5 - Create centralized status transition validator
6. [ ] Fix Issue #7 - Improve warehouse error handling
7. [ ] Fix Issue #8 - Add pre-checks before invoice auto-advance
8. [ ] Fix Issue #6 - Store or validate variantKey on production tasks

### MEDIUM-TERM:
9. [ ] Verify Issue #9 - Check invoice number generation
10. [ ] Fix Issue #4 - Document or fix payment enforcement
11. [ ] Fix Issues #11-12 - Standardize errors and validation

---

**Report prepared by:** Claude Code Audit System  
**Full fix implementation required before shipping**
