import { useState } from 'react';
import { Plus, Download, BookOpen, BarChart3, X } from 'lucide-react';
import { useViewportProfile } from '../../shared/hooks/useViewportProfile';
import { useFinanceEntries, useFinanceSummary, useCreateEntry } from '../../entities/finance/queries';
import type { EntryType, CreateEntryDto } from '../../entities/finance/types';
import { ENTRY_TYPE_LABEL, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../../entities/finance/types';
import { Skeleton } from '../../shared/ui/Skeleton';
import { exportToCSV } from '../../shared/lib/export';
import styles from './Finance.module.css';

type Tab = 'journal' | 'summary';

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtMoney(n: number) {
  return new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸';
}
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const TYPE_COLOR: Record<string, string> = {
  income: 'var(--fill-positive)',
  expense: 'var(--fill-negative)',
  transfer: 'var(--fill-info)',
  adjustment: 'var(--fill-warning)',
  write_off: 'var(--fill-negative)',
  return: 'var(--fill-positive)',
};

// ── Add Entry Drawer ───────────────────────────────────────────────────────────

function AddEntryDrawer({ onClose }: { onClose: () => void }) {
  const createEntry = useCreateEntry();
  const [form, setForm] = useState<CreateEntryDto & { _type: 'income' | 'expense' }>({
    _type: 'income', type: 'income', amount: 0, category: '', account: 'Основной счёт',
  });

  const categories = form._type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function setType(t: 'income' | 'expense') {
    setForm(f => ({ ...f, _type: t, type: t as EntryType, category: '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || !form.category.trim()) return;
    const { _type, ...dto } = form;
    await createEntry.mutateAsync({ ...dto, amount: Number(form.amount) });
    onClose();
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Новая запись</span>
          <button className={styles.drawerClose} onClick={onClose}><X size={14} /></button>
        </div>
        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Тип</label>
            <div className={styles.typeGroup}>
              <button type="button"
                className={`${styles.typeBtn} ${form._type === 'income' ? styles.typeBtnIncome : ''}`}
                onClick={() => setType('income')}>Доход</button>
              <button type="button"
                className={`${styles.typeBtn} ${form._type === 'expense' ? styles.typeBtnExpense : ''}`}
                onClick={() => setType('expense')}>Расход</button>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Сумма (₸) <span className={styles.req}>*</span></label>
            <input className={styles.input} type="number" min="0.01" step="any"
              value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              onFocus={(e) => e.target.select()}
              placeholder="0" required autoFocus />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Категория <span className={styles.req}>*</span></label>
            <select className={styles.select} value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required>
              <option value="">Выберите категорию</option>
              {categories.map(c => <option key={c}>{c}</option>)}
              <option value="__other">Другое</option>
            </select>
          </div>
          {form.category === '__other' && (
            <div className={styles.field}>
              <label className={styles.label}>Своя категория</label>
              <input className={styles.input} value={form.category === '__other' ? '' : form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="Введите категорию" />
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.label}>Счёт</label>
            <input className={styles.input} value={form.account}
              onChange={e => setForm(f => ({ ...f, account: e.target.value }))} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Контрагент</label>
            <input className={styles.input} value={form.counterparty ?? ''}
              onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))}
              placeholder="ИП Иванов, ТОО Ромашка..." />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Комментарий</label>
            <input className={styles.input} value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Необязательно..." />
          </div>
          <div className={styles.drawerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={createEntry.isPending}>
              {createEntry.isPending ? 'Запись...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { isPhone } = useViewportProfile();
  const [tab, setTab] = useState<Tab>('journal');
  const [filterType, setFilterType] = useState('');
  const [period, setPeriod] = useState(currentPeriod());
  const [addOpen, setAddOpen] = useState(false);

  const { data: entriesData, isLoading: entriesLoading } = useFinanceEntries({
    type: filterType || undefined,
    period: period || undefined,
    limit: 200,
  });
  const { data: summary, isLoading: summaryLoading } = useFinanceSummary({ period });

  const entries = entriesData?.results ?? [];

  function handleExport() {
    exportToCSV(entries.map(e => ({
      'Дата': fmtDate(e.createdAt),
      'Тип': ENTRY_TYPE_LABEL[e.type],
      'Сумма': e.amount,
      'Категория': e.category,
      'Счёт': e.account,
      'Контрагент': e.counterparty ?? '',
      'Источник': e.sourceLabel ?? '',
      'Комментарий': e.notes ?? '',
    })), `финансы_${period}.csv`);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Финансы</h1>
        <div className={styles.headerRight}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === 'journal' ? styles.tabActive : ''}`} onClick={() => setTab('journal')}>
              <BookOpen size={13} /> Журнал
            </button>
            <button className={`${styles.tab} ${tab === 'summary' ? styles.tabActive : ''}`} onClick={() => setTab('summary')}>
              <BarChart3 size={13} /> Итоги
            </button>
          </div>
        </div>
      </div>

      {/* Period + filter toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label className={styles.toolbarLabel}>Период</label>
          <input type="month" className={styles.monthInput} value={period}
            onChange={e => setPeriod(e.target.value)} />
        </div>
        {tab === 'journal' && (
          <div className={styles.field}>
            <label className={styles.toolbarLabel}>Тип</label>
            <select className={styles.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">Все</option>
              <option value="income">Доходы</option>
              <option value="expense">Расходы</option>
            </select>
          </div>
        )}
        <div className={styles.toolbarSpacer} />
        {tab === 'journal' && (
          <button className={styles.exportBtn} onClick={handleExport}><Download size={13} /> Excel</button>
        )}
        <button className={styles.addBtn} onClick={() => setAddOpen(true)}><Plus size={14} /> Записать</button>
      </div>

      {/* ── Journal ── */}
      {tab === 'journal' && (
        <div className={isPhone ? undefined : styles.tableWrap}>
          {entriesLoading ? (
            <div className={styles.skeletons}>{[...Array(8)].map((_,i) => <Skeleton key={i} height={48} radius={8} />)}</div>
          ) : isPhone ? (
            <div className={styles.mobileList}>
              {entries.map(e => {
                const isIncome = e.type === 'income' || e.type === 'return';
                return (
                  <div key={e.id} className={styles.mobileCard}>
                    <div className={styles.mobileCardHead}>
                      <span className={styles.mobileCardCategory}>{e.category}</span>
                      <span className={styles.mobileCardAmount} style={{ color: isIncome ? 'var(--fill-positive)' : 'var(--fill-negative)' }}>
                        {isIncome ? '+' : '−'}{fmtMoney(e.amount)}
                      </span>
                    </div>
                    <div className={styles.mobileCardMeta}>
                      <span className={styles.typeBadge} style={{ color: TYPE_COLOR[e.type], background: `${TYPE_COLOR[e.type]}18` }}>
                        {ENTRY_TYPE_LABEL[e.type]}
                      </span>
                      {e.counterparty && <span>{e.counterparty}</span>}
                      <span className={styles.mobileCardDate}>{fmtDate(e.createdAt)}</span>
                    </div>
                    {e.notes && <div className={styles.mobileCardNotes}>{e.notes}</div>}
                  </div>
                );
              })}
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr><th>Дата</th><th>Тип</th><th>Сумма</th><th>Категория</th><th>Счёт</th><th>Контрагент</th><th>Источник</th></tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const isIncome = e.type === 'income' || e.type === 'return';
                  return (
                    <tr key={e.id} className={styles.row}>
                      <td className={styles.tdDate}>{fmtDate(e.createdAt)}</td>
                      <td>
                        <span className={styles.typeBadge} style={{ color: TYPE_COLOR[e.type], background: `${TYPE_COLOR[e.type]}18` }}>
                          {ENTRY_TYPE_LABEL[e.type]}
                        </span>
                      </td>
                      <td className={styles.tdAmount} style={{ color: isIncome ? 'var(--fill-positive)' : 'var(--fill-negative)' }}>
                        {isIncome ? '+' : '−'}{fmtMoney(e.amount)}
                      </td>
                      <td className={styles.tdPrimary}>{e.category}</td>
                      <td className={styles.tdSecondary}>{e.account}</td>
                      <td className={styles.tdSecondary}>{e.counterparty ?? '—'}</td>
                      <td className={styles.tdSource}>{e.sourceLabel ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!entriesLoading && entries.length === 0 && (
            <div className={styles.empty}>
              <BookOpen size={32} className={styles.emptyIcon} />
              <p>Записей за этот период нет</p>
              <button className={styles.emptyBtn} onClick={() => setAddOpen(true)}>Добавить первую запись</button>
            </div>
          )}
        </div>
      )}

      {/* ── Summary ── */}
      {tab === 'summary' && (
        <div className={styles.summaryWrap}>
          {summaryLoading ? (
            <div className={styles.skeletons}>{[...Array(3)].map((_,i) => <Skeleton key={i} height={80} radius={10} />)}</div>
          ) : summary ? (
            <>
              <div className={styles.summaryCards}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryCardLabel}>Доходы</div>
                  <div className={styles.summaryCardValue} style={{ color: 'var(--fill-positive)' }}>
                    {fmtMoney(summary.income ?? 0)}
                  </div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryCardLabel}>Расходы</div>
                  <div className={styles.summaryCardValue} style={{ color: 'var(--fill-negative)' }}>
                    {fmtMoney(summary.expense ?? 0)}
                  </div>
                </div>
                <div className={styles.summaryCard} data-highlight="true">
                  <div className={styles.summaryCardLabel}>Прибыль</div>
                  <div className={styles.summaryCardValue}
                    style={{ color: (summary.balance ?? 0) >= 0 ? 'var(--fill-positive)' : 'var(--fill-negative)' }}>
                    {fmtMoney(summary.balance ?? 0)}
                  </div>
                </div>
              </div>

              {summary.byCategory && Object.keys(summary.byCategory).length > 0 && (
                <div className={styles.byCatSection}>
                  <div className={styles.byCatTitle}>Разбивка по категориям</div>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>Категория</th><th style={{ textAlign: 'right' }}>Сумма</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(summary.byCategory)
                        .sort(([,a],[,b]) => Math.abs(b) - Math.abs(a))
                        .map(([cat, amt]) => (
                          <tr key={cat} className={styles.row}>
                            <td className={styles.tdPrimary}>{cat}</td>
                            <td style={{ textAlign: 'right', color: amt >= 0 ? 'var(--fill-positive)' : 'var(--fill-negative)', fontWeight: 500 }}>
                              {amt >= 0 ? '+' : ''}{fmtMoney(amt)}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className={styles.empty}><p>Нет данных за период</p></div>
          )}
        </div>
      )}

      {addOpen && <AddEntryDrawer onClose={() => setAddOpen(false)} />}
    </div>
  );
}
