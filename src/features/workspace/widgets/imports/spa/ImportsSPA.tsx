import { useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  FileSpreadsheet,
  Filter,
  GitMerge,
  History,
  RefreshCw,
  Search,
  Settings,
  Upload,
} from 'lucide-react';
import s from './ImportsSPA.module.css';

interface Props {
  tileId: string;
}

type SectionId = 'upload' | 'mapping' | 'history' | 'settings';
type ImportStatus = 'done' | 'error' | 'pending';
type StatusTone = 'positive' | 'danger' | 'warning';

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof Upload }> = [
  { id: 'upload', label: 'Загрузка', icon: ArrowDownToLine },
  { id: 'mapping', label: 'Маппинг', icon: GitMerge },
  { id: 'history', label: 'История', icon: History },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

const MOCK_IMPORTS: Array<{ id: string; name: string; status: ImportStatus; rows: number; date: string }> = [
  { id: '1', name: 'clients_march.xlsx', status: 'done', rows: 142, date: '14 мар 2026' },
  { id: '2', name: 'deals_q1.csv', status: 'error', rows: 0, date: '13 мар 2026' },
  { id: '3', name: 'contacts_2025.xlsx', status: 'done', rows: 891, date: '02 мар 2026' },
];

const STATUS_META: Record<ImportStatus, { label: string; Icon: typeof Check; tone: StatusTone }> = {
  done: { label: 'Загружено', Icon: Check, tone: 'positive' },
  error: { label: 'Ошибка', Icon: AlertCircle, tone: 'danger' },
  pending: { label: 'В очереди', Icon: RefreshCw, tone: 'warning' },
};

const STATUS_CLASS: Record<StatusTone, string> = {
  positive: s.statusPositive,
  danger: s.statusDanger,
  warning: s.statusWarning,
};

function UploadSection() {
  const [dragging, setDragging] = useState(false);

  return (
    <div className={s.uploadSection}>
      <div
        className={`${s.dropzone} ${dragging ? s.dropzoneActive : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
      >
        <div className={s.dropIconWrap}>
          <Upload size={24} className={s.dropIcon} />
        </div>
        <span className={s.dropTitle}>Перетащите файл или выберите его вручную</span>
        <span className={s.dropSub}>Excel (.xlsx), CSV или JSON до 50 МБ</span>
        <button className={s.dropBtn}>Выбрать файл</button>
      </div>

      <div className={s.recentSection}>
        <div className={s.sectionLabel}>Последние загрузки</div>
        <div className={s.importList}>
          {MOCK_IMPORTS.map((item) => {
            const meta = STATUS_META[item.status];
            return (
              <div key={item.id} className={s.importRow}>
                <div className={s.fileIconWrap}>
                  <FileSpreadsheet size={18} className={s.fileIcon} />
                </div>
                <div className={s.importBody}>
                  <span className={s.importName}>{item.name}</span>
                  <span className={s.importMeta}>
                    {item.date}
                    {item.rows > 0 ? ` · ${item.rows} строк` : ''}
                  </span>
                </div>
                <span className={`${s.importStatus} ${STATUS_CLASS[meta.tone]}`}>
                  <meta.Icon size={12} />
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SectionPlaceholder({ section }: { section: (typeof SECTIONS)[number] }) {
  const Icon = section.icon;

  return (
    <div className={s.placeholder}>
      <div className={s.placeholderIconWrap}>
        <Icon size={26} className={s.placeholderIcon} />
      </div>
      <div className={s.placeholderTitle}>{section.label}</div>
      <div className={s.placeholderDesc}>Раздел уже подготовлен и ждёт подключения рабочего сценария.</div>
    </div>
  );
}

export function ImportsSPA({ tileId }: Props) {
  const [activeSection, setActiveSection] = useState<SectionId>('upload');
  const currentSection = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0];

  return (
    <div className={s.root} data-tile-id={tileId}>
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.headerIconWrap}>
            <ArrowDownToLine size={16} className={s.headerIcon} />
          </div>
          <div className={s.headerCopy}>
            <span className={s.headerEyebrow}>Import Desk</span>
            <span className={s.title}>Импорт</span>
          </div>
        </div>
        <div className={s.headerActions}>
          <button className={s.iconBtn} aria-label="Поиск">
            <Search size={15} />
          </button>
          <button className={s.iconBtn} aria-label="Фильтры">
            <Filter size={15} />
          </button>
          <button className={s.syncBtn}>
            <RefreshCw size={13} />
            <span>Синхронизировать</span>
          </button>
        </div>
      </div>

      <nav className={s.nav}>
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            className={`${s.navItem} ${activeSection === section.id ? s.navItemActive : ''}`}
            onClick={() => setActiveSection(section.id)}
          >
            <section.icon size={14} />
            <span>{section.label}</span>
          </button>
        ))}
      </nav>

      <div className={s.content}>
        {activeSection === 'upload' ? <UploadSection /> : <SectionPlaceholder section={currentSection} />}
      </div>

      <div className={s.statusBar}>
        <span className={s.statusDot} />
        <span>Подключение активно</span>
        <span className={s.statusCount}>3 файла загружено</span>
      </div>
    </div>
  );
}
