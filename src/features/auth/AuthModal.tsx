import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  Factory,
  KeyRound,
  ShieldCheck,
  ShieldX,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import { api } from '../../shared/api/client';
import type { AuthSessionResponse } from '../../shared/api/contracts';
import {
  isFirstLoginResponse,
  type LoginApiResponse,
} from '../../shared/api/contracts';
import { readApiErrorMessage, readApiErrorStatus } from '../../shared/api/errors';
import { useAuthStore } from '../../shared/stores/auth';
import { usePinStore } from '../../shared/stores/pin';
import {
  formatKazakhPhoneInput,
  isKazakhPhoneComplete,
  normalizeKazakhPhone,
} from '../../shared/utils/kz';
import { SetPasswordStep } from './SetPasswordStep';
import styles from './AuthModal.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Шаги модального окна:
 * - login    : стандартный вход (email или телефон + пароль)
 * - pin      : быстрый вход по PIN-коду
 * - company  : регистрация компании (единственный публичный путь регистрации)
 * - set-password : установка пароля при первом входе сотрудника
 *
 * Намеренно удалены: 'choose-type' и 'employee'
 * (сотрудники регистрируются только через администратора в настройках)
 */
type Step = 'login' | 'pin' | 'company' | 'set-password' | 'forgot' | 'password-set';
type BrandScene = 'network' | 'briefing' | 'flow' | 'metrics';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
  initialStep?: Step;
}

// ─── Brand carousel data ──────────────────────────────────────────────────────

const BRAND_CAROUSEL = [
  {
    icon: Workflow,
    label: 'Поток',
    title: 'Клиенты, сделки и задачи в одном ритме',
    description: 'Единый экран без лишнего визуального шума.',
    scene: 'flow' as BrandScene,
  },
  {
    icon: ShieldCheck,
    label: 'Доступ',
    title: 'Роли и связи читаются с первого взгляда',
    description: 'Команда, права и контакты собраны в одной структуре.',
    scene: 'network' as BrandScene,
  },
  {
    icon: Factory,
    label: 'Операции',
    title: 'Продажи, сервис и производство держатся вместе',
    description: 'Интерфейс остаётся собранным даже при параллельной работе.',
    scene: 'briefing' as BrandScene,
  },
  {
    icon: TrendingUp,
    label: 'Контроль',
    title: 'Финансы и аналитика всегда под рукой',
    description: 'Ключевые метрики, воронка и выручка — в одном рабочем пространстве.',
    scene: 'metrics' as BrandScene,
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readAuthError(cause: unknown, fallback: string) {
  const message = readApiErrorMessage(cause, '').trim();
  const status = readApiErrorStatus(cause);
  if (!status && message.toLowerCase() === 'network error') {
    return 'Сервис авторизации временно недоступен. Сервер не отвечает.';
  }
  if (message) return message;
  if (status === 401) return 'Неверный логин или пароль.';
  if (status === 409) return 'Этот email уже занят.';
  if (status === 400) return 'Проверьте заполнение полей и попробуйте ещё раз.';

  return fallback;
}

function normalizePhonePayload(value: string) {
  return normalizeKazakhPhone(value) ?? undefined;
}

/**
 * Определяет, является ли введённая строка номером телефона.
 * Критерий: начинается с +7, 7, 8 или содержит только цифры длиной >= 10.
 */
function looksLikePhone(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith('+7') ||
    trimmed.startsWith('+') ||
    /^[78]\d/.test(trimmed) ||
    /^\d{10,}$/.test(trimmed.replace(/[\s\-()]/g, ''))
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
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
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className={styles.passwordToggle}
        onClick={() => setVisible((s) => !s)}
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function BrandScenePreview({ scene }: { scene: BrandScene }) {
  if (scene === 'network') {
    return (
      <div className={`${styles.slideScene} ${styles.sceneNetwork}`} aria-hidden="true">
        <span className={styles.sceneGlow} />
        <span className={`${styles.sceneNode} ${styles.sceneNodeCore}`} />
        <span className={`${styles.sceneNode} ${styles.sceneNodeTop}`} />
        <span className={`${styles.sceneNode} ${styles.sceneNodeLeft}`} />
        <span className={`${styles.sceneNode} ${styles.sceneNodeRight}`} />
        <span className={`${styles.sceneNode} ${styles.sceneNodeBottom}`} />
        <span className={`${styles.sceneLink} ${styles.sceneLinkTop}`} />
        <span className={`${styles.sceneLink} ${styles.sceneLinkLeft}`} />
        <span className={`${styles.sceneLink} ${styles.sceneLinkRight}`} />
        <span className={`${styles.sceneLink} ${styles.sceneLinkBottom}`} />
        <div className={`${styles.sceneMiniCard} ${styles.sceneMiniCardTop}`}>
          <span className={styles.sceneMiniLabel}>роли</span>
          <strong>owner / admin / team</strong>
        </div>
        <div className={`${styles.sceneMiniCard} ${styles.sceneMiniCardBottom}`}>
          <span className={styles.sceneMiniLabel}>контакты</span>
          <strong>единая структура</strong>
        </div>
      </div>
    );
  }

  if (scene === 'briefing') {
    return (
      <div className={`${styles.slideScene} ${styles.sceneBriefing}`} aria-hidden="true">
        <span className={styles.sceneGlow} />
        <span className={styles.sceneTable} />
        <span className={`${styles.sceneAvatar} ${styles.sceneAvatarOne}`} />
        <span className={`${styles.sceneAvatar} ${styles.sceneAvatarTwo}`} />
        <span className={`${styles.sceneAvatar} ${styles.sceneAvatarThree}`} />
        <span className={`${styles.sceneAvatar} ${styles.sceneAvatarFour}`} />
        <div className={styles.sceneBoard}>
          <span className={`${styles.sceneBoardRow} ${styles.sceneBoardRowLong}`} />
          <span className={`${styles.sceneBoardRow} ${styles.sceneBoardRowShort}`} />
          <span className={`${styles.sceneBoardRow} ${styles.sceneBoardRowMid}`} />
        </div>
        <div className={styles.sceneBriefCard}>
          <span className={styles.sceneMiniLabel}>синхронизация</span>
          <strong>обсуждение и решения</strong>
        </div>
      </div>
    );
  }

  if (scene === 'metrics') {
    return (
      <div className={`${styles.slideScene} ${styles.sceneMetrics}`} aria-hidden="true">
        <span className={styles.sceneGlow} />
        <div className={styles.sceneMetricGrid}>
          <div className={styles.sceneMetricCard}>
            <span className={styles.sceneMiniLabel}>выручка</span>
            <strong className={styles.sceneMetricValue}>₸ 4.2М</strong>
            <span className={`${styles.sceneMetricTrend} ${styles.sceneMetricTrendUp}`}>↑ 18%</span>
          </div>
          <div className={styles.sceneMetricCard}>
            <span className={styles.sceneMiniLabel}>заказов</span>
            <strong className={styles.sceneMetricValue}>147</strong>
            <span className={`${styles.sceneMetricTrend} ${styles.sceneMetricTrendUp}`}>↑ 6%</span>
          </div>
        </div>
        <div className={styles.sceneSparkline}>
          <span className={`${styles.sceneSparkBar} ${styles.sceneSparkS1}`} />
          <span className={`${styles.sceneSparkBar} ${styles.sceneSparkS2}`} />
          <span className={`${styles.sceneSparkBar} ${styles.sceneSparkS3}`} />
          <span className={`${styles.sceneSparkBar} ${styles.sceneSparkS4}`} />
          <span className={`${styles.sceneSparkBar} ${styles.sceneSparkS5}`} />
          <span className={`${styles.sceneSparkBar} ${styles.sceneSparkS6}`} />
          <span className={`${styles.sceneSparkBar} ${styles.sceneSparkS7}`} />
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.slideScene} ${styles.sceneFlow}`} aria-hidden="true">
      <span className={styles.sceneGlow} />
      <div className={styles.sceneLane}>
        <div className={`${styles.sceneStage} ${styles.sceneStageActive}`}>
          <span className={styles.sceneStageLabel}>лид</span>
          <strong className={styles.sceneStageValue}>24</strong>
          <span className={styles.sceneStageBar} />
        </div>
        <div className={styles.sceneStage}>
          <span className={styles.sceneStageLabel}>сделка</span>
          <strong className={styles.sceneStageValue}>17</strong>
          <span className={styles.sceneStageBar} />
        </div>
        <div className={styles.sceneStage}>
          <span className={styles.sceneStageLabel}>задача</span>
          <strong className={styles.sceneStageValue}>31</strong>
          <span className={styles.sceneStageBar} />
        </div>
      </div>
      <div className={styles.sceneGraph}>
        <span className={`${styles.sceneGraphBar} ${styles.sceneGraphBarLow}`} />
        <span className={`${styles.sceneGraphBar} ${styles.sceneGraphBarMid}`} />
        <span className={`${styles.sceneGraphBar} ${styles.sceneGraphBarTall}`} />
        <span className={`${styles.sceneGraphBar} ${styles.sceneGraphBarMid}`} />
        <span className={`${styles.sceneGraphBar} ${styles.sceneGraphBarLow}`} />
      </div>
    </div>
  );
}

function PinStep({
  onSuccess,
  onUsePassword,
}: {
  onSuccess: () => void;
  onUsePassword: () => void;
}) {
  const storedPin = usePinStore((state) => state.pin);
  const user = useAuthStore((state) => state.user);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const pinLength = storedPin?.length ?? 4;
  const inputRef = useRef<HTMLInputElement>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setDigits(''); setError(''); }, [storedPin]);
  useEffect(() => () => { if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current); }, []);

  const submit = (value: string) => {
    if (value === storedPin) { onSuccess(); return; }
    setDigits('');
    setError('Неверный PIN-код.');
    setShake(true);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => setShake(false), 500);
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepHeader}>
        <h2 className={styles.title}>
          {user ? `С возвращением, ${user.full_name?.split(' ')[0] ?? 'в команду'}` : 'Введите PIN-код'}
        </h2>
        <p className={styles.subtitle}>
          Быстрый вход доступен только на доверенном устройстве. Если PIN не подходит, переключитесь на пароль.
        </p>
      </div>
      <div
        className={`${styles.pinArea} ${shake ? styles.pinAreaShake : ''}`}
        onClick={() => inputRef.current?.focus()}
        role="presentation"
      >
        <div className={styles.pinDots}>
          {Array.from({ length: pinLength }, (_, i) => (
            <div
              key={i}
              className={`${styles.pinDot} ${digits.length > i ? styles.pinDotFilled : ''} ${error ? styles.pinDotError : ''}`}
            />
          ))}
        </div>
        <input
          ref={inputRef}
          className={styles.pinHiddenInput}
          type="password"
          inputMode="numeric"
          autoFocus
          value={digits}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, '').slice(0, pinLength);
            setDigits(next);
            setError('');
            if (next.length === pinLength) submit(next);
          }}
        />
      </div>
      {error && <div className={styles.errorMessage}>{error}</div>}
      <button type="button" className={styles.linkButton} onClick={onUsePassword}>
        Войти с паролем
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AuthModal({ open, onClose, onAuthSuccess, initialStep }: AuthModalProps) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const inviteContext = useAuthStore((state) => state.inviteContext);
  const user = useAuthStore((state) => state.user);
  const pin = usePinStore((state) => state.pin);
  const isTrustedDevice = usePinStore((state) => state.isTrustedDevice);
  const trustDevice = usePinStore((state) => state.trustDevice);

  const defaultStep = useMemo<Step>(() => {
    if (initialStep) return initialStep;
    if (user && pin && isTrustedDevice) return 'pin';
    return 'login';
  }, [initialStep, isTrustedDevice, pin, user]);

  const [step, setStep] = useState<Step>(defaultStep);
  const [activeBrandSlide, setActiveBrandSlide] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Login state ───────────────────────────────────────────────────────────
  // loginIdentifier принимает email ИЛИ телефон (любой формат)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // ── Employee login mode ───────────────────────────────────────────────────
  // isEmployeeMode: пользователь нажал «Войти как сотрудник»
  // employeeLookupDone: телефон найден, показываем поле пароля
  const [isEmployeeMode, setIsEmployeeMode] = useState(false);
  const [employeeLookupDone, setEmployeeLookupDone] = useState(false);

  // ── First-login set-password state ────────────────────────────────────────
  const [firstLoginTempToken, setFirstLoginTempToken] = useState('');
  const [firstLoginUserName, setFirstLoginUserName] = useState('');

  // ── Forgot password state ─────────────────────────────────────────────────
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // ── Company registration state ────────────────────────────────────────────
  const [companyName, setCompanyName] = useState('');
  const [companyOwnerName, setCompanyOwnerName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyPassword, setCompanyPassword] = useState('');
  const [companyPasswordConfirm, setCompanyPasswordConfirm] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep(defaultStep);
    setError('');
    setLoading(false);
    setIsEmployeeMode(false);
    setEmployeeLookupDone(false);
    setLoginIdentifier('');
    setLoginPassword('');
  }, [defaultStep, open]);

  useEffect(() => {
    if (!open) return;
    setActiveBrandSlide(0);
    const timer = window.setInterval(() => {
      setActiveBrandSlide((c) => (c + 1) % BRAND_CAROUSEL.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [open]);

  if (!open) return null;

  const activeStory = BRAND_CAROUSEL[activeBrandSlide];
  const ActiveStoryIcon = activeStory.icon;

  function applySession(session: AuthSessionResponse) {
    setAuth(
      session.user,
      session.org,
      session.access,
      session.refresh,
      session.capabilities,
      session.role,
      {
        membership: session.membership,
        inviteContext: null,
        orgs: session.orgs,
      },
    );
    trustDevice();
    setError('');
    onAuthSuccess();
  }

  // ── Login submit ───────────────────────────────────────────────────────────
  async function submitLogin() {
    const rawIdentifier = loginIdentifier.trim();
    const rawPassword = loginPassword;

    if (!rawIdentifier || !rawPassword.trim()) {
      setError('Введите логин и пароль.');
      return;
    }

    // Нормализация: если это телефон — привести к +7XXXXXXXXXX
    let identifier = rawIdentifier;
    let isPhone = false;
    if (looksLikePhone(rawIdentifier)) {
      const normalized = normalizeKazakhPhone(rawIdentifier);
      if (normalized) {
        identifier = normalized;
        isPhone = true;
      }
    }

    if (isPhone && !isKazakhPhoneComplete(identifier)) {
      setError('Введите полный номер телефона (10 цифр после +7).');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post<LoginApiResponse | null>('/auth/login/', {
        // Бэкенд принимает либо поле email, либо phone — определяем по типу
        ...(isPhone ? { phone: identifier } : { email: identifier.toLowerCase() }),
        password: rawPassword,
      });

      if (!response) {
        setError('Аккаунт не найден. Проверьте данные или обратитесь к администратору.');
        return;
      }

      // ── First-login flow: сотрудник без пароля ─────────────────────────
      if (isFirstLoginResponse(response)) {
        setFirstLoginTempToken(response.temp_token);
        setFirstLoginUserName(response.user.full_name);
        setStep('set-password');
        return;
      }

      // ── Обычный вход ───────────────────────────────────────────────────
      applySession(response);
    } catch (cause) {
      setError(readAuthError(cause, 'Не удалось выполнить вход.'));
    } finally {
      setLoading(false);
    }
  }

  // ── Employee lookup submit ─────────────────────────────────────────────────
  // Первый шаг в режиме «Войти как сотрудник»: проверяем телефон без пароля.
  async function submitEmployeeLookup() {
    const rawPhone = loginIdentifier.trim();
    if (!rawPhone) { setError('Введите номер телефона.'); return; }

    const normalized = normalizeKazakhPhone(rawPhone);
    if (!normalized || !isKazakhPhoneComplete(rawPhone)) {
      setError('Введите полный номер телефона (10 цифр после +7).');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await api.post<
        | { found: false }
        | { found: true; account_status: 'active'; requires_password: true; full_name: string }
        | { found: true; account_status: 'pending_first_login'; requires_password: false; full_name: string; temp_token: string }
      >('/auth/employee/lookup/', { phone: normalized });

      if (!result || !result.found) {
        setError('Номер телефона не найден в системе. Уточните у руководителя.');
        return;
      }

      if (result.account_status === 'pending_first_login') {
        setFirstLoginTempToken(result.temp_token);
        setFirstLoginUserName(result.full_name);
        setStep('set-password');
        return;
      }

      // Активный сотрудник: показываем поле пароля
      setFirstLoginUserName(result.full_name);
      setEmployeeLookupDone(true);
    } catch (cause) {
      setError(readAuthError(cause, 'Не удалось проверить номер телефона.'));
    } finally {
      setLoading(false);
    }
  }

  // ── Company registration submit ────────────────────────────────────────────
  async function submitCompanyRegistration() {
    if (!companyName.trim() || !companyOwnerName.trim() || !companyEmail.trim() || !companyPassword.trim()) {
      setError('Заполните все обязательные поля.');
      return;
    }
    if (companyPassword !== companyPasswordConfirm) {
      setError('Пароли не совпадают.');
      return;
    }
    if (companyPassword.length < 6) {
      setError('Пароль должен содержать не менее 6 символов.');
      return;
    }
    if (companyPhone.trim() && !isKazakhPhoneComplete(companyPhone)) {
      setError('Телефон должен быть в формате +7 (___) ___-__-__.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const session = await api.post<AuthSessionResponse | null>('/auth/register/company/', {
        company_name: companyName.trim(),
        full_name: companyOwnerName.trim(),
        email: companyEmail.trim().toLowerCase(),
        phone: normalizePhonePayload(companyPhone),
        password: companyPassword,
      });

      if (!session) {
        setError('Не удалось создать компанию.');
        return;
      }

      applySession(session);
    } catch (cause) {
      setError(readAuthError(cause, 'Не удалось завершить регистрацию компании.'));
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password submit ─────────────────────────────────────────────────
  async function submitForgotPassword() {
    const email = forgotEmail.trim();
    if (!email) { setError('Введите email.'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password/', { email: email.toLowerCase() });
      setForgotSent(true);
    } catch (cause) {
      setError(readAuthError(cause, 'Не удалось отправить письмо. Попробуйте позже.'));
    } finally {
      setLoading(false);
    }
  }

  const backTarget: Partial<Record<Step, Step>> = {
    company: 'login',
    pin: 'login',
    forgot: 'login',
    // set-password намеренно не имеет кнопки «Назад» — нельзя вернуться
    // к состоянию до первого входа без повторной авторизации
  };

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          // Закрывать модалку на шаге set-password не даём — пользователь
          // обязан установить пароль, иначе аккаунт зависнет в pending
          if (step === 'set-password' || step === 'password-set') return;
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className={styles.panel}>
          {/* ── Brand side ── */}
          <div className={styles.brandSide}>
            <span className={styles.brandTopAccent} aria-hidden="true" />
            <div className={styles.brandHero}>
              <div className={styles.brandDisplay}>KORT</div>
            </div>
            <div className={styles.brandCarousel}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.article
                  key={activeStory.title}
                  className={styles.brandSlide}
                  initial={{ opacity: 0, x: 26, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -26, scale: 0.985 }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className={styles.slideTop}>
                    <span className={styles.slideBadge}>
                      <ActiveStoryIcon size={14} />
                      {activeStory.label}
                    </span>
                    <span className={styles.slideCounter}>
                      {String(activeBrandSlide + 1).padStart(2, '0')}
                      {' / '}
                      {String(BRAND_CAROUSEL.length).padStart(2, '0')}
                    </span>
                  </div>
                  <BrandScenePreview scene={activeStory.scene} />
                  <div className={styles.slideCopy}>
                    <strong className={styles.slideTitle}>{activeStory.title}</strong>
                    <p className={styles.slideText}>{activeStory.description}</p>
                  </div>
                </motion.article>
              </AnimatePresence>
              <div className={styles.carouselDots} aria-label="Навигация по карточкам">
                {BRAND_CAROUSEL.map((story, index) => (
                  <button
                    key={story.title}
                    type="button"
                    className={`${styles.carouselDot} ${index === activeBrandSlide ? styles.carouselDotActive : ''}`}
                    onClick={() => setActiveBrandSlide(index)}
                    aria-label={`Показать карточку ${index + 1}`}
                  />
                ))}
              </div>
            </div>

          </div>

          {/* ── Form side ── */}
          <div className={styles.formSide}>
            <div className={styles.formHeader}>
              <div className={styles.headerLeft}>
                {backTarget[step] && (
                  <button
                    type="button"
                    className={styles.backButton}
                    onClick={() => { setError(''); setStep(backTarget[step]!); }}
                  >
                    <ArrowLeft size={14} />
                    Назад
                  </button>
                )}
              </div>
            </div>

            <div className={styles.formViewport}>
              {/* ── PIN step ── */}
              {step === 'pin' && (
                <PinStep
                  onSuccess={onAuthSuccess}
                  onUsePassword={() => { setError(''); setStep('login'); }}
                />
              )}

              {/* ── Login step ── */}
              {step === 'login' && (
                <form
                  className={styles.stepContent}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (isEmployeeMode && !employeeLookupDone) {
                      void submitEmployeeLookup();
                    } else {
                      void submitLogin();
                    }
                  }}
                >
                  <div className={styles.stepHeader}>
                    <h2 className={styles.title}>Вход</h2>
                    <p className={styles.subtitle}>
                      {isEmployeeMode
                        ? employeeLookupDone
                          ? `Добро пожаловать, ${firstLoginUserName.split(' ')[0]}. Введите пароль.`
                          : 'Введите номер телефона, которым вас зарегистрировал руководитель.'
                        : 'Войдите по email или номеру телефона.'}
                    </p>
                    {inviteContext && (
                      <div className={styles.pinInfo}>
                        После входа аккаунт сразу подключится к компании «{inviteContext.companyName}».
                      </div>
                    )}
                  </div>

                  <div className={styles.formFields}>
                    <input
                      className={styles.input}
                      value={loginIdentifier}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isEmployeeMode || looksLikePhone(v)) {
                          setLoginIdentifier(formatKazakhPhoneInput(v));
                        } else {
                          setLoginIdentifier(v);
                        }
                        setError('');
                        // При изменении телефона в employee-режиме — сбрасываем lookup
                        if (isEmployeeMode && employeeLookupDone) {
                          setEmployeeLookupDone(false);
                          setLoginPassword('');
                        }
                      }}
                      placeholder={isEmployeeMode ? 'Номер телефона' : 'Email или номер телефона'}
                      autoComplete="username"
                      inputMode={isEmployeeMode ? 'tel' : 'email'}
                      type="text"
                      disabled={isEmployeeMode && employeeLookupDone}
                    />
                    {(!isEmployeeMode || employeeLookupDone) && (
                      <PasswordField
                        value={loginPassword}
                        onChange={(v) => { setLoginPassword(v); setError(''); }}
                        placeholder="Пароль"
                        autoComplete="current-password"
                      />
                    )}
                    {isEmployeeMode && !employeeLookupDone && (
                      <p className={styles.employeeLookupHint}>
                        Пароль появится после проверки номера.
                      </p>
                    )}
                  </div>

                  {/* Переключатель «Войти как сотрудник» */}
                  <label
                    className={`${styles.employeeToggleRow} ${isEmployeeMode ? styles.employeeToggleRowActive : ''}`}
                  >
                    <input
                      type="checkbox"
                      className={styles.employeeCheckbox}
                      checked={isEmployeeMode}
                      onChange={(e) => {
                        setIsEmployeeMode(e.target.checked);
                        setEmployeeLookupDone(false);
                        setLoginIdentifier('');
                        setLoginPassword('');
                        setFirstLoginUserName('');
                        setError('');
                      }}
                    />
                    Войти как сотрудник
                  </label>

                  {error && error !== '__device_unrecognized__' && <div className={styles.errorMessage}>{error}</div>}

                  <div className={styles.loginActionsRow}>
                    <button type="submit" className={styles.primaryButton} disabled={loading}>
                      <KeyRound size={16} />
                      {loading
                        ? (isEmployeeMode && !employeeLookupDone ? 'Проверяем...' : 'Входим...')
                        : (isEmployeeMode && !employeeLookupDone ? 'Продолжить' : 'Войти')}
                    </button>
                    {!isEmployeeMode && (
                      <button
                        type="button"
                        className={styles.pinQuickButton}
                        onClick={() => {
                          if (pin && isTrustedDevice && user) {
                            setError('');
                            setStep('pin');
                          } else {
                            setError('__device_unrecognized__');
                          }
                        }}
                        title="Войти по PIN-коду"
                        aria-label="Войти по PIN-коду"
                      >
                        <ShieldX size={18} />
                      </button>
                    )}
                  </div>

                  {error === '__device_unrecognized__' && (
                    <div className={styles.deviceWarningBox}>
                      <AlertTriangle size={15} />
                      Устройство не распознано. Рекомендуем войти через логин и пароль.
                    </div>
                  )}

                  {!isEmployeeMode && (
                    <div className={styles.footerRow}>
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => { setError(''); setForgotSent(false); setForgotEmail(''); setStep('forgot'); }}
                      >
                        Забыли пароль?
                      </button>
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => { setError(''); setStep('company'); }}
                      >
                        Создать компанию
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* ── Company registration step ── */}
              {step === 'company' && (
                <form
                  className={`${styles.stepContent} ${styles.companyStepContent}`}
                  onSubmit={(e) => { e.preventDefault(); void submitCompanyRegistration(); }}
                >
                  <div className={styles.stepHeader}>
                    <h2 className={styles.title}>Регистрация компании</h2>
                    <p className={styles.subtitle}>
                      Компания создаётся сразу с правами руководителя.
                    </p>
                  </div>

                  <div className={styles.formFields}>
                    <input
                      className={styles.input}
                      value={companyName}
                      onChange={(e) => { setCompanyName(e.target.value); setError(''); }}
                      placeholder="Название компании *"
                    />
                    <input
                      className={styles.input}
                      value={companyOwnerName}
                      onChange={(e) => { setCompanyOwnerName(e.target.value); setError(''); }}
                      placeholder="ФИО руководителя *"
                      autoComplete="name"
                    />
                    <input
                      className={styles.input}
                      value={companyEmail}
                      onChange={(e) => { setCompanyEmail(e.target.value); setError(''); }}
                      placeholder="Email *"
                      autoComplete="email"
                      inputMode="email"
                      type="email"
                    />
                    <input
                      className={styles.input}
                      value={companyPhone}
                      onChange={(e) => { setCompanyPhone(formatKazakhPhoneInput(e.target.value)); setError(''); }}
                      placeholder="+7 (___) ___-__-__"
                      autoComplete="tel"
                      inputMode="tel"
                    />
                    <PasswordField
                      value={companyPassword}
                      onChange={(v) => { setCompanyPassword(v); setError(''); }}
                      placeholder="Пароль *"
                      autoComplete="new-password"
                    />
                    <PasswordField
                      value={companyPasswordConfirm}
                      onChange={(v) => { setCompanyPasswordConfirm(v); setError(''); }}
                      placeholder="Подтверждение пароля *"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className={styles.companyStepActions}>
                    {error && <div className={styles.errorMessage}>{error}</div>}

                    <button
                      type="submit"
                      className={styles.primaryButton}
                      disabled={loading}
                    >
                      <Building2 size={16} />
                      {loading ? 'Создаём компанию...' : 'Создать компанию'}
                    </button>
                  </div>
                </form>
              )}

              {/* ── Set-password step (первый вход сотрудника) ── */}
              {step === 'set-password' && (
                <div className={styles.stepContent}>
                  <SetPasswordStep
                    tempToken={firstLoginTempToken}
                    userName={firstLoginUserName}
                    onSuccess={() => setStep('password-set')}
                  />
                </div>
              )}

              {/* ── Password set — ask to re-login ── */}
              {step === 'password-set' && (
                <div className={styles.stepContent}>
                  <div style={{ textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'color-mix(in srgb, #4FC999 12%, transparent)', border: '1px solid color-mix(in srgb, #4FC999 28%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✓</div>
                    <h2 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Пароль установлен</h2>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 280 }}>
                      Войдите заново с вашим номером телефона и новым паролем, чтобы продолжить.
                    </p>
                    <button
                      type="button"
                      style={{ marginTop: 8, padding: '10px 24px', borderRadius: 8, background: 'var(--fill-accent)', border: 'none', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                      onClick={() => { setStep('login'); setFirstLoginTempToken(''); setFirstLoginUserName(''); }}
                    >
                      Войти
                    </button>
                  </div>
                </div>
              )}

              {/* ── Forgot password step ── */}
              {step === 'forgot' && (
                <form
                  className={styles.stepContent}
                  onSubmit={(e) => { e.preventDefault(); void submitForgotPassword(); }}
                >
                  <div className={styles.stepHeader}>
                    <h2 className={styles.title}>Восстановление пароля</h2>
                    <p className={styles.subtitle}>
                      Введите email, указанный при регистрации компании. Пришлём ссылку для сброса пароля.
                    </p>
                  </div>

                  {!forgotSent ? (
                    <>
                      <div className={styles.formFields}>
                        <input
                          className={styles.input}
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          value={forgotEmail}
                          onChange={(e) => { setForgotEmail(e.target.value); setError(''); }}
                          placeholder="Email *"
                          autoFocus
                        />
                      </div>
                      {error && <div className={styles.errorMessage}>{error}</div>}
                      <button type="submit" className={styles.primaryButton} disabled={loading}>
                        <KeyRound size={16} />
                        {loading ? 'Отправляем...' : 'Отправить ссылку'}
                      </button>
                    </>
                  ) : (
                    <div className={styles.pinInfo}>
                      Письмо отправлено на <strong>{forgotEmail}</strong>.<br />
                      Проверьте входящие (и папку «Спам»). Ссылка действительна 1 час.
                    </div>
                  )}
                </form>
              )}
            </div>

          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
