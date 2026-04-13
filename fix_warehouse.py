with open('src/pages/warehouse/index.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# 1. Add closeOrder and useState to OrderDetailDrawer
old1 = 'function OrderDetailDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {\r\n  const { data: order, isLoading } = useOrder(orderId);\r\n  const shipOrder = useShipOrder();'
new1 = 'function OrderDetailDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {\r\n  const { data: order, isLoading } = useOrder(orderId);\r\n  const shipOrder = useShipOrder();\r\n  const closeOrder = useCloseOrder();\r\n  const [closeUnpaidWarning, setCloseUnpaidWarning] = useState(false);'
content = content.replace(old1, new1)

# 2. Replace footer - find exact text
import re

old_footer = (
    '            <div className={styles.drawerFooter}>\r\n'
    '              {order.paymentStatus === \'paid\' ? (\r\n'
    '                <button\r\n'
    '                  className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`}\r\n'
    '                  onClick={() => { shipOrder.mutate(order.id); onClose(); }}\r\n'
    '                  disabled={shipOrder.isPending}\r\n'
    '                >\r\n'
    '                  <Send size={16} />\r\n'
    '                  {shipOrder.isPending ? \'Отправка...\' : \'Отправить клиенту\'}\r\n'
    '                </button>\r\n'
    '              ) : (\r\n'
    '                <div className={styles.drawerUnpaidNote}>\r\n'
    '                  <div style={{ display: \'flex\', alignItems: \'center\', gap: 8 }}>\r\n'
    '                    <AlertTriangle size={15} style={{ flexShrink: 0 }} />\r\n'
    '                    <strong>Заказ не оплачен</strong>\r\n'
    '                  </div>\r\n'
    '                  <div style={{ marginTop: 4, paddingLeft: 23 }}>\r\n'
    '                    Остаток: {fmtMoney(order.totalAmount - order.paidAmount)} — свяжитесь с менеджером\r\n'
    '                  </div>\r\n'
    '                </div>\r\n'
    '              )}\r\n'
    '            </div>'
)

new_footer = (
    '            <div className={styles.drawerFooter}>\r\n'
    '              {order.status === \'shipped\' ? (\r\n'
    '                <>\r\n'
    '                  <button\r\n'
    '                    className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`}\r\n'
    '                    onClick={() => {\r\n'
    '                      if (order.paymentStatus !== \'paid\') setCloseUnpaidWarning(true);\r\n'
    '                      else { closeOrder.mutate(order.id); onClose(); }\r\n'
    '                    }}\r\n'
    '                    disabled={closeOrder.isPending}\r\n'
    '                  >\r\n'
    '                    <CheckSquare size={16} />\r\n'
    '                    {closeOrder.isPending ? \'Закрытие...\' : \'Завершить сделку\'}\r\n'
    '                  </button>\r\n'
    '                  {closeUnpaidWarning && (\r\n'
    '                    <div className={styles.drawerUnpaidNote}>\r\n'
    '                      <div style={{ display: \'flex\', alignItems: \'center\', gap: 8 }}>\r\n'
    '                        <AlertTriangle size={15} style={{ flexShrink: 0 }} />\r\n'
    '                        <strong>Остаток: {fmtMoney(order.totalAmount - order.paidAmount)}</strong>\r\n'
    '                      </div>\r\n'
    '                      <div style={{ display: \'flex\', gap: 8, marginTop: 8 }}>\r\n'
    '                        <button className={styles.drawerActionBtn} style={{ flex: 1, fontSize: 12 }} onClick={() => setCloseUnpaidWarning(false)}>Отмена</button>\r\n'
    '                        <button className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`} style={{ flex: 1, fontSize: 12 }} onClick={() => { closeOrder.mutate(order.id); onClose(); }}>Закрыть всё равно</button>\r\n'
    '                      </div>\r\n'
    '                    </div>\r\n'
    '                  )}\r\n'
    '                </>\r\n'
    '              ) : order.paymentStatus === \'paid\' ? (\r\n'
    '                <button\r\n'
    '                  className={`${styles.drawerActionBtn} ${styles.drawerActionBtnSuccess}`}\r\n'
    '                  onClick={() => { shipOrder.mutate(order.id); onClose(); }}\r\n'
    '                  disabled={shipOrder.isPending}\r\n'
    '                >\r\n'
    '                  <Send size={16} />\r\n'
    '                  {shipOrder.isPending ? \'Отправка...\' : \'Отправить клиенту\'}\r\n'
    '                </button>\r\n'
    '              ) : (\r\n'
    '                <div className={styles.drawerUnpaidNote}>\r\n'
    '                  <div style={{ display: \'flex\', alignItems: \'center\', gap: 8 }}>\r\n'
    '                    <AlertTriangle size={15} style={{ flexShrink: 0 }} />\r\n'
    '                    <strong>Заказ не оплачен</strong>\r\n'
    '                  </div>\r\n'
    '                  <div style={{ marginTop: 4, paddingLeft: 23 }}>\r\n'
    '                    Остаток: {fmtMoney(order.totalAmount - order.paidAmount)} — свяжитесь с менеджером\r\n'
    '                  </div>\r\n'
    '                </div>\r\n'
    '              )}\r\n'
    '            </div>'
)

if old_footer in content:
    content = content.replace(old_footer, new_footer)
    print('footer replaced')
else:
    print('footer NOT FOUND, looking for it...')
    idx = content.find("drawerFooter")
    print('drawerFooter positions:', [i for i in range(len(content)) if content[i:i+12] == 'drawerFooter'])

with open('src/pages/warehouse/index.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('closeOrder in content:', 'closeOrder' in content)
print("order.status === 'shipped' in content:", "order.status === 'shipped'" in content)
