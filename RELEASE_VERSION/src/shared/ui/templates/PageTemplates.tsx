/**
 * Page Templates — Глава 30 рекомендаций.
 * Повторяемые схемы для сборки страниц:
 *  - EntityListPageTemplate
 *  - EntityDetailPageTemplate
 *  - AdminSettingsTemplate
 */

import type { ReactNode } from 'react';
import styles from './PageTemplates.module.css';

/* ══════════════════════════════════════════════════════════════
   EntityListPageTemplate
   Схема: header / toolbar / filters / content / pagination
   ══════════════════════════════════════════════════════════════ */
interface ListPageProps {
  /** Заголовок раздела */
  title: ReactNode;
  /** Счётчик рядом с заголовком */
  count?: number;
  /** Описание / subtitle */
  subtitle?: ReactNode;
  /** Правая зона хедера — кнопки создания, экспорта */
  actions?: ReactNode;
  /** Поиск + фильтры */
  toolbar?: ReactNode;
  /** Бар bulk actions (показывается при выборе) */
  bulkBar?: ReactNode;
  /** Основной контент — таблица / список / сетка */
  children: ReactNode;
  /** Пагинация или footer */
  footer?: ReactNode;
}

export function EntityListPageTemplate({
  title, count, subtitle, actions,
  toolbar, bulkBar, children, footer,
}: ListPageProps) {
  return (
    <div className={styles.listPage}>
      <div className={styles.listHeader}>
        <div>
          <h1 className={styles.listTitle}>
            {title}
            {count !== undefined && (
              <span className={styles.listCount}>{count}</span>
            )}
          </h1>
          {subtitle && <p className={styles.listSubtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.listActions}>{actions}</div>}
      </div>

      {toolbar && <div className={styles.listToolbar}>{toolbar}</div>}
      {bulkBar && <div className={styles.listBulkBar}>{bulkBar}</div>}

      <div className={styles.listContent}>{children}</div>

      {footer && <div className={styles.listFooter}>{footer}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EntityDetailPageTemplate
   Схема: back link / profile header / tabs / body (main + sidebar)
   ══════════════════════════════════════════════════════════════ */
interface DetailPageProps {
  /** Кнопка "назад" */
  backLink?: ReactNode;
  /** Верхний блок с идентичностью сущности */
  header: ReactNode;
  /** Таб-переключатель */
  tabs?: ReactNode;
  /** Основной контент (левая колонка) */
  main: ReactNode;
  /** Боковая панель (правая колонка, desktop) */
  sidebar?: ReactNode;
}

export function EntityDetailPageTemplate({
  backLink, header, tabs, main, sidebar,
}: DetailPageProps) {
  return (
    <div className={styles.detailPage}>
      {backLink && <div className={styles.detailBack}>{backLink}</div>}
      <div className={styles.detailHeader}>{header}</div>
      {tabs && <div className={styles.detailTabs}>{tabs}</div>}
      <div className={sidebar ? styles.detailBodyWithSidebar : styles.detailBody}>
        <div className={styles.detailMain}>{main}</div>
        {sidebar && <aside className={styles.detailSidebar}>{sidebar}</aside>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AdminSettingsTemplate
   Схема: боковая навигация + контент
   ══════════════════════════════════════════════════════════════ */
interface SettingsTemplateProps {
  nav: ReactNode;
  children: ReactNode;
}

export function AdminSettingsTemplate({ nav, children }: SettingsTemplateProps) {
  return (
    <div className={styles.settingsPage}>
      <aside className={styles.settingsNav}>{nav}</aside>
      <div className={styles.settingsContent}>{children}</div>
    </div>
  );
}
