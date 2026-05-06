import { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../shared/api/client';

type OrgInfo = { id: string; name: string; slug: string };
type CleanResult = {
  org: string;
  deleted: Record<string, number>;
};

type Step =
  | { kind: 'idle' }
  | { kind: 'authed'; password: string; org: OrgInfo }
  | { kind: 'confirm'; password: string; org: OrgInfo }
  | { kind: 'done'; result: CleanResult }
  | { kind: 'error'; message: string };

export default function DevPanel() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>({ kind: 'idle' });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/service/access`, { password });
      setStep({
        kind: 'authed',
        password,
        org: { id: data.org.id, name: data.org.name, slug: data.org.slug },
      });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? err.message)
        : 'Неизвестная ошибка';
      setStep({ kind: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  }

  async function handleClean() {
    if (step.kind !== 'confirm') return;
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/service/clean-org`, {
        password: step.password,
        orgId: step.org.id,
      });
      setStep({ kind: 'done', result: data });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? err.message)
        : 'Неизвестная ошибка';
      setStep({ kind: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.badge}>DEV</div>
        <h1 style={styles.title}>Панель разработчика</h1>
        <p style={styles.subtitle}>Только для внутреннего использования. Требует сервисный пароль.</p>

        {step.kind === 'idle' || step.kind === 'error' ? (
          <form onSubmit={handleLogin} style={styles.form}>
            <input
              type="password"
              placeholder="Сервисный пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              autoFocus
            />
            <button type="submit" disabled={loading || !password} style={styles.btn}>
              {loading ? 'Проверка...' : 'Войти'}
            </button>
            {step.kind === 'error' && (
              <div style={styles.error}>{step.message}</div>
            )}
          </form>
        ) : step.kind === 'authed' ? (
          <div style={styles.section}>
            <div style={styles.orgBox}>
              <div style={styles.orgLabel}>Организация</div>
              <div style={styles.orgName}>{step.org.name}</div>
              <div style={styles.orgSlug}>/{step.org.slug}</div>
            </div>
            <div style={styles.divider} />
            <div style={styles.actionTitle}>Доступные действия</div>
            <button
              style={{ ...styles.btn, ...styles.btnDanger }}
              onClick={() => setStep({ kind: 'confirm', password: step.password, org: step.org })}
            >
              Удалить все тестовые данные
            </button>
            <p style={styles.hint}>
              Удалит: заказы, инвойсы, клиентов, лиды, сделки, задачи, бухгалтерские записи.
              Настройки, каталог и пользователи останутся.
            </p>
          </div>
        ) : step.kind === 'confirm' ? (
          <div style={styles.section}>
            <div style={styles.confirmBox}>
              <div style={styles.confirmIcon}>⚠️</div>
              <div style={styles.confirmText}>
                Все операционные данные <strong>{step.org.name}</strong> будут безвозвратно удалены.
              </div>
            </div>
            <div style={styles.row}>
              <button
                style={{ ...styles.btn, ...styles.btnGhost }}
                onClick={() => setStep({ kind: 'authed', password: step.password, org: step.org })}
                disabled={loading}
              >
                Отмена
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnDanger }}
                onClick={handleClean}
                disabled={loading}
              >
                {loading ? 'Удаляем...' : 'Подтвердить удаление'}
              </button>
            </div>
          </div>
        ) : step.kind === 'done' ? (
          <div style={styles.section}>
            <div style={styles.successBox}>
              <div style={styles.successIcon}>✓</div>
              <div style={styles.successTitle}>Данные удалены — {step.result.org}</div>
            </div>
            <div style={styles.resultGrid}>
              {Object.entries(step.result.deleted).map(([key, count]) => (
                <div key={key} style={styles.resultRow}>
                  <span style={styles.resultKey}>{key}</span>
                  <span style={styles.resultCount}>{count}</span>
                </div>
              ))}
            </div>
            <button
              style={{ ...styles.btn, ...styles.btnGhost }}
              onClick={() => { setStep({ kind: 'idle' }); setPassword(''); }}
            >
              Закрыть
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0c12',
    padding: '24px',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#13161e',
    border: '1px solid #1e2435',
    borderRadius: 16,
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  badge: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    padding: '2px 8px',
    borderRadius: 6,
    background: 'rgba(239,68,68,0.14)',
    border: '1px solid rgba(239,68,68,0.28)',
    color: '#f87171',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: '#eff1f5',
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    color: '#5a6273',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  input: {
    background: '#0d1018',
    border: '1px solid #1e2435',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#eff1f5',
    fontSize: 14,
    outline: 'none',
  },
  btn: {
    padding: '10px 18px',
    borderRadius: 10,
    border: 'none',
    background: '#8a9ab8',
    color: '#0d1018',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 140ms',
  },
  btnDanger: {
    background: 'rgba(239,68,68,0.18)',
    border: '1px solid rgba(239,68,68,0.32)',
    color: '#f87171',
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid #1e2435',
    color: '#8898b8',
  },
  error: {
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.22)',
    borderRadius: 8,
    color: '#f87171',
    fontSize: 13,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  orgBox: {
    padding: '14px 16px',
    background: '#0d1018',
    borderRadius: 10,
    border: '1px solid #1e2435',
  },
  orgLabel: { fontSize: 10, fontWeight: 600, color: '#4a5878', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 },
  orgName: { fontSize: 16, fontWeight: 700, color: '#eff1f5' },
  orgSlug: { fontSize: 12, color: '#5a6273', marginTop: 2 },
  divider: { height: 1, background: '#1e2435' },
  actionTitle: { fontSize: 11, fontWeight: 600, color: '#4a5878', textTransform: 'uppercase', letterSpacing: '0.08em' },
  hint: { margin: 0, fontSize: 12, color: '#4a5878', lineHeight: 1.55 },
  confirmBox: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    padding: '14px 16px',
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 10,
  },
  confirmIcon: { fontSize: 18, flexShrink: 0 },
  confirmText: { fontSize: 13, color: '#ccd0d8', lineHeight: 1.5 },
  row: { display: 'flex', gap: 8 },
  successBox: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    padding: '12px 16px',
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.22)',
    borderRadius: 10,
  },
  successIcon: { fontSize: 16, color: '#10b981' },
  successTitle: { fontSize: 14, fontWeight: 600, color: '#6ee7b7' },
  resultGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '12px 14px',
    background: '#0d1018',
    borderRadius: 10,
    border: '1px solid #1e2435',
  },
  resultRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  resultKey: { fontSize: 12, color: '#5a6273' },
  resultCount: { fontSize: 12, fontWeight: 600, color: '#8898b8' },
};
