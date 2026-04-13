# FINAL PATCH

В документ включены только реально незакрытые кодовые пункты из `TO_DO_LIST.md`, которые ещё подтверждаются текущим кодом:

- `C2` — mixed-оплата всё ещё привязана к фиксированным полям;
- `F3` — автосумма доставки всё ещё зашита локально в UI.

Другие исторические `🟡`-статусы из `TO_DO_LIST.md` в этот документ не включены, если по текущему коду они уже закрыты или остались только на уровне живой operational-проверки.

### [C2] Динамическая mixed-оплата

**Файл:** `server/prisma/schema.prisma`  
**Что меняем:** добавляем в заказ отдельное поле для сохраняемой разбивки оплаты, чтобы уйти от фиксированных `mixedCash / mixedKaspiQr / mixedKaspiTerminal / mixedTransfer`.
**Diff:**
```diff
 model ChapanOrder {
   id            String    @id @default(cuid())
   orgId         String    @map("org_id")
   clientId      String    @map("client_id")
   orderNumber   String    @map("order_number")
   clientName    String    @map("client_name")
   clientPhone   String    @map("client_phone")
   status        String    @default("new")
   paymentStatus String    @default("not_paid") @map("payment_status")
   priority      String    @default("normal")
   urgency       String    @default("normal")
   isDemandingClient Boolean @default(false) @map("is_demanding_client")
   dueDate       DateTime? @map("due_date")
   totalAmount   Float     @default(0) @map("total_amount")
   paidAmount    Float     @default(0) @map("paid_amount")
   completedAt   DateTime? @map("completed_at")
   cancelledAt   DateTime? @map("cancelled_at")
   cancelReason  String?   @map("cancel_reason")
   streetAddress         String?   @map("street_address")
   city                  String?
   deliveryType          String?   @map("delivery_type")
   source                String?
   expectedPaymentMethod String?   @map("expected_payment_method")
-  shippingNote          String?   @map("shipping_note")
+  paymentBreakdown      Json?     @map("payment_breakdown")
+  shippingNote          String?   @map("shipping_note")
   internalNote          String?   @map("internal_note")
   postalCode            String?   @map("postal_code")
   orderDate             DateTime? @map("order_date")
   orderDiscount         Float     @default(0) @map("order_discount")
   deliveryFee           Float     @default(0) @map("delivery_fee")
   bankCommissionPercent Float     @default(0) @map("bank_commission_percent")
   bankCommissionAmount  Float     @default(0) @map("bank_commission_amount")
 ```
**Почему безопасно:** это additive-поле, оно не ломает старые заказы и позволяет перевести форму на новый формат без удаления legacy-данных.

**Файл:** `server/src/modules/chapan/orders.routes.ts`  
**Что меняем:** принимаем словарь `paymentBreakdown` как основной новый формат, не ломая остальной payment-flow.
**Diff:**
```diff
   app.post('/', async (request, reply) => {
     const body = z.object({
       clientId: z.string().optional(),
       clientName: z.string().min(1),
       clientPhone: z.string().min(1),
       priority: z.enum(['normal', 'urgent', 'vip']).default('normal'),
       urgency: z.enum(['normal', 'urgent']).optional(),
       isDemandingClient: z.boolean().optional(),
       items: z.array(orderItemSchema).min(1),
       dueDate: z.string().optional(),
       prepayment: z.number().min(0).optional(),
       paymentMethod: z.string().trim().min(1).optional(),
+      paymentBreakdown: z.record(z.string().trim().min(1), z.number().min(0)).optional(),
       mixedBreakdown: z.object({
         mixedCash: z.number().min(0),
         mixedKaspiQr: z.number().min(0),
         mixedKaspiTerminal: z.number().min(0),
         mixedTransfer: z.number().min(0),
       }).optional(),
       streetAddress: z.string().optional(),
 ```

```diff
   app.patch('/:id', async (request, reply) => {
     const { id } = request.params as { id: string };
     const body = z.object({
       clientName: z.string().min(1).optional(),
       clientPhone: z.string().min(1).optional(),
       dueDate: z.string().nullable().optional(),
       priority: z.enum(['normal', 'urgent', 'vip']).optional(),
       urgency: z.enum(['normal', 'urgent']).optional(),
       isDemandingClient: z.boolean().optional(),
       city: z.string().trim().optional(),
       streetAddress: z.string().optional(),
       postalCode: z.string().trim().optional(),
       deliveryType: z.string().trim().optional(),
       source: z.string().trim().optional(),
       orderDate: z.string().optional(),
       orderDiscount: z.number().min(0).optional(),
       deliveryFee: z.number().min(0).optional(),
       bankCommissionPercent: z.number().min(0).max(100).optional(),
       bankCommissionAmount: z.number().min(0).optional(),
       prepayment: z.number().min(0).optional(),
       paymentMethod: z.string().optional(),
       expectedPaymentMethod: z.string().optional(),
+      paymentBreakdown: z.record(z.string().trim().min(1), z.number().min(0)).optional(),
       mixedCash: z.number().min(0).optional(),
       mixedKaspiQr: z.number().min(0).optional(),
       mixedKaspiTerminal: z.number().min(0).optional(),
       mixedTransfer: z.number().min(0).optional(),
       items: z.array(orderItemSchema).optional(),
 ```
**Почему безопасно:** новый контракт добавляется рядом с текущим, поэтому create/edit можно перевести поэтапно без мгновенного отрыва legacy-клиентов.

**Файл:** `server/src/modules/chapan/orders.service.ts`  
**Что меняем:** нормализуем разбивку оплаты в словарь, сохраняем её в заказе и строим payment-note из реального набора методов, а не из четырёх жёстких ключей.
**Diff:**
```diff
 type CreateOrderInput = {
   clientId?: string;
   clientName: string;
   clientPhone: string;
   priority: string;
   urgency?: string;
   isDemandingClient?: boolean;
   items: Array<{
     productName: string;
     fabric?: string;
     color?: string;
     gender?: string;
     length?: string;
     size: string;
     quantity: number;
     unitPrice: number;
     notes?: string;
     workshopNotes?: string;
   }>;
   dueDate?: string;
   prepayment?: number;
   paymentMethod?: string;
+  paymentBreakdown?: Record<string, number>;
   mixedBreakdown?: {
     mixedCash: number;
     mixedKaspiQr: number;
     mixedKaspiTerminal: number;
     mixedTransfer: number;
   };
 ```

```diff
-function buildMixedPaymentNote(mixedBreakdown: NonNullable<CreateOrderInput['mixedBreakdown']>) {
-  const parts = [
-    { method: 'cash', amount: mixedBreakdown.mixedCash },
-    { method: 'kaspi_qr', amount: mixedBreakdown.mixedKaspiQr },
-    { method: 'kaspi_terminal', amount: mixedBreakdown.mixedKaspiTerminal },
-    { method: 'transfer', amount: mixedBreakdown.mixedTransfer },
-  ]
-    .filter((part) => part.amount > 0)
-    .map((part) => `${formatPaymentMethod(part.method)}: ${part.amount.toLocaleString('ru-RU')} ₸`);
-
-  return parts.length > 0 ? parts.join('; ') : undefined;
-}
-
-function buildInitialPaymentNote(data: CreateOrderInput) {
-  if (data.paymentMethod !== 'mixed' || !data.mixedBreakdown) {
-    return undefined;
-  }
-
-  return buildMixedPaymentNote(data.mixedBreakdown);
-}
+function normalizePaymentBreakdown(data: {
+  paymentBreakdown?: Record<string, number>;
+  mixedBreakdown?: CreateOrderInput['mixedBreakdown'];
+}) {
+  if (data.paymentBreakdown && Object.keys(data.paymentBreakdown).length > 0) {
+    return Object.fromEntries(
+      Object.entries(data.paymentBreakdown)
+        .map(([method, amount]) => [method.trim(), Number(amount) || 0] as const)
+        .filter(([method, amount]) => method && amount > 0),
+    );
+  }
+
+  if (!data.mixedBreakdown) return undefined;
+
+  return {
+    cash: data.mixedBreakdown.mixedCash,
+    kaspi_qr: data.mixedBreakdown.mixedKaspiQr,
+    kaspi_terminal: data.mixedBreakdown.mixedKaspiTerminal,
+    transfer: data.mixedBreakdown.mixedTransfer,
+  };
+}
+
+function buildMixedPaymentNote(paymentBreakdown: Record<string, number>) {
+  const parts = Object.entries(paymentBreakdown)
+    .filter(([, amount]) => amount > 0)
+    .map(([method, amount]) => `${formatPaymentMethod(method)}: ${amount.toLocaleString('ru-RU')} ₸`);
+
+  return parts.length > 0 ? parts.join('; ') : undefined;
+}
```

```diff
 export async function create(orgId: string, authorId: string, authorName: string, data: CreateOrderInput) {
   const orderNumber = await nextOrderNumber(orgId);
   const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
   const prepayment = Math.max(0, data.prepayment ?? 0);
   const paymentMethod = data.paymentMethod?.trim() || 'cash';
-  const paymentNote = buildInitialPaymentNote(data);
+  const paymentBreakdown = normalizePaymentBreakdown(data);
+  const paymentNote = paymentMethod === 'mixed' && paymentBreakdown
+    ? buildMixedPaymentNote(paymentBreakdown)
+    : undefined;
 
   return prisma.$transaction(async (tx) => {
 ```

```diff
       expectedPaymentMethod: data.expectedPaymentMethod?.trim() || undefined,
+      paymentBreakdown: paymentBreakdown as Prisma.InputJsonValue | undefined,
       internalNote: data.managerNote?.trim() || undefined,
       orderDate: data.orderDate ? new Date(data.orderDate) : undefined,
 ```

```diff
     if (data.expectedPaymentMethod !== undefined) updateData.expectedPaymentMethod = data.expectedPaymentMethod || null;
+    if (data.paymentBreakdown !== undefined) {
+      updateData.paymentBreakdown = data.paymentBreakdown as Prisma.InputJsonValue;
+    }
 ```
**Почему безопасно:** это additive-нормализация с legacy fallback, поэтому текущие данные не теряются, а новые методы оплаты начинают сохраняться в форме, пригодной для динамического UI.

**Файл:** `src/shared/lib/chapanCatalogDefaults.ts`  
**Что меняем:** убираем привязку mixed-UI к фиксированным form keys и оставляем только реально выбранные методы из каталога.
**Diff:**
```diff
-export type MixedBreakdownField =
-  | 'mixedCash' | 'mixedKaspiQr' | 'mixedKaspiTerminal' | 'mixedTransfer';
-
 export type MixedBreakdownRow = {
-  code:  'cash' | 'kaspi_qr' | 'kaspi_terminal' | 'transfer';
+  value: string;
   label: string;
-  key:   MixedBreakdownField;
 };
-
-const MIXED_FIELD_BY_CODE: Record<MixedBreakdownRow['code'], MixedBreakdownField> = {
-  cash:             'mixedCash',
-  kaspi_qr:         'mixedKaspiQr',
-  kaspi_terminal:   'mixedKaspiTerminal',
-  transfer:         'mixedTransfer',
-};
 
 export function buildMixedBreakdownRows(
   values: string[] | undefined | null,
 ): MixedBreakdownRow[] {
   return buildPaymentMethodOptions(values)
     .filter(opt => opt.value !== 'mixed')
-    .filter((opt): opt is { value: MixedBreakdownRow['code']; label: string } => (
-      opt.value === 'cash' ||
-      opt.value === 'kaspi_qr' ||
-      opt.value === 'kaspi_terminal' ||
-      opt.value === 'transfer'
-    ))
     .map(opt => ({
-      code:  opt.value,
+      value: opt.value,
       label: opt.label,
-      key:   MIXED_FIELD_BY_CODE[opt.value],
     }));
 }
```
**Почему безопасно:** helper остаётся на том же месте, меняется только payload строки, поэтому существующие импорты не ломаются.

**Файл:** `src/entities/order/types.ts`  
**Что меняем:** добавляем новый словарный формат в order/DTO types, не переименовывая существующие экспорты.
**Diff:**
```diff
 export interface ChapanOrder {
   id: string;
   orgId: string;
   orderNumber: string;
   clientId: string;
   clientName: string;
   clientPhone: string;
   status: OrderStatus;
   paymentStatus: PaymentStatus;
   priority: Priority;
   urgency: Urgency;
   isDemandingClient: boolean;
   totalAmount: number;
   paidAmount: number;
   dueDate: string | null;
   streetAddress: string | null;
   city: string | null;
   deliveryType: string | null;
   source: string | null;
   expectedPaymentMethod: string | null;
+  paymentBreakdown?: Record<string, number> | null;
   shippingNote: string | null;
 ```

```diff
 export interface CreateOrderDto {
   clientName: string;
   clientPhone: string;
   clientId?: string;
   priority: Priority;
   urgency?: Urgency;
   isDemandingClient?: boolean;
   orderDate?: string;
   dueDate?: string;
   streetAddress?: string;
   city?: string;
   postalCode?: string;
   deliveryType?: string;
   source?: string;
   expectedPaymentMethod?: string;
   totalAmount?: number;
   orderDiscount?: number;
   deliveryFee?: number;
   bankCommissionPercent?: number;
   bankCommissionAmount?: number;
   prepayment?: number;
   paymentMethod?: 'cash' | 'kaspi_qr' | 'kaspi_terminal' | 'transfer' | 'mixed';
+  paymentBreakdown?: Record<string, number>;
   mixedCash?: number;
   mixedKaspiQr?: number;
   mixedKaspiTerminal?: number;
   mixedTransfer?: number;
 ```

```diff
 export interface UpdateOrderDto {
   clientName?: string;
   clientPhone?: string;
   dueDate?: string | null;
   priority?: Priority;
   urgency?: Urgency;
   isDemandingClient?: boolean;
   city?: string;
   streetAddress?: string;
   postalCode?: string;
   deliveryType?: string;
   source?: string;
   orderDate?: string;
   orderDiscount?: number;
   deliveryFee?: number;
   bankCommissionPercent?: number;
   bankCommissionAmount?: number;
   prepayment?: number;
   paymentMethod?: 'cash' | 'kaspi_qr' | 'kaspi_terminal' | 'transfer' | 'mixed';
   expectedPaymentMethod?: string;
+  paymentBreakdown?: Record<string, number>;
   mixedCash?: number;
   mixedKaspiQr?: number;
   mixedKaspiTerminal?: number;
   mixedTransfer?: number;
 ```
**Почему безопасно:** это additive typing; текущие импорты и вызовы не переименовываются, а новый формат становится доступен без массового перелома кода.

**Файл:** `src/pages/workzone/chapan/orders/ChapanNewOrder.tsx`  
**Что меняем:** переводим create-form с фиксированных mixed-полей на словарь `paymentBreakdown`.
**Diff:**
```diff
 const schema = z
   .object({
     clientName:   z.string().min(2, 'Минимум 2 символа'),
     clientPhone:  z.string()
       .min(1, 'Телефон обязателен')
       .refine((value) => isKazakhPhoneComplete(value), 'Введите номер в формате +7 (777)-777-77-77'),
     city:          z.string().optional(),
     streetAddress: z.string().optional(),
     postalCode:    z.string().optional(),
     deliveryType:  z.string().optional(),
     source:       z.string().optional(),
     urgency:      z.enum(['normal', 'urgent']).default('normal'),
     isDemandingClient: z.boolean().default(false),
     orderDate:    z.string(),
     dueDate:      z.string().optional(),
     orderDiscount: z.coerce.number().min(0).optional(),
     deliveryFee:   z.coerce.number().min(0).optional(),
     bankCommissionPercent: z.coerce.number().min(0).max(100).optional(),
     prepayment:   z.coerce.number().min(0).optional(),
-    paymentMethod: z.enum(['cash', 'kaspi_qr', 'kaspi_terminal', 'transfer', 'mixed']).optional(),
-    mixedCash:          z.coerce.number().min(0).optional(),
-    mixedKaspiQr:       z.coerce.number().min(0).optional(),
-    mixedKaspiTerminal: z.coerce.number().min(0).optional(),
-    mixedTransfer:      z.coerce.number().min(0).optional(),
+    paymentMethod: z.string().optional(),
+    paymentBreakdown: z.record(z.string(), z.coerce.number().min(0)).optional(),
     expectedPaymentMethod: z.string().optional(),
     items:        z.array(itemSchema).min(1, 'Добавьте хотя бы одну позицию'),
     managerNote:  z.string().optional(),
   })
 ```

```diff
     if (data.paymentMethod === 'mixed' && (data.prepayment ?? 0) > 0) {
-      const mixedSum =
-        (Number(data.mixedCash) || 0) +
-        (Number(data.mixedKaspiQr) || 0) +
-        (Number(data.mixedKaspiTerminal) || 0) +
-        (Number(data.mixedTransfer) || 0);
+      const mixedSum = Object.values(data.paymentBreakdown ?? {})
+        .reduce((sum, amount) => sum + (Number(amount) || 0), 0);
       if (mixedSum > 0 && Math.abs(mixedSum - (data.prepayment ?? 0)) > 1) {
-        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Сумма разбивки должна совпадать с предоплатой', path: ['mixedCash'] });
+        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Сумма разбивки должна совпадать с предоплатой', path: ['paymentBreakdown'] });
       }
     }
 ```

```diff
-  const mixedCash          = Number(watch('mixedCash'))          || 0;
-  const mixedKaspiQr       = Number(watch('mixedKaspiQr'))       || 0;
-  const mixedKaspiTerminal = Number(watch('mixedKaspiTerminal')) || 0;
-  const mixedTransfer      = Number(watch('mixedTransfer'))      || 0;
+  const paymentBreakdown   = watch('paymentBreakdown') ?? {};
@@
-  const mixedSum      = mixedCash + mixedKaspiQr + mixedKaspiTerminal + mixedTransfer;
+  const mixedSum      = Object.values(paymentBreakdown).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
 ```

```diff
     const payload = {
       clientName: formatPersonNameInput(data.clientName).trim(),
       clientPhone: formatKazakhPhoneInput(data.clientPhone),
       priority: data.urgency === 'urgent' ? 'urgent' : data.isDemandingClient ? 'vip' : 'normal',
       urgency: data.urgency as Urgency,
       isDemandingClient: data.isDemandingClient,
       dueDate: data.dueDate || undefined,
       city: data.city?.trim() || undefined,
       streetAddress: data.streetAddress?.trim() || undefined,
       postalCode: data.postalCode?.trim() || undefined,
       deliveryType: data.deliveryType?.trim() || undefined,
       source: data.source?.trim() || undefined,
       orderDate: data.orderDate,
       orderDiscount: orderDiscount > 0 ? orderDiscount : undefined,
       deliveryFee:   deliveryFee > 0 ? deliveryFee : undefined,
       bankCommissionPercent: bankCommissionPct > 0 ? bankCommissionPct : undefined,
       bankCommissionAmount:  bankCommissionAmount > 0 ? bankCommissionAmount : undefined,
       prepayment: hasPrepayment ? prepayment : undefined,
       paymentMethod: hasPrepayment ? data.paymentMethod : undefined,
-      mixedCash:          hasPrepayment && isMixed ? (data.mixedCash ?? 0) : undefined,
-      mixedKaspiQr:       hasPrepayment && isMixed ? (data.mixedKaspiQr ?? 0) : undefined,
-      mixedKaspiTerminal: hasPrepayment && isMixed ? (data.mixedKaspiTerminal ?? 0) : undefined,
-      mixedTransfer:      hasPrepayment && isMixed ? (data.mixedTransfer ?? 0) : undefined,
+      paymentBreakdown: hasPrepayment && isMixed
+        ? Object.fromEntries(
+            Object.entries(data.paymentBreakdown ?? {})
+              .filter(([, amount]) => (Number(amount) || 0) > 0),
+          )
+        : undefined,
       expectedPaymentMethod: data.expectedPaymentMethod?.trim() || undefined,
 ```

```diff
             {paymentMethod === 'mixed' && (
               <div className={styles.mixedBreakdown}>
                 <div className={styles.mixedBreakdownTitle}>Разбивка по способам оплаты</div>
                 {mixedBreakdownRows.map((m) => (
-                  <div key={m.key} className={styles.mixedRow}>
+                  <div key={m.value} className={styles.mixedRow}>
                     <span className={styles.mixedLabel}>{m.label}</span>
-                    <Controller control={control} name={m.key} render={({ field }) => (
+                    <Controller control={control} name={`paymentBreakdown.${m.value}` as const} render={({ field }) => (
                       <input
                         type="number" min="0" inputMode="numeric"
                         className={styles.mixedInput}
                         placeholder="0 ₸"
                         value={field.value ?? ''}
 ```
**Почему безопасно:** экран уже строит mixed-UI через каталог методов, поэтому замена касается только form-state и payload, а не остальной структуры формы.

**Файл:** `src/pages/workzone/chapan/orders/ChapanEditOrder.tsx`  
**Что меняем:** переводим edit-form на тот же словарный формат, чтобы create/edit не расходились.
**Diff:**
```diff
 const schema = z.object({
   clientName:  z.string().min(2, 'Минимум 2 символа'),
   clientPhone: z.string()
     .min(1, 'Телефон обязателен')
     .refine((value) => isKazakhPhoneComplete(value), 'Введите номер в формате +7 (777)-777-77-77'),
   dueDate:     z.string().optional(),
   city:         z.string().optional(),
   streetAddress: z.string().optional(),
   postalCode:   z.string().optional(),
   deliveryType: z.string().optional(),
   source:       z.string().optional(),
   orderDate:    z.string().optional(),
   urgency:     z.enum(['normal', 'urgent']).default('normal'),
   isDemandingClient: z.boolean().default(false),
   orderDiscount: z.coerce.number().min(0).optional(),
   deliveryFee:   z.coerce.number().min(0).optional(),
   bankCommissionPercent: z.coerce.number().min(0).max(100).optional(),
   prepayment:   z.coerce.number().min(0).optional(),
-  paymentMethod: z.enum(['cash', 'kaspi_qr', 'kaspi_terminal', 'transfer', 'mixed']).optional(),
+  paymentMethod: z.string().optional(),
   expectedPaymentMethod: z.string().optional(),
-  mixedCash:          z.coerce.number().min(0).optional(),
-  mixedKaspiQr:       z.coerce.number().min(0).optional(),
-  mixedKaspiTerminal: z.coerce.number().min(0).optional(),
-  mixedTransfer:      z.coerce.number().min(0).optional(),
+  paymentBreakdown: z.record(z.string(), z.coerce.number().min(0)).optional(),
   items:       z.array(itemSchema).min(1, 'Добавьте хотя бы одну позицию'),
 }).superRefine((data, ctx) => {
 ```

```diff
-  const mixedCash          = Number(watch('mixedCash'))          || 0;
-  const mixedKaspiQr       = Number(watch('mixedKaspiQr'))       || 0;
-  const mixedKaspiTerminal = Number(watch('mixedKaspiTerminal')) || 0;
-  const mixedTransfer      = Number(watch('mixedTransfer'))      || 0;
+  const paymentBreakdown   = watch('paymentBreakdown') ?? {};
@@
-  const mixedSum              = mixedCash + mixedKaspiQr + mixedKaspiTerminal + mixedTransfer;
+  const mixedSum              = Object.values(paymentBreakdown).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
 ```

```diff
     reset({
       clientName:  formatPersonNameInput(order.clientName),
       clientPhone: formatKazakhPhoneInput(order.clientPhone),
       dueDate:     order.dueDate ? order.dueDate.slice(0, 10) : '',
       urgency:     (order.urgency ?? (order.priority === 'urgent' ? 'urgent' : 'normal')) as Urgency,
       isDemandingClient: order.isDemandingClient ?? (order.priority === 'vip'),
       city:          order.city ?? '',
       streetAddress: order.streetAddress ?? '',
       postalCode:    order.postalCode ?? '',
       deliveryType:  order.deliveryType ?? '',
       source:        order.source ?? '',
       orderDate:     order.orderDate ? order.orderDate.slice(0, 10) : '',
       orderDiscount: order.orderDiscount > 0 ? order.orderDiscount : undefined,
       deliveryFee:   order.deliveryFee   > 0 ? order.deliveryFee   : undefined,
       bankCommissionPercent: order.bankCommissionPercent > 0 ? order.bankCommissionPercent : undefined,
       prepayment:    order.paidAmount   > 0 ? order.paidAmount   : undefined,
       paymentMethod: undefined,
       expectedPaymentMethod: order.expectedPaymentMethod ?? undefined,
-      mixedCash: undefined, mixedKaspiQr: undefined, mixedKaspiTerminal: undefined, mixedTransfer: undefined,
+      paymentBreakdown: order.paymentBreakdown ?? {},
       items: (order.items ?? []).map(item => ({
 ```

```diff
         paymentMethod: prepayment > 0 ? (data.paymentMethod ?? undefined) : undefined,
+        paymentBreakdown: data.paymentMethod === 'mixed'
+          ? Object.fromEntries(
+              Object.entries(data.paymentBreakdown ?? {})
+                .filter(([, amount]) => (Number(amount) || 0) > 0),
+            )
+          : undefined,
         expectedPaymentMethod: data.expectedPaymentMethod?.trim() || undefined,
-        mixedCash:          data.paymentMethod === 'mixed' ? (Number(data.mixedCash) || 0) : undefined,
-        mixedKaspiQr:       data.paymentMethod === 'mixed' ? (Number(data.mixedKaspiQr) || 0) : undefined,
-        mixedKaspiTerminal: data.paymentMethod === 'mixed' ? (Number(data.mixedKaspiTerminal) || 0) : undefined,
-        mixedTransfer:      data.paymentMethod === 'mixed' ? (Number(data.mixedTransfer) || 0) : undefined,
 ```
**Почему безопасно:** edit-flow уже использует тот же каталог методов, поэтому выравнивание с create убирает только технический долг без смены видимого поведения.

### [F3] Конфигурируемая автосумма доставки

**Файл:** `server/prisma/schema.prisma`  
**Что меняем:** добавляем в профиль мастерской три конфигурируемых тарифа вместо локального UI-map.
**Diff:**
```diff
 model ChapanProfile {
   id                      String  @id @default(cuid())
   orgId                   String  @unique @map("org_id")
   displayName             String  @default("Чапан") @map("display_name")
   descriptor              String  @default("")
   orderPrefix             String  @default("ЧП") @map("order_prefix")
   orderCounter            Int     @default(0) @map("order_counter")
   invoiceCounter          Int     @default(0) @map("invoice_counter")
   requestCounter          Int     @default(0) @map("request_counter")
   publicIntakeTitle       String  @default("Оставьте заявку на пошив") @map("public_intake_title")
   publicIntakeDescription String  @default("") @map("public_intake_description")
   publicIntakeEnabled     Boolean @default(true) @map("public_intake_enabled")
   supportLabel            String  @default("") @map("support_label")
+  kazpostDeliveryFee      Float   @default(2000) @map("kazpost_delivery_fee")
+  railDeliveryFee         Float   @default(3000) @map("rail_delivery_fee")
+  airDeliveryFee          Float   @default(5000) @map("air_delivery_fee")
 
   org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
 ```
**Почему безопасно:** поля additive и полностью повторяют уже существующие дефолты, так что старое поведение сохраняется до первой ручной настройки.

**Файл:** `server/src/modules/chapan/settings.service.ts`  
**Что меняем:** начинаем читать и сохранять delivery-тарифы через профиль.
**Diff:**
```diff
 export async function getProfile(orgId: string) {
   const profile = await prisma.chapanProfile.findUnique({ where: { orgId } });
   if (!profile) throw new NotFoundError('ChapanProfile');
 
   return {
     displayName: profile.displayName,
     descriptor: profile.descriptor,
     orderPrefix: profile.orderPrefix,
     publicIntakeTitle: profile.publicIntakeTitle,
     publicIntakeDescription: profile.publicIntakeDescription,
     publicIntakeEnabled: profile.publicIntakeEnabled,
     supportLabel: profile.supportLabel,
+    kazpostDeliveryFee: profile.kazpostDeliveryFee,
+    railDeliveryFee: profile.railDeliveryFee,
+    airDeliveryFee: profile.airDeliveryFee,
   };
 }
```

```diff
 export async function updateProfile(orgId: string, data: Record<string, unknown>) {
   const profile = await prisma.chapanProfile.upsert({
     where: { orgId },
     create: {
       orgId,
       displayName: data.displayName as string | undefined,
       descriptor: data.descriptor as string | undefined,
       orderPrefix: data.orderPrefix as string | undefined,
       publicIntakeTitle: data.publicIntakeTitle as string | undefined,
       publicIntakeDescription: data.publicIntakeDescription as string | undefined,
       publicIntakeEnabled: data.publicIntakeEnabled as boolean | undefined,
       supportLabel: data.supportLabel as string | undefined,
+      kazpostDeliveryFee: data.kazpostDeliveryFee as number | undefined,
+      railDeliveryFee: data.railDeliveryFee as number | undefined,
+      airDeliveryFee: data.airDeliveryFee as number | undefined,
     },
     update: {
       displayName: data.displayName as string | undefined,
       descriptor: data.descriptor as string | undefined,
       orderPrefix: data.orderPrefix as string | undefined,
       publicIntakeTitle: data.publicIntakeTitle as string | undefined,
       publicIntakeDescription: data.publicIntakeDescription as string | undefined,
       publicIntakeEnabled: data.publicIntakeEnabled as boolean | undefined,
       supportLabel: data.supportLabel as string | undefined,
+      kazpostDeliveryFee: data.kazpostDeliveryFee as number | undefined,
+      railDeliveryFee: data.railDeliveryFee as number | undefined,
+      airDeliveryFee: data.airDeliveryFee as number | undefined,
     },
   });
 ```
**Почему безопасно:** сервис уже отвечает за профиль, поэтому изменение остаётся в существующем контуре без нового endpoint.

**Файл:** `src/entities/order/types.ts`  
**Что меняем:** расширяем `ChapanProfile`, чтобы формы и настройки читали реальные тарифы из API.
**Diff:**
```diff
 export interface ChapanProfile {
   displayName: string | null;
   descriptor: string | null;
   orderPrefix: string | null;
   publicIntakeTitle: string | null;
   publicIntakeDescription: string | null;
   publicIntakeEnabled: boolean;
   supportLabel: string | null;
+  kazpostDeliveryFee: number;
+  railDeliveryFee: number;
+  airDeliveryFee: number;
 }
```
**Почему безопасно:** это additive typing без переименования экспортов и без изменения текущих query hooks.

**Файл:** `src/pages/workzone/chapan/settings/ChapanSettings.tsx`  
**Что меняем:** добавляем три поля в профиль мастерской, чтобы тарифы редактировались из UI, а не из кода.
**Diff:**
```diff
 function ProfileTab() {
   const { data: profile, isLoading } = useChapanProfile();
   const saveProfile = useSaveProfile();
-  const [form, setForm] = useState<{ displayName: string; orderPrefix: string; publicIntakeEnabled: boolean } | null>(null);
+  const [form, setForm] = useState<{
+    displayName: string;
+    orderPrefix: string;
+    publicIntakeEnabled: boolean;
+    kazpostDeliveryFee: number;
+    railDeliveryFee: number;
+    airDeliveryFee: number;
+  } | null>(null);
 
   const current = form ?? {
     displayName: profile?.displayName ?? '',
     orderPrefix: profile?.orderPrefix ?? 'ЧП',
     publicIntakeEnabled: profile?.publicIntakeEnabled ?? false,
+    kazpostDeliveryFee: profile?.kazpostDeliveryFee ?? 2000,
+    railDeliveryFee: profile?.railDeliveryFee ?? 3000,
+    airDeliveryFee: profile?.airDeliveryFee ?? 5000,
   };
 ```

```diff
         <label className={styles.profileCheckbox}>
           <input
             type="checkbox"
             checked={current.publicIntakeEnabled}
             onChange={e => setForm({ ...current, publicIntakeEnabled: e.target.checked })}
           />
           <span>Включить публичную форму заявок</span>
         </label>
+        <div className={styles.profileField}>
+          <label className={styles.profileLabel}>Казпочта (₸)</label>
+          <input
+            type="number"
+            min={0}
+            className={styles.profileInput}
+            value={current.kazpostDeliveryFee}
+            onChange={e => setForm({ ...current, kazpostDeliveryFee: Number(e.target.value) || 0 })}
+          />
+        </div>
+        <div className={styles.profileField}>
+          <label className={styles.profileLabel}>Жд (₸)</label>
+          <input
+            type="number"
+            min={0}
+            className={styles.profileInput}
+            value={current.railDeliveryFee}
+            onChange={e => setForm({ ...current, railDeliveryFee: Number(e.target.value) || 0 })}
+          />
+        </div>
+        <div className={styles.profileField}>
+          <label className={styles.profileLabel}>Авиа (₸)</label>
+          <input
+            type="number"
+            min={0}
+            className={styles.profileInput}
+            value={current.airDeliveryFee}
+            onChange={e => setForm({ ...current, airDeliveryFee: Number(e.target.value) || 0 })}
+          />
+        </div>
         <button
           className={styles.profileSaveBtn}
           onClick={handleSave}
           disabled={saveProfile.isPending}
         >
 ```
**Почему безопасно:** UI расширяется внутри уже существующего `ProfileTab`, без новых сущностей и без изменения маршрутов.

**Файл:** `src/pages/workzone/chapan/orders/ChapanNewOrder.tsx`  
**Что меняем:** убираем локальную карту доставки и читаем тарифы из профиля мастерской.
**Diff:**
```diff
-import { useCreateOrder, useChapanCatalogs } from '../../../../entities/order/queries';
+import { useCreateOrder, useChapanCatalogs, useChapanProfile } from '../../../../entities/order/queries';
@@
-const DELIVERY_FEE_MAP: Record<string, number> = {
-  'Казпочта': 2000,
-  'Жд': 3000,
-  'Авиа': 5000,
-};
-
 const CITIES   = ['Алматы', 'Астана', 'Шымкент', 'Атырау', 'Актобе', 'Тараз', 'Павлодар', 'Другой город'];
 ```

```diff
 export default function ChapanNewOrderPage() {
   const navigate    = useNavigate();
   const createOrder = useCreateOrder();
   const { data: catalogs } = useChapanCatalogs();
+  const { data: profile } = useChapanProfile();
@@
+  const deliveryFeeMap: Record<string, number> = {
+    'Казпочта': profile?.kazpostDeliveryFee ?? 2000,
+    'Жд': profile?.railDeliveryFee ?? 3000,
+    'Авиа': profile?.airDeliveryFee ?? 5000,
+  };
+
   const deliveryType          = watch('deliveryType');
 
   useEffect(() => {
-    const autoFee = DELIVERY_FEE_MAP[deliveryType ?? ''];
+    const autoFee = deliveryFeeMap[deliveryType ?? ''];
     if (autoFee !== undefined) {
       setValue('deliveryFee', autoFee);
     }
-  }, [deliveryType, setValue]);
+  }, [deliveryType, deliveryFeeMap, setValue]);
 ```
**Почему безопасно:** поведение формы не меняется для старых значений, но источник правил переезжает из жёсткого UI-map в сохранённые настройки.

**Файл:** `src/pages/workzone/chapan/orders/ChapanEditOrder.tsx`  
**Что меняем:** используем тот же профильный источник тарифов и в edit-flow, чтобы create/edit не расходились.
**Diff:**
```diff
-import { useOrder, useUpdateOrder, useChapanCatalogs, useRequestItemChange } from '../../../../entities/order/queries';
+import { useOrder, useUpdateOrder, useChapanCatalogs, useChapanProfile, useRequestItemChange } from '../../../../entities/order/queries';
@@
-const DELIVERY_FEE_MAP: Record<string, number> = {
-  'Казпочта': 2000,
-  'Жд': 3000,
-  'Авиа': 5000,
-};
-
 const DELIVERY = ['Самовывоз', 'Курьер по городу', 'Казпочта', 'СДЭК', 'Другое'];
 ```

```diff
 export default function ChapanEditOrderPage() {
   const { id } = useParams<{ id: string }>();
   const navigate = useNavigate();
 
   const { data: order, isLoading, isError } = useOrder(id!);
   const updateOrder = useUpdateOrder();
   const requestItemChange = useRequestItemChange();
   const { data: catalogs } = useChapanCatalogs();
+  const { data: profile } = useChapanProfile();
@@
+  const deliveryFeeMap: Record<string, number> = {
+    'Казпочта': profile?.kazpostDeliveryFee ?? 2000,
+    'Жд': profile?.railDeliveryFee ?? 3000,
+    'Авиа': profile?.airDeliveryFee ?? 5000,
+  };
+
   useEffect(() => {
-    const autoFee = DELIVERY_FEE_MAP[deliveryType ?? ''];
+    const autoFee = deliveryFeeMap[deliveryType ?? ''];
     if (autoFee !== undefined) setValue('deliveryFee', autoFee);
-  }, [deliveryType, setValue]);
+  }, [deliveryType, deliveryFeeMap, setValue]);
 ```
**Почему безопасно:** edit-form получает тот же источник данных, что и create-form, без изменений расчётного пайплайна.

| Пункт TO_DO | Статус после патча | Риск | Причина риска (если есть) |
|---|---|---|---|
| `C2` | ✅ Закрыт | Средний | Нужны Prisma migration и аккуратный переход с legacy mixed-полей на `paymentBreakdown`, но патч остаётся additive |
| `F3` | ✅ Закрыт | Низкий | Добавляются только новые profile-поля и чтение их в двух формах; поведение по умолчанию сохраняется |
