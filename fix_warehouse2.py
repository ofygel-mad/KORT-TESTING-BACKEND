with open('src/pages/warehouse/index.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# The OrderDetailDrawer section uses LF (not CRLF)
old1 = ('function OrderDetailDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {\n'
        '  const { data: order, isLoading } = useOrder(orderId);\n'
        '  const shipOrder = useShipOrder();')
new1 = ('function OrderDetailDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {\n'
        '  const { data: order, isLoading } = useOrder(orderId);\n'
        '  const shipOrder = useShipOrder();\n'
        '  const closeOrder = useCloseOrder();\n'
        '  const [closeUnpaidWarning, setCloseUnpaidWarning] = useState(false);')

if old1 in content:
    content = content.replace(old1, new1)
    print('drawer header replaced')
else:
    print('drawer header NOT found')

old_footer = (
    "            <div className={styles.drawerFooter}>\n"
    "              {order.paymentStatus === 'paid' ? (\n"
    "                <button\n"
    "                  className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`}\n"
    "                  onClick={() => { shipOrder.mutate(order.id); onClose(); }}\n"
    "                  disabled={shipOrder.isPending}\n"
    "                >\n"
    "                  <Send size={16} />\n"
)

new_footer = (
    "            <div className={styles.drawerFooter}>\n"
    "              {order.status === 'shipped' ? (\n"
    "                <>\n"
    "                  <button\n"
    "                    className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`}\n"
    "                    onClick={() => {\n"
    "                      if (order.paymentStatus !== 'paid') setCloseUnpaidWarning(true);\n"
    "                      else { closeOrder.mutate(order.id); onClose(); }\n"
    "                    }}\n"
    "                    disabled={closeOrder.isPending}\n"
    "                  >\n"
    "                    <CheckSquare size={16} />\n"
    "                    {closeOrder.isPending ? '\u0417\u0430\u043a\u0440\u044b\u0442\u0438\u0435...' : '\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0441\u0434\u0435\u043b\u043a\u0443'}\n"
    "                  </button>\n"
    "                  {closeUnpaidWarning && (\n"
    "                    <div className={styles.drawerUnpaidNote}>\n"
    "                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>\n"
    "                        <AlertTriangle size={15} style={{ flexShrink: 0 }} />\n"
    "                        <strong>\u041e\u0441\u0442\u0430\u0442\u043e\u043a: {fmtMoney(order.totalAmount - order.paidAmount)}</strong>\n"
    "                      </div>\n"
    "                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>\n"
    "                        <button className={styles.drawerActionBtn} style={{ flex: 1, fontSize: 12 }} onClick={() => setCloseUnpaidWarning(false)}>\u041e\u0442\u043c\u0435\u043d\u0430</button>\n"
    "                        <button className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`} style={{ flex: 1, fontSize: 12 }} onClick={() => { closeOrder.mutate(order.id); onClose(); }}>\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0432\u0441\u0451 \u0440\u0430\u0432\u043d\u043e</button>\n"
    "                      </div>\n"
    "                    </div>\n"
    "                  )}\n"
    "                </>\n"
    "              ) : order.paymentStatus === 'paid' ? (\n"
    "                <button\n"
    "                  className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`}\n"
    "                  onClick={() => { shipOrder.mutate(order.id); onClose(); }}\n"
    "                  disabled={shipOrder.isPending}\n"
    "                >\n"
    "                  <Send size={16} />\n"
)

if old_footer in content:
    content = content.replace(old_footer, new_footer)
    print('footer replaced')
else:
    print('footer NOT found')
    # debug: show exact chars
    idx = content.find("drawerFooter}\n")
    if idx < 0:
        idx = content.find("drawerFooter}>")
    print("Near drawerFooter:", repr(content[idx:idx+200]))

with open('src/pages/warehouse/index.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('closeOrder in content:', 'closeOrder' in content)
print("shipped status check:", "order.status === 'shipped'" in content)
