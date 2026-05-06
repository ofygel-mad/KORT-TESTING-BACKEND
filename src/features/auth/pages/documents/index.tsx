import { useState } from 'react';
import {
  FileText, FileSpreadsheet, FileCheck2, Receipt, Handshake,
  ClipboardList, FileBadge, Lock,
} from 'lucide-react';
import { InvoiceModal } from './InvoiceModal';
import styles from './Documents.module.css';

// ── Document catalog definition ───────────────────────────────────────────────

interface DocItem {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  available: boolean;
  action?: () => void;
}

interface DocSection {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string; // CSS custom property value
  docs: DocItem[];
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const SECTIONS: DocSection[] = [
    {
      id: 'production',
      title: 'Производство',
      subtitle: 'Документы по заказам и отправке',
      icon: FileSpreadsheet,
      color: '#1A6B3C',
      docs: [
        {
          id: 'invoice',
          label: 'Накладная',
          desc: 'Товарная накладная по готовому заказу',
          icon: FileText,
          available: true,
          action: () => setInvoiceOpen(true),
        },
        {
          id: 'packing-list',
          label: 'Упаковочный лист',
          desc: 'Список позиций по отправлению',
          icon: ClipboardList,
          available: false,
        },
      ],
    },
    {
      id: 'contracts',
      title: 'Договоры',
      subtitle: 'Соглашения с клиентами и поставщиками',
      icon: Handshake,
      color: '#3B6DB5',
      docs: [
        {
          id: 'contract-supply',
          label: 'Договор поставки',
          desc: 'Стандартный договор на поставку товара',
          icon: FileText,
          available: false,
        },
        {
          id: 'contract-service',
          label: 'Договор оказания услуг',
          desc: 'Договор на выполнение работ',
          icon: FileText,
          available: false,
        },
        {
          id: 'contract-agency',
          label: 'Агентский договор',
          desc: 'Договор агентирования',
          icon: FileText,
          available: false,
        },
      ],
    },
    {
      id: 'acts',
      title: 'Акты',
      subtitle: 'Закрывающие документы',
      icon: FileCheck2,
      color: '#7C4AB5',
      docs: [
        {
          id: 'act-work',
          label: 'Акт выполненных работ',
          desc: 'Акт приёмки-передачи выполненных работ',
          icon: FileCheck2,
          available: false,
        },
        {
          id: 'act-service',
          label: 'Акт оказанных услуг',
          desc: 'Подтверждение оказания услуг',
          icon: FileCheck2,
          available: false,
        },
        {
          id: 'act-acceptance',
          label: 'Акт приёма-передачи',
          desc: 'Акт передачи товара или объекта',
          icon: FileCheck2,
          available: false,
        },
      ],
    },
    {
      id: 'financial',
      title: 'Финансовые',
      subtitle: 'Счета, квитанции и сверки',
      icon: Receipt,
      color: '#B56A1A',
      docs: [
        {
          id: 'invoice-payment',
          label: 'Счёт на оплату',
          desc: 'Счёт для выставления клиенту',
          icon: Receipt,
          available: false,
        },
        {
          id: 'reconciliation',
          label: 'Акт сверки',
          desc: 'Сверка взаиморасчётов с контрагентом',
          icon: FileBadge,
          available: false,
        },
      ],
    },
  ];

  return (
    <div className={styles.root}>
      {/* Page header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Документы</h1>
          <p className={styles.subtitle}>Генерация и скачивание рабочих документов</p>
        </div>
      </div>

      {/* Sections grid */}
      <div className={styles.grid}>
        {SECTIONS.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>

      {/* Modals */}
      {invoiceOpen && <InvoiceModal onClose={() => setInvoiceOpen(false)} />}
    </div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({ section }: { section: DocSection }) {
  return (
    <div className={styles.sectionCard}>
      {/* Section header */}
      <div className={styles.sectionHeader} style={{ '--section-color': section.color } as React.CSSProperties}>
        <div className={styles.sectionIconWrap} style={{ background: section.color + '18', color: section.color }}>
          <section.icon size={18} />
        </div>
        <div>
          <div className={styles.sectionTitle}>{section.title}</div>
          <div className={styles.sectionSubtitle}>{section.subtitle}</div>
        </div>
      </div>

      {/* Document list */}
      <div className={styles.docList}>
        {section.docs.map((doc) => (
          <DocButton key={doc.id} doc={doc} accentColor={section.color} />
        ))}
      </div>
    </div>
  );
}

// ── Doc Button ────────────────────────────────────────────────────────────────

function DocButton({ doc, accentColor }: { doc: DocItem; accentColor: string }) {
  if (!doc.available) {
    return (
      <div className={`${styles.docBtn} ${styles.docBtnDisabled}`}>
        <div className={styles.docBtnIcon} style={{ color: '#B0B8C8' }}>
          <doc.icon size={15} />
        </div>
        <div className={styles.docBtnText}>
          <span className={styles.docBtnLabel}>{doc.label}</span>
          <span className={styles.docBtnDesc}>{doc.desc}</span>
        </div>
        <div className={styles.devBadge}>
          <Lock size={10} />
          <span>в разработке</span>
        </div>
      </div>
    );
  }

  return (
    <button
      className={styles.docBtn}
      onClick={doc.action}
      style={{ '--doc-accent': accentColor } as React.CSSProperties}
    >
      <div className={styles.docBtnIcon} style={{ color: accentColor, background: accentColor + '14' }}>
        <doc.icon size={15} />
      </div>
      <div className={styles.docBtnText}>
        <span className={styles.docBtnLabel}>{doc.label}</span>
        <span className={styles.docBtnDesc}>{doc.desc}</span>
      </div>
      <div className={styles.docBtnArrow} style={{ color: accentColor }}>
        ↗
      </div>
    </button>
  );
}
