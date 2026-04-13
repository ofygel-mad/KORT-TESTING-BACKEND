import { setProductMoment } from '../../shared/utils/productMoment';
import { useState, type ReactNode, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { successBurst } from '../../shared/motion/presets';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Blocks,
  CheckCircle2,
  ChevronRight,
  Factory,
  HandCoins,
  LayoutDashboard,
  Store,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { KortLogo } from '../../shared/ui/KortLogo';
import { useAuthStore } from '../../shared/stores/auth';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { toast } from 'sonner';
import s from './Onboarding.module.css';

const BUSINESS_TYPES = [
  {
    value: 'retail',
    label: 'Розничная торговля',
    description: 'Точки продаж, онлайн-заказы и повторные покупки в одном контуре.',
    icon: Store,
    color: '#D97706',
  },
  {
    value: 'services',
    label: 'Услуги',
    description: 'Запись клиентов, повторные касания и контроль сервиса.',
    icon: HandCoins,
    color: '#5C8DFF',
  },
  {
    value: 'sales',
    label: 'B2B и продажи',
    description: 'Лиды, переговоры и коммерческие предложения без ручной рутины.',
    icon: BriefcaseBusiness,
    color: '#2E9D84',
  },
  {
    value: 'production',
    label: 'Производство',
    description: 'Длинный цикл сделки, согласования и контроль этапов исполнения.',
    icon: Factory,
    color: '#7C3AED',
  },
  {
    value: 'other',
    label: 'Другое направление',
    description: 'Гибкая настройка под ваш процесс без жёсткого шаблона.',
    icon: Blocks,
    color: '#8FA4C8',
  },
] as const;

const SIZES = [
  { value: '1_5', label: '1–5' },
  { value: '6_20', label: '6–20' },
  { value: '21_100', label: '21–100' },
  { value: '100_plus', label: '100+' },
] as const;

interface PlanModuleTag {
  label: string;
  color: string;
}

interface ModeCard {
  mode: string;
  title: string;
  subtitle: string;
  for: string;
  features: string[];
  modules: PlanModuleTag[];
  icon: ReactNode;
  color: string;
  badge?: string;
  callout?: string;
}

const MODES: ModeCard[] = [
  {
    mode: 'basic',
    title: 'Базовый',
    subtitle: 'Для малого бизнеса',
    for: 'Команды до 20 человек, которые только начинают работать с CRM',
    features: ['Единая база клиентов и лидов', 'Управление складом', 'Настройка команды'],
    modules: [
      { label: 'Лиды', color: '#5C8DFF' },
      { label: 'Клиенты', color: '#5C8DFF' },
      { label: 'Склад', color: '#C9A84C' },
    ],
    icon: <Users size={20} />,
    color: '#5C8DFF',
  },
  {
    mode: 'advanced',
    title: 'Продвинутый',
    subtitle: 'Для растущей команды',
    for: 'Бизнес с активными продажами, аналитикой и разделением ролей',
    features: ['Воронки продаж и этапы сделок', 'Задачи и контроль исполнения', 'Финансы и аналитика', 'Управление сотрудниками'],
    modules: [
      { label: 'Лиды', color: '#5C8DFF' },
      { label: 'Сделки', color: '#D97706' },
      { label: 'Клиенты', color: '#5C8DFF' },
      { label: 'Задачи', color: '#2E9D84' },
      { label: 'Склад', color: '#C9A84C' },
      { label: 'Финансы', color: '#2E9D84' },
    ],
    icon: <Zap size={20} />,
    color: '#D97706',
    badge: 'Рекомендуем',
  },
  {
    mode: 'industrial',
    title: 'Промышленный',
    subtitle: 'Для сложных процессов',
    for: 'Производства и предприятия с уникальными операционными цепочками',
    features: ['Всё из «Продвинутого»', 'Кастомные рабочие зоны', 'Индивидуальные интеграции', 'API и расширенный аудит'],
    modules: [
      { label: 'Все модули', color: '#7C3AED' },
      { label: 'Кабинеты', color: '#7C3AED' },
    ],
    icon: <Factory size={20} />,
    color: '#7C3AED',
    callout: 'Индивидуальная интеграция',
  },
] as const;

const STEPS = ['Ваш бизнес', 'Режим KORT', 'Готово'];

const QUICK_LINKS: Array<{
  icon: LucideIcon;
  title: string;
  desc: string;
  path: string;
}> = [
  {
    icon: UserPlus,
    title: 'Добавьте первого клиента',
    desc: 'Создайте карточку вручную или перенесите базу из Excel.',
    path: '/crm/customers',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Создайте первую сделку',
    desc: 'Сразу перенесите первый входящий запрос в рабочую воронку.',
    path: '/crm/deals',
  },
] as const;

export default function OnboardingPage() {
  useDocumentTitle('Начало работы');

  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setOrg = useAuthStore((state) => state.setOrg);
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState('');
  const [companySize, setSize] = useState('');
  const [selectedMode, setMode] = useState('advanced');

  const setupMutation = useMutation({
    mutationFn: ({
      nextPath,
      ...data
    }: {
      nextPath: string;
      mode: string;
      industry: string;
      company_size: string;
      onboarding_completed: boolean;
    }) => api.patch('/organization/', data),
    onSuccess: (updated: any, variables) => {
      setOrg({ onboarding_completed: true, ...(updated ?? {}) });
      const modeLabel = MODES.find((item) => item.mode === selectedMode)?.title ?? 'Ваш режим';
      const businessLabel = BUSINESS_TYPES.find((item) => item.value === industry)?.label ?? 'ваш бизнес';
      const nextPath = variables?.nextPath ?? '/';
      const handoffMap: Record<string, string> = {
        '/': `Онбординг завершён · ${modeLabel} для направления «${businessLabel}» уже собран в KORT. Сначала проверьте входящий поток, затем создайте первую рабочую сущность.`,
        '/crm/customers': 'Онбординг завершён · начните с клиентов, чтобы быстро превратить контекст бизнеса в рабочую базу.',
        '/crm/deals': 'Онбординг завершён · переходите к первой сделке, пока логика продаж ещё свежа после настройки.',
      };
      setProductMoment(handoffMap[nextPath] ?? handoffMap['/']);
      toast.success('Настройки сохранены');
      navigate(nextPath, { replace: true });
    },
  });

  const canNext = step === 0 ? industry !== '' && companySize !== '' : true;

  function handleFinish(nextPath = '/') {
    setupMutation.mutate({
      nextPath,
      mode: selectedMode,
      industry,
      company_size: companySize,
      onboarding_completed: true,
    });
  }

  function handleQuickLink(path: string) {
    handleFinish(path);
  }

  return (
    <div className={s.root}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className={s.header}>
        <motion.div
          className={s.headerBrand}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <KortLogo size={28} />
          <span className={s.headerWordmark}>KORT</span>
        </motion.div>
        <motion.div
          className={s.headerStep}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className={s.headerStepDots}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`${s.headerDot} ${i === step ? s.headerDotActive : i < step ? s.headerDotDone : s.headerDotPending}`}
              />
            ))}
          </span>
          <span className={s.headerStepLabel}>{STEPS[step]}</span>
        </motion.div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className={s.main}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            className={`${s.content} ${step === 1 ? s.contentWide : s.contentNarrow}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* ── Step 0: Business Type ──────────────────────────────── */}
            {step === 0 && (
              <>
                <div className={s.stepHead}>
                  <p className={s.eyebrow}>Настройка рабочего контура</p>
                  <h1 className={s.title}>Расскажите о вашем бизнесе</h1>
                  <p className={s.desc}>
                    Kort не привязывает интерфейс к одному шаблону — нам нужен только стартовый контекст,
                    чтобы открыть нужные модули и убрать лишние.
                  </p>
                </div>

                <p className={s.fieldLabel}>Тип бизнеса</p>
                <div className={s.industryGrid}>
                  {BUSINESS_TYPES.map((item) => {
                    const Icon = item.icon;
                    const isSelected = industry === item.value;
                    return (
                      <motion.button
                        key={item.value}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => setIndustry(item.value)}
                        className={`${s.industryCard} ${isSelected ? s.industryCardSelected : ''}`}
                        style={{ '--item-color': item.color } as CSSProperties}
                      >
                        <span className={s.industryCardIcon}>
                          <Icon size={18} />
                        </span>
                        <span className={s.industryCardMeta}>
                          <span className={`${s.industryCardLabel} ${isSelected ? s.industryCardLabelSelected : ''}`}>
                            {item.label}
                          </span>
                          <span className={s.industryCardDesc}>{item.description}</span>
                        </span>
                        {isSelected && (
                          <span className={s.industryCardCheck}>
                            <CheckCircle2 size={16} />
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                <p className={s.fieldLabel}>Размер команды</p>
                <div className={s.sizePills}>
                  {SIZES.map((item) => (
                    <motion.button
                      key={item.value}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSize(item.value)}
                      className={`${s.sizePill} ${companySize === item.value ? s.sizePillSelected : ''}`}
                    >
                      {item.label}
                    </motion.button>
                  ))}
                </div>
              </>
            )}

            {/* ── Step 1: Plan Selection ─────────────────────────────── */}
            {step === 1 && (
              <>
                <div className={s.stepHead}>
                  <p className={s.eyebrow}>Режим продукта</p>
                  <h1 className={s.title}>Выберите режим KORT</h1>
                  <p className={s.desc}>
                    Режим определяет, какие модули откроются для вашей команды. Изменить можно позже в настройках.
                  </p>
                </div>

                <div className={s.planGrid}>
                  {MODES.map((mode) => {
                    const isSelected = selectedMode === mode.mode;
                    return (
                      <motion.button
                        key={mode.mode}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => setMode(mode.mode)}
                        className={`${s.planCard} ${isSelected ? s.planCardSelected : ''}`}
                        style={{
                          '--plan-color': mode.color,
                        } as CSSProperties}
                      >
                        {mode.badge && (
                          <span className={s.planBadgeTop}>{mode.badge}</span>
                        )}
                        <div className={s.planCardIcon}>{mode.icon}</div>
                        <div className={s.planCardTitle}>{mode.title}</div>
                        <div className={s.planCardSubtitle}>{mode.subtitle}</div>
                        <div className={s.planCardFor}>{mode.for}</div>

                        <ul className={s.planFeatureList}>
                          {mode.features.map((f) => (
                            <li key={f} className={s.planFeatureItem}>
                              <span className={s.planFeatureDot} />
                              {f}
                            </li>
                          ))}
                        </ul>

                        {mode.callout && (
                          <div className={s.planCallout}>{mode.callout}</div>
                        )}

                        <div className={s.planModules}>
                          {mode.modules.map((mod) => (
                            <span
                              key={mod.label}
                              className={s.planModuleTag}
                              style={{ '--mod-color': mod.color } as CSSProperties}
                            >
                              {mod.label}
                            </span>
                          ))}
                        </div>

                        {isSelected && (
                          <div className={s.planCardCheckmark}>
                            <CheckCircle2 size={16} />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Step 2: Success ───────────────────────────────────── */}
            {step === 2 && (
              <>
                <motion.div
                  className={s.successBlock}
                  variants={successBurst}
                  initial="hidden"
                  animate="visible"
                >
                  <div className={s.successIcon}>
                    <CheckCircle2 size={40} />
                  </div>
                  <h1 className={s.successTitle}>Вы готовы к работе</h1>
                  <p className={s.successDesc}>
                    Привет, {user?.full_name?.split(' ')[0] ?? 'друг'}! KORT настроен и уже готов к первому полезному действию.
                  </p>
                </motion.div>

                <div className={s.successActions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<LayoutDashboard size={14} />}
                    onClick={() => handleFinish('/')}
                  >
                    Открыть KORT Home
                  </Button>
                  <span className={s.successHint}>Или перейдите сразу в первый рабочий сценарий:</span>
                </div>

                <div className={s.quickLinks}>
                  {QUICK_LINKS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <motion.button
                        key={item.title}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => handleQuickLink(item.path)}
                        className={s.quickLinkBtn}
                      >
                        <span className={s.quickLinkIcon}>
                          <Icon size={18} />
                        </span>
                        <div className={s.quickLinkBody}>
                          <div className={s.quickLinkTitle}>{item.title}</div>
                          <div className={s.quickLinkDesc}>{item.desc}</div>
                        </div>
                        <ChevronRight size={16} className={s.quickLinkChevron} />
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Footer Nav ──────────────────────────────────────────────── */}
      <footer className={s.footer}>
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={14} />}
          onClick={() => step > 0 && setStep(step - 1)}
          className={step === 0 ? s.footerBackHidden : undefined}
        >
          Назад
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            disabled={!canNext}
            iconRight={<ChevronRight size={14} />}
            onClick={() => setStep(step + 1)}
          >
            Продолжить
          </Button>
        ) : (
          <Button loading={setupMutation.isPending} onClick={() => handleFinish('/')}>
            Начать работу
          </Button>
        )}
      </footer>
    </div>
  );
}
