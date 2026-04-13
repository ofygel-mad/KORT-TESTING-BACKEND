import { useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../../shared/api/client';
import { readApiErrorMessage } from '../../shared/api/errors';
import styles from './SetPasswordStep.module.css';

interface Props {
  /** Short-lived first-login token from FirstLoginResponse */
  tempToken: string;
  /** Employee's name for the greeting */
  userName?: string;
  /** Called after password is set — no session returned, user must re-login */
  onSuccess: () => void;
}

function readAuthError(cause: unknown, fallback: string) {
  const message = readApiErrorMessage(cause, '').trim();
  return message || fallback;
}

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.passwordField}>
      <input
        className={styles.input}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className={styles.toggleBtn}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function SetPasswordStep({ tempToken, userName, onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');

    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов.');
      return;
    }
    if (password !== confirm) {
      setError('Пароли не совпадают. Повторите ввод.');
      return;
    }

    setLoading(true);
    try {
      // We call axios directly with the temp_token in Authorization.
      // We intentionally bypass the shared api client's auth interceptor
      // (which would inject the store access token instead).
      const { data } = await axios.post<{ ok: boolean; requires_login?: boolean }>(
        `${API_BASE_URL}/auth/set-password/`,
        { new_password: password, confirm_password: confirm },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tempToken}`,
          },
        },
      );
      // Password set — backend revoked tokens, user must re-login
      onSuccess();
    } catch (cause) {
      setError(readAuthError(cause, 'Не удалось установить пароль. Попробуйте снова.'));
    } finally {
      setLoading(false);
    }
  }

  const firstName = userName?.split(' ')[0] ?? 'Добро пожаловать';

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.iconWrap}>
          <ShieldCheck size={22} />
        </div>
        <h2 className={styles.title}>{firstName}, установите пароль</h2>
        <p className={styles.subtitle}>
          Это единственный шаг при первом входе. После сохранения вы будете
          заходить только с этим паролем.
        </p>
      </div>

      <div className={styles.fields}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Новый пароль</label>
          <PasswordField
            value={password}
            onChange={(v) => { setPassword(v); setError(''); }}
            placeholder="Минимум 6 символов"
            autoComplete="new-password"
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Подтвердите пароль</label>
          <PasswordField
            value={confirm}
            onChange={(v) => { setConfirm(v); setError(''); }}
            placeholder="Повторите пароль"
            autoComplete="new-password"
          />
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.strengthHint}>
        Минимум 6 символов. После сохранения войдите заново с телефоном и новым паролем.
      </div>

      <button
        type="button"
        className={styles.submitBtn}
        disabled={loading || !password || !confirm}
        onClick={() => void submit()}
      >
        <KeyRound size={16} />
        {loading ? 'Сохраняем...' : 'Сохранить пароль'}
      </button>
    </div>
  );
}
