
// ── Onboarding Screen Component ───────────────────────────────────────────────
// Exports: window.KortOnboardingScreen

const { useState: useStateOB } = React;

const BUSINESS_TYPES = [
  { value: 'retail', label: 'Розничная торговля', desc: 'Точки продаж, онлайн-заказы и повторные покупки.', color: '#4A8BD4',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { value: 'services', label: 'Услуги', desc: 'Запись клиентов, повторные касания и сервис.', color: '#5C8DFF',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
  { value: 'sales', label: 'B2B и продажи', desc: 'Лиды, переговоры и коммерческие предложения.', color: '#2E9D84',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
  { value: 'production', label: 'Производство', desc: 'Длинный цикл сделки, согласования и этапы.', color: '#7C3AED',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> },
  { value: 'other', label: 'Другое направление', desc: 'Гибкая настройка под ваш процесс.', color: '#8FA4C8',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/></svg> },
];

const SIZES = [
  { value: '1_5', label: '1–5' },
  { value: '6_20', label: '6–20' },
  { value: '21_100', label: '21–100' },
  { value: '100_plus', label: '100+' },
];

const PLANS = [
  {
    mode: 'basic', title: 'Базовый', subtitle: 'Для малого бизнеса', color: '#5C8DFF',
    for: 'Команды до 20 человек, которые только начинают работать с CRM',
    features: ['Единая база клиентов и лидов', 'Управление складом', 'Настройка команды'],
    modules: [{ label: 'Лиды', color: '#5C8DFF' }, { label: 'Клиенты', color: '#5C8DFF' }, { label: 'Склад', color: '#8A9AB8' }],
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
  },
  {
    mode: 'advanced', title: 'Продвинутый', subtitle: 'Для растущей команды', color: '#4A8BD4',
    featured: true, badge: 'Рекомендуем',
    for: 'Бизнес с активными продажами, аналитикой и разделением ролей',
    features: ['Воронки продаж и этапы сделок', 'Задачи и контроль исполнения', 'Финансы и аналитика', 'Управление сотрудниками'],
    modules: [{ label: 'Лиды', color: '#5C8DFF' }, { label: 'Сделки', color: '#4A8BD4' }, { label: 'Клиенты', color: '#5C8DFF' }, { label: 'Задачи', color: '#2E9D84' }, { label: 'Склад', color: '#8A9AB8' }, { label: 'Финансы', color: '#2E9D84' }],
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  },
  {
    mode: 'industrial', title: 'Промышленный', subtitle: 'Для сложных процессов', color: '#7C3AED',
    callout: 'Индивидуальная интеграция',
    for: 'Производства и предприятия с уникальными операционными цепочками',
    features: ['Всё из «Продвинутого»', 'Кастомные рабочие зоны', 'API и расширенный аудит', 'Индивидуальные интеграции'],
    modules: [{ label: 'Все модули', color: '#7C3AED' }, { label: 'Chapan', color: '#7C3AED' }],
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  },
];

const STEPS = ['Ваш бизнес', 'Режим KORT', 'Готово'];

function BusinessTypeStep({ industry, setIndustry, size, setSize }) {
  return (
    <div className="ob-content ob-narrow screen-transition">
      <div className="ob-step-head">
        <p className="ob-eyebrow">Настройка рабочего контура</p>
        <h1 className="ob-title">Расскажите о вашем бизнесе</h1>
        <p className="ob-desc">KORT нужен только стартовый контекст, чтобы открыть нужные модули и убрать лишние.</p>
      </div>
      <p className="ob-field-label">Тип бизнеса</p>
      <div className="industry-grid">
        {BUSINESS_TYPES.map(item => {
          const sel = industry === item.value;
          return (
            <button key={item.value} type="button" onClick={() => setIndustry(item.value)}
              className={`industry-card${sel ? ' selected' : ''}`}
              style={{ '--ic': item.color }}>
              <span className="ic-icon">{item.icon}</span>
              <span className="ic-meta">
                <span className="ic-label" style={sel ? { color: item.color } : {}}>{item.label}</span>
                <span className="ic-desc">{item.desc}</span>
              </span>
              {sel && (
                <span className="ic-check">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="ob-field-label">Размер команды</p>
      <div className="size-pills">
        {SIZES.map(s => (
          <button key={s.value} type="button" onClick={() => setSize(s.value)}
            className={`size-pill${size === s.value ? ' selected' : ''}`}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanStep({ selectedMode, setMode }) {
  return (
    <div className="ob-content ob-wide screen-transition">
      <div className="ob-step-head">
        <p className="ob-eyebrow">Режим продукта</p>
        <h1 className="ob-title">Выберите режим KORT</h1>
        <p className="ob-desc">Режим определяет, какие модули откроются для вашей команды. Изменить можно позже в настройках.</p>
      </div>
      <div className="plan-grid">
        {PLANS.map(plan => {
          const sel = selectedMode === plan.mode;
          return (
            <button key={plan.mode} type="button" onClick={() => setMode(plan.mode)}
              className={`plan-card${plan.featured ? ' plan-featured' : ''}${sel ? ' plan-selected' : ''}`}
              style={{ '--pc': plan.color }}>
              {plan.badge && <div className="plan-featured-indicator">{plan.badge}</div>}
              <div className="plan-icon">{plan.icon}</div>
              <div className="plan-name">{plan.title}</div>
              <div className="plan-subtitle">{plan.subtitle}</div>
              <div className="plan-for">{plan.for}</div>
              <ul className="plan-features">
                {plan.features.map(f => (
                  <li key={f}><span className="plan-feat-dot" />{f}</li>
                ))}
              </ul>
              {plan.callout && <div className="plan-callout">{plan.callout}</div>}
              <div className="plan-mods">
                {plan.modules.map(m => (
                  <span key={m.label} className="plan-mod" style={{ '--mc': m.color }}>{m.label}</span>
                ))}
              </div>
              {sel && (
                <div className="plan-check">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SuccessStep({ onDone }) {
  return (
    <div className="ob-content ob-narrow screen-transition" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16, paddingTop: 32 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.26)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
      <h1 className="ob-title" style={{ marginBottom: 0 }}>Вы готовы к работе</h1>
      <p className="ob-desc" style={{ maxWidth: 340, textAlign: 'center' }}>KORT настроен и готов к первому полезному действию. Перейдите в рабочее пространство.</p>
      <button className="ob-btn ob-btn-primary" style={{ marginTop: 8 }} onClick={onDone}>
        Открыть KORT
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
    </div>
  );
}

function KortOnboardingScreen({ onComplete }) {
  const [step, setStep] = useStateOB(0);
  const [industry, setIndustry] = useStateOB('');
  const [size, setSize] = useStateOB('');
  const [selectedMode, setMode] = useStateOB('advanced');

  const canNext = step === 0 ? (industry !== '' && size !== '') : true;

  return (
    <div className="ob-root">
      {/* Header */}
      <header className="ob-header">
        <div className="ob-logo-row">
          <div className="ob-mark">K</div>
          <span className="ob-wordmark">KORT</span>
        </div>
        <div className="ob-progress">
          <div className="ob-dots">
            {STEPS.map((_, i) => (
              <span key={i} className={`ob-dot ${i === step ? 'ob-dot-active' : i < step ? 'ob-dot-done' : 'ob-dot-pending'}`} />
            ))}
          </div>
          <span className="ob-step-label">{STEPS[step]}</span>
        </div>
      </header>

      {/* Main */}
      <main className="ob-main">
        {step === 0 && <BusinessTypeStep industry={industry} setIndustry={setIndustry} size={size} setSize={setSize} />}
        {step === 1 && <PlanStep selectedMode={selectedMode} setMode={setMode} />}
        {step === 2 && <SuccessStep onDone={onComplete} />}
      </main>

      {/* Footer */}
      <footer className="ob-footer">
        <button
          className="ob-btn ob-btn-ghost"
          onClick={() => step > 0 && setStep(s => s - 1)}
          style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Назад
        </button>
        {step < 2 ? (
          <button className="ob-btn ob-btn-primary" disabled={!canNext} onClick={() => setStep(s => s + 1)}>
            Продолжить
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        ) : null}
      </footer>
    </div>
  );
}

Object.assign(window, { KortOnboardingScreen });
