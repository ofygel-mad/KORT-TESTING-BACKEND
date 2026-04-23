import { useState } from 'react';
import { ArrowRight, CheckCircle2, Globe, BarChart3, Zap, Lock, Users, FileText } from 'lucide-react';
import { KortLogo } from '../../shared/ui/KortLogo';
import s from './Landing.module.css';

const FEATURES = [
  {
    title: 'CRM',
    color: '#5C8DFF',
    icon: Users,
  },
  {
    title: 'Склад',
    color: '#4A8BD4',
    icon: Globe,
  },
  {
    title: 'Финансы',
    color: '#10B981',
    icon: BarChart3,
  },
  {
    title: 'Рабочие зоны',
    color: '#7C3AED',
    icon: Zap,
  },
  {
    title: 'Документы',
    color: '#F59E0B',
    icon: FileText,
  },
  {
    title: 'Аналитика',
    color: '#EC4899',
    icon: BarChart3,
  },
];

const PLANS = [
  {
    title: 'Базовый',
    subtitle: 'Для малого бизнеса',
    price: null,
    features: ['Единая база клиентов и лидов', 'Управление складом', 'Настройка команды'],
  },
  {
    title: 'Продвинутый',
    subtitle: 'Для растущей команды',
    price: null,
    featured: true,
    badge: 'Рекомендуем',
    features: ['Воронки продаж и этапы сделок', 'Задачи и контроль исполнения', 'Финансы и аналитика', 'Управление сотрудниками'],
  },
  {
    title: 'Промышленный',
    subtitle: 'Для сложных процессов',
    price: null,
    features: ['Всё из «Продвинутого»', 'Кастомные рабочие зоны', 'API и расширенный аудит', 'Индивидуальные интеграции'],
  },
];

export default function LandingPage() {
  const [screenshotTab, setScreenshotTab] = useState(0);
  const [email, setEmail] = useState('');

  return (
    <div className={s.page}>
      {/* ── Fixed Navigation ──────────────────────────────────────────── */}
      <nav className={s.nav}>
        <div className={s.navContent}>
          <div className={s.navBrand}>
            <KortLogo size={28} />
            <span className={s.navBrandText}>KORT</span>
          </div>
          <div className={s.navLinks}>
            <a href="#features" className={s.navLink}>
              Возможности
            </a>
            <a href="#pricing" className={s.navLink}>
              Тарифы
            </a>
          </div>
          <div className={s.navActions}>
            <button className={s.navButtonSecondary}>Вход</button>
            <button className={s.navButtonPrimary}>Начать бесплатно</button>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <section className={s.hero}>
        <div className={s.heroContent}>
          <div className={s.heroBadge}>🇰🇿 Казахстанская разработка</div>
          <h1 className={s.heroTitle}>
            Управляйте бизнесом в <span className={s.accent}>едином контуре</span>
          </h1>
          <p className={s.heroSubtitle}>
            ERP-система нового поколения для малого и среднего бизнеса. Всё, что нужно для продаж, логистики и аналитики, в одном месте.
          </p>
          <div className={s.heroActions}>
            <button className={s.buttonPrimary}>Начать бесплатно</button>
            <button className={s.buttonSecondary}>Смотреть видео</button>
          </div>
        </div>

        <div className={s.heroScreenshot}>
          <div className={s.browserChrome}>
            <div className={s.browserHeader}>
              <div className={s.browserDots}></div>
              <div className={s.browserUrl}>kort.app</div>
            </div>
            <div className={s.browserContent} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <div className={s.placeholderIcon}>📊</div>
              <div className={s.placeholderText}>Скриншот приложения</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Metrics Strip ─────────────────────────────────────────────── */}
      <section className={s.metrics}>
        <div className={s.metricsGrid}>
          <div className={s.metricItem}>
            <div className={s.metricValue}>500+</div>
            <div className={s.metricLabel}>Компаний используют KORT</div>
          </div>
          <div className={s.metricItem}>
            <div className={s.metricValue}>50K+</div>
            <div className={s.metricLabel}>Сотрудников работают на платформе</div>
          </div>
          <div className={s.metricItem}>
            <div className={s.metricValue}>99.9%</div>
            <div className={s.metricLabel}>Uptime и безопасность</div>
          </div>
        </div>
      </section>

      {/* ── Features Section ──────────────────────────────────────────── */}
      <section className={s.features} id="features">
        <div className={s.sectionHead}>
          <h2 className={s.sectionTitle}>Всё, что нужно для работы</h2>
          <p className={s.sectionDesc}>Модульная архитектура подходит для торговли, сервиса, производства и B2B</p>
        </div>

        <div className={s.featuresGrid}>
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className={s.featureCard}>
                <div className={s.featureIcon} style={{ '--feature-color': feature.color } as React.CSSProperties}>
                  <Icon size={24} />
                </div>
                <h3 className={s.featureTitle}>{feature.title}</h3>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Pricing Section ───────────────────────────────────────────── */}
      <section className={s.pricing} id="pricing">
        <div className={s.sectionHead}>
          <h2 className={s.sectionTitle}>Прозрачные тарифы</h2>
          <p className={s.sectionDesc}>Выбирайте режим в зависимости от роста вашего бизнеса</p>
        </div>

        <div className={s.pricingGrid}>
          {PLANS.map((plan) => (
            <div
              key={plan.title}
              className={`${s.priceCard} ${plan.featured ? s.priceFeatured : ''}`}
            >
              {plan.badge && <div className={s.priceBadge}>{plan.badge}</div>}
              <h3 className={s.planTitle}>{plan.title}</h3>
              <p className={s.planSubtitle}>{plan.subtitle}</p>

              <ul className={s.planFeatures}>
                {plan.features.map((feature) => (
                  <li key={feature} className={s.planFeature}>
                    <CheckCircle2 size={16} />
                    {feature}
                  </li>
                ))}
              </ul>

              <button className={plan.featured ? s.buttonPrimary : s.buttonSecondary} style={{ width: '100%' }}>
                Выбрать план
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────── */}
      <section className={s.ctaBanner}>
        <h2 className={s.ctaTitle}>Начните работу сегодня</h2>
        <p className={s.ctaDesc}>Присоединитесь к 500+ компаниям, которые уже используют KORT</p>

        <form className={s.ctaForm} onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            placeholder="Ваш email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={s.ctaInput}
          />
          <button type="submit" className={s.buttonPrimary}>
            Начать бесплатно
          </button>
        </form>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className={s.footer}>
        <div className={s.footerContent}>
          <div className={s.footerBrand}>
            <KortLogo size={24} />
            <span className={s.footerBrandText}>KORT</span>
          </div>
          <div className={s.footerLinks}>
            <a href="#" className={s.footerLink}>
              О компании
            </a>
            <a href="#" className={s.footerLink}>
              Документация
            </a>
            <a href="#" className={s.footerLink}>
              Контакты
            </a>
          </div>
          <div className={s.footerCopy}>© 2026 KORT. Все права защищены.</div>
        </div>
      </footer>
    </div>
  );
}
