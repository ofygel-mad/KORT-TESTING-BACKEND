# 🔍 Chapan Full System Audit Plan

## Scope
Audit all Chapan subsystems for:
1. variantKey consistency (orders, returns, invoices, warehouse integration)
2. Status workflow consistency
3. Warehouse integration consistency
4. Type consistency (DTOs, entities, API responses)
5. Error handling patterns
6. Data validation

## Subsystems to Audit

### 1. Orders (orders.service.ts, orders.routes.ts)
**Status transitions:** new → confirmed → in_production → ready → transferred → on_warehouse → shipped → completed/cancelled

**Checklist:**
- [ ] variantKey building consistency (must use buildWarehouseVariantKey)
- [ ] Status validation for each transition
- [ ] Warehouse integration on status changes
- [ ] Error handling for invalid transitions
- [ ] Production task lifecycle

### 2. Returns (returns.service.ts, returns.routes.ts)
**Status flow:** draft → confirmed

**Checklist:**
- [ ] Order status validation (can only create returns for shipped/completed)
- [ ] variantKey resolution for warehouse movements
- [ ] Warehouse stock replenishment logic
- [ ] Refund amount calculation
- [ ] warehouse integration

### 3. Invoices (invoices.service.ts, invoices.routes.ts)  
**Status:** pending_confirmation → confirmed/rejected → archived

**Checklist:**
- [ ] Order status check (only ready orders?)
- [ ] Two-side confirmation (seamstress + warehouse)
- [ ] Rejection handling
- [ ] variantKey consistency in document rows
- [ ] Stock reservation for warehouse confirmation

### 4. Production (production.service.ts, production.routes.ts)
**Task status:** queued → in_progress → done

**Checklist:**
- [ ] Production task lifecycle
- [ ] variantKey preservation from order items
- [ ] Blocking/flagging mechanism
- [ ] Production capacity constraints
- [ ] Integration with order status

### 5. Warehouse Integration Points
**Files:** orders.service.ts, returns.service.ts, invoices.service.ts, production.service.ts

**Checklist:**
- [ ] variantKey format consistency
- [ ] Item lookup by variantKey
- [ ] Stock availability checks
- [ ] Reservation lifecycle
- [ ] Stock movements (in/out/adjustment)
- [ ] Warehouse <-> Chapan status synchronization

### 6. Data Types & DTOs
**Files:** types.ts, all service.ts files

**Checklist:**
- [ ] OrderStatus enum vs actual strings
- [ ] ProductionStatus enum vs actual strings
- [ ] InvoiceStatus enum vs actual strings
- [ ] ReturnStatus enum vs actual strings
- [ ] variantKey field presence in all relevant DTOs
- [ ] Attribute fields consistency (color, gender, size, length, fabric)

### 7. Error Handling
**All files**

**Checklist:**
- [ ] ValidationError vs AppError usage consistency
- [ ] NotFoundError usage
- [ ] Status validation errors
- [ ] Warehouse operation failure handling
- [ ] Transaction rollback on errors

---

## Known Issues Found (to be listed)

(Will be updated during audit)
