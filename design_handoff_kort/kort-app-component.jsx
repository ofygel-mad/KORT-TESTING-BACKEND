
// ── App Shell Component ───────────────────────────────────────────────────────
// Exports: window.KortAppShell

const { useState: useStateApp } = React;

const NAV_ITEMS = [
  { id: 'home', label: 'Главная', path: '/', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'sep0', sep: true },
  { id: 'sec-crm', label: 'CRM', section: true },
  { id: 'leads', label: 'Лиды', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id: 'deals', label: 'Сделки', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
  { id: 'customers', label: 'Клиенты', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { id: 'tasks', label: 'Задачи', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { id: 'sep1', sep: true },
  { id: 'sec-ops', label: 'Операции', section: true },
  { id: 'warehouse', label: 'Склад', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> },
  { id: 'finance', label: 'Финансы', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
  { id: 'reports', label: 'Отчёты', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
];

const RECENT_DEALS = [
  { id: 1, name: 'ТОО «Алатау Групп»', stage: 'Переговоры', amount: '₸ 1.4М', status: 'prog', manager: 'А.Б.' },
  { id: 2, name: 'ИП Серикбаев М.', stage: 'Новый лид', amount: '₸ 280К', status: 'new', manager: 'Д.К.' },
  { id: 3, name: 'АО «Казцемент»', stage: 'Сделка закрыта', amount: '₸ 8.2М', status: 'won', manager: 'А.Б.' },
  { id: 4, name: 'ТОО «СтройМаш»', stage: 'Коммерческое предложение', amount: '₸ 560К', status: 'prog', manager: 'Н.О.' },
  { id: 5, name: 'ИП Джаксыбеков', stage: 'Отказ', amount: '₸ 120К', status: 'lost', manager: 'Д.К.' },
];

const ACTIVITY = [
  { color: '#5C8DFF', text: <><strong>Новый лид</strong> добавлен — ТОО «Строй Плюс»</>, time: '3 мин назад' },
  { color: '#10B981', text: <><strong>Сделка закрыта</strong> — АО «Казцемент» на ₸8.2М</>, time: '42 мин назад' },
  { color: '#F59E0B', text: <><strong>Задача просрочена</strong> — Коммерческое предложение СтройМаш</>, time: '1 ч назад' },
  { color: '#4A8BD4', text: <><strong>Поступление на склад</strong> — 240 позиций из Алматы</>, time: '2 ч назад' },
  { color: '#8A9AB8', text: <><strong>Новый сотрудник</strong> добавлен — Нурлан Оспанов</>, time: '3 ч назад' },
];

const BADGE_CLASS = { new: 'badge-new', prog: 'badge-prog', won: 'badge-won', lost: 'badge-lost' };
const BADGE_LABEL = { new: 'Новый', prog: 'В работе', won: 'Закрыт', lost: 'Отказ' };

function Sidebar({ active, setActive, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sb-logo">
        <div className="sb-mark">K</div>
        <span className="sb-name">KORT</span>
      </div>
      <nav className="sb-nav">
        {NAV_ITEMS.map(item => {
          if (item.sep) return <div key={item.id} style={{ height: 1, background: 'var(--border-s)', margin: '4px 0' }} />;
          if (item.section) return (
            <div key={item.id} className="sb-section-label">{item.label}</div>
          );
          return (
            <button key={item.id} className={`sb-item${active === item.id ? ' active' : ''}`}
              onClick={() => setActive(item.id)}>
              <span className="sb-icon">{item.icon}</span>
              <span className="sb-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sb-bottom">
        <button className="sb-item" onClick={() => setActive('settings')}>
          <span className="sb-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </span>
          <span className="sb-label">Настройки</span>
        </button>
        <button className="sb-logout" onClick={onLogout}>
          <span className="sb-icon" style={{ color: 'inherit' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </span>
          <span className="sb-label">Выйти</span>
        </button>
      </div>
    </aside>
  );
}

function Topbar({ page }) {
  const PAGE_NAMES = { home: 'Главная', leads: 'Лиды', deals: 'Сделки', customers: 'Клиенты', tasks: 'Задачи', warehouse: 'Склад', finance: 'Финансы', reports: 'Отчёты', settings: 'Настройки' };
  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-crumb">{PAGE_NAMES[page] || 'KORT'}</span>
      </div>
      <div className="topbar-right">
        <button className="tb-search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span>Поиск</span>
          <kbd className="tb-kbd">⌘K</kbd>
        </button>
        <button className="tb-icon-btn" aria-label="Уведомления">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </button>
        <button className="tb-icon-btn" aria-label="Тема">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        </button>
        <div className="tb-avatar" title="Адиль Бекенов">АБ</div>
      </div>
    </header>
  );
}

function Dashboard({ onNav }) {
  const kpis = [
    { label: 'Выручка', value: '₸ 14.8М', delta: '+18%', dir: 'pos', color: '#2E6AB5',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
    { label: 'Сделки', value: '47', delta: '+6', dir: 'pos', color: '#4A8BD4',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
    { label: 'Клиенты', value: '284', delta: '+12', dir: 'pos', color: '#5C8DFF',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { label: 'Задачи', value: '23', delta: '-4', dir: 'neg', color: '#EF4444',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  ];
  return (
    <div className="dash">
      {/* Header */}
      <div className="dash-header">
        <div>
          <div className="dash-title">Добро пожаловать, Адиль</div>
          <div className="dash-subtitle">Вторник, 22 апреля 2025 · KORT готов к работе</div>
        </div>
        <div className="dash-header-actions">
          <button className="dash-action-btn" onClick={() => onNav('customers')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Клиент
          </button>
          <button className="dash-action-btn primary" onClick={() => onNav('deals')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Новая сделка
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-row">
        {kpis.map(k => (
          <div key={k.label} className="kpi-card" style={{ '--kc': k.color }}>
            <div className="kpi-label">
              {k.label}
              <span className="kpi-icon">{k.icon}</span>
            </div>
            <div className="kpi-value">{k.value}</div>
            <div className={`kpi-delta ${k.dir}`}>
              {k.dir === 'pos'
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
              }
              {k.delta} за месяц
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="dash-grid">
        {/* Deals table */}
        <div className="surface-card">
          <div className="card-header">
            <span className="card-title">Активные сделки</span>
            <button className="card-action" onClick={() => onNav('deals')}>Все сделки →</button>
          </div>
          <table className="deals-table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Этап</th>
                <th>Сумма</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_DEALS.map(d => (
                <tr key={d.id}>
                  <td><span className="deal-name">{d.name}</span></td>
                  <td>{d.stage}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--tx)' }}>{d.amount}</td>
                  <td><span className={`deal-badge ${BADGE_CLASS[d.status]}`}>{BADGE_LABEL[d.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Activity feed */}
        <div className="surface-card">
          <div className="card-header">
            <span className="card-title">Лента событий</span>
            <button className="card-action">Все →</button>
          </div>
          <div className="activity-list">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="activity-item">
                <div className="activity-dot" style={{ background: a.color }} />
                <div className="activity-body">
                  <div className="activity-text">{a.text}</div>
                  <div className="activity-time">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PagePlaceholder({ name }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, color: 'var(--tx3)', padding: 48 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, border: '1px dashed var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: 13, color: 'var(--tx3)', opacity: .7 }}>Это раздел в прототипе не заполнен</div>
    </div>
  );
}

function KortAppShell({ onLogout }) {
  const [active, setActive] = useStateApp('home');
  return (
    <div className="app-root">
      <Sidebar active={active} setActive={setActive} onLogout={onLogout} />
      <div className="app-main">
        <Topbar page={active} />
        <div className="app-scroll">
          {active === 'home' ? <Dashboard onNav={setActive} /> : <PagePlaceholder name={active} />}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { KortAppShell });
