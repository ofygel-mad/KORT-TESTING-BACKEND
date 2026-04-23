
// ── Auth Screen Component ─────────────────────────────────────────────────────
// Exports: window.KortAuthScreen

const { useState } = React;

function EyeIcon({ open, size = 16 }) {
  return open ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/>
    </svg>
  );
}

function PwField({ value, onChange, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="pw-field">
      <input
        className="form-input"
        type={visible ? 'text' : 'password'}
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete}
      />
      <button type="button" className="pw-toggle" onClick={() => setVisible(v => !v)} aria-label="Показать пароль">
        <EyeIcon open={visible} size={15} />
      </button>
    </div>
  );
}

function BrandPanel() {
  const props = [
    { color: '#5B9BD5', title: 'CRM и воронки продаж', desc: 'Лиды, сделки и клиенты — в едином рабочем потоке.' },
    { color: '#5C8DFF', title: 'Склад и логистика', desc: 'Учёт товаров, инвентаризация и цифровой двойник.' },
    { color: '#10B981', title: 'Финансы и аналитика', desc: 'Выручка, платежи и отчёты в реальном времени.' },
    { color: '#7C3AED', title: 'Производство', desc: 'Кастомные рабочие зоны для сложных операций.' },
  ];
  return (
    <div className="auth-brand">
      <div className="brand-logo-row">
        <div className="brand-mark">K</div>
        <span className="brand-name">KORT</span>
      </div>
      <div className="brand-hero">
        <div className="brand-tagline">
          Управляйте<br/>бизнесом в<br/><em>едином контуре</em>
        </div>
        <div className="brand-props">
          {props.map(p => (
            <div key={p.title} className="brand-prop">
              <div className="brand-prop-dot" style={{ background: p.color }} />
              <div className="brand-prop-body">
                <strong>{p.title}</strong>
                <span>{p.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="brand-bottom">
        <span className="brand-bottom-tag">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Казахстанская разработка
        </span>
        <span className="brand-bottom-tag" style={{ marginLeft: 'auto' }}>ERP нового поколения</span>
      </div>
      <div className="brand-deco" />
    </div>
  );
}

function LoginForm({ onLogin, onGoRegister }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) { setError('Введите логин и пароль.'); return; }
    setLoading(true); setError('');
    setTimeout(() => { setLoading(false); onLogin(); }, 900);
  }

  return (
    <form className="auth-form-inner screen-transition" onSubmit={handleSubmit}>
      <div className="form-title">Вход в систему</div>
      <div className="form-subtitle">Войдите по email или номеру телефона.</div>
      <div className="form-fields">
        <input className="form-input" type="text" value={identifier} onChange={e => { setIdentifier(e.target.value); setError(''); }} placeholder="Email или номер телефона" autoComplete="username" />
        <PwField value={password} onChange={v => { setPassword(v); setError(''); }} placeholder="Пароль" autoComplete="current-password" />
      </div>
      {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="login-actions" style={{ marginBottom: 16 }}>
        <button type="submit" className="primary-btn" disabled={loading}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </div>
      <div className="form-footer">
        <button type="button" className="link-btn">Забыли пароль?</button>
        <button type="button" className="link-btn" onClick={onGoRegister}>Создать компанию →</button>
      </div>
    </form>
  );
}

function RegisterForm({ onRegister, onBack }) {
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!companyName.trim() || !ownerName.trim() || !email.trim() || !password.trim()) { setError('Заполните все обязательные поля.'); return; }
    if (password !== confirm) { setError('Пароли не совпадают.'); return; }
    if (password.length < 6) { setError('Пароль должен содержать не менее 6 символов.'); return; }
    setLoading(true); setError('');
    setTimeout(() => { setLoading(false); onRegister(); }, 1000);
  }

  return (
    <form className="auth-form-inner screen-transition" onSubmit={handleSubmit} style={{ maxWidth: 400, paddingBottom: 8 }}>
      <div className="form-title">Регистрация компании</div>
      <div className="form-subtitle">Компания создаётся сразу с правами руководителя.</div>
      <div className="form-fields">
        <input className="form-input" value={companyName} onChange={e => { setCompanyName(e.target.value); setError(''); }} placeholder="Название компании *" />
        <input className="form-input" value={ownerName} onChange={e => { setOwnerName(e.target.value); setError(''); }} placeholder="ФИО руководителя *" autoComplete="name" />
        <input className="form-input" type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="Email *" autoComplete="email" />
        <PwField value={password} onChange={v => { setPassword(v); setError(''); }} placeholder="Пароль *" autoComplete="new-password" />
        <PwField value={confirm} onChange={v => { setConfirm(v); setError(''); }} placeholder="Подтверждение пароля *" autoComplete="new-password" />
      </div>
      {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
      <button type="submit" className="primary-btn" style={{ width: '100%', marginBottom: 4 }} disabled={loading}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 7V21M21 7V21M6 21V11M15 21V11M9 7h6M9 11h6M9 15h6M6 3h12l3 4H3z"/></svg>
        {loading ? 'Создаём компанию...' : 'Создать компанию'}
      </button>
    </form>
  );
}

function KortAuthScreen({ onComplete }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  return (
    <div className="auth-root">
      <BrandPanel />
      <div className="auth-form-side">
        <div className="auth-form-header">
          <div style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
            {mode === 'register' && (
              <button className="form-back-btn" onClick={() => setMode('login')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Назад
              </button>
            )}
          </div>
          <div style={{ width: 40 }} />
        </div>
        <div className="auth-form-content">
          {mode === 'login'
            ? <LoginForm onLogin={onComplete} onGoRegister={() => setMode('register')} />
            : <RegisterForm onRegister={onComplete} onBack={() => setMode('login')} />
          }
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { KortAuthScreen });
