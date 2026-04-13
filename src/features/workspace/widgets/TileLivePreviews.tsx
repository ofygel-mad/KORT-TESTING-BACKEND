/**
 * TileLivePreviews.tsx
 * Compact live-preview components for workspace tiles (~244×102px).
 * Each component fetches real data from entity query hooks.
 */
import { Factory, FolderOpen } from 'lucide-react';
import { useLeads } from '../../../entities/lead/queries';
import { useDeals } from '../../../entities/deal/queries';
import { useCustomers } from '../../../entities/customer/queries';
import { useTasks } from '../../../entities/task/queries';
import { useWarehouseSummary, useWarehouseAlerts } from '../../../entities/warehouse/queries';
import { useFinanceSummary } from '../../../entities/finance/queries';
import { useEmployees } from '../../../entities/employee/queries';
import { useOrders } from '../../../entities/order/queries';
import s from './TileLivePreviews.module.css';

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(Math.round(n));
}

// ── Leads ─────────────────────────────────────────────────────────────────────

const LEAD_STAGE_LABEL: Record<string, string> = {
  new: 'Новый', in_progress: 'В работе', won: 'Закрыт', lost: 'Отказ',
};
const LEAD_STAGE_TONE: Record<string, string> = {
  new: 'accent', in_progress: 'warning', won: 'success', lost: 'danger',
};

export function LeadsTilePreview({ tileId: _ }: { tileId: string }) {
  const { data, isLoading } = useLeads({ limit: 50 });
  const leads = data?.results ?? [];
  const qualLeads = leads.filter(l => l.pipeline === 'qualifier');
  const total = leads.length;
  const inProgress = leads.filter(l => l.stage === 'in_progress').length;
  const overdue = leads.filter(l =>
    l.stage !== 'won' && l.stage !== 'lost' &&
    (Date.now() - new Date(l.updatedAt).getTime()) / 3_600_000 > 24,
  ).length;
  const recent = qualLeads.slice(0, 3);

  if (isLoading && leads.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.statsRow}>
          <span className={s.chip} data-tone="muted">Загрузка…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.statsRow}>
        <span className={s.chip} data-tone="accent">{total} лидов</span>
        {inProgress > 0 && <span className={s.chip} data-tone="warning">{inProgress} в работе</span>}
        {overdue > 0 && <span className={s.chip} data-tone="danger">{overdue} просроч.</span>}
      </div>
      <div className={s.list}>
        {recent.length === 0
          ? <span className={s.empty}>Нет лидов</span>
          : recent.map(l => (
            <div key={l.id} className={s.row}>
              <span className={s.rowDot} data-tone={LEAD_STAGE_TONE[l.stage] ?? 'muted'} />
              <span className={s.rowName}>{l.fullName}</span>
              <span className={s.rowMeta}>{LEAD_STAGE_LABEL[l.stage] ?? l.stage}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Deals ─────────────────────────────────────────────────────────────────────

const DEAL_STAGE_LABEL: Record<string, string> = {
  new: 'Новая', qualified: 'Квалиф.', proposal: 'КП',
  negotiation: 'Перегов.', won: 'Закрыта', lost: 'Отказ',
};
const DEAL_STAGE_TONE: Record<string, string> = {
  new: 'muted', qualified: 'accent', proposal: 'warning',
  negotiation: 'warning', won: 'success', lost: 'danger',
};

export function DealsTilePreview({ tileId: _ }: { tileId: string }) {
  const { data, isLoading } = useDeals({ limit: 50 });
  const deals = data?.results ?? [];
  const active = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
  const totalValue = active.reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const won = deals.filter(d => d.stage === 'won').length;
  const recent = active.slice(0, 3);

  if (isLoading && deals.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.statsRow}>
          <span className={s.chip} data-tone="muted">Загрузка…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.statsRow}>
        <span className={s.chip} data-tone="accent">{active.length} активных</span>
        {totalValue > 0 && <span className={s.chip} data-tone="warning">~{fmtNum(totalValue)} ₸</span>}
        {won > 0 && <span className={s.chip} data-tone="success">{won} закрыто</span>}
      </div>
      <div className={s.list}>
        {recent.length === 0
          ? <span className={s.empty}>Нет сделок</span>
          : recent.map(d => (
            <div key={d.id} className={s.row}>
              <span className={s.rowDot} data-tone={DEAL_STAGE_TONE[d.stage] ?? 'muted'} />
              <span className={s.rowName}>{d.title || d.fullName || '—'}</span>
              <span className={s.rowMeta}>{DEAL_STAGE_LABEL[d.stage] ?? d.stage}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Customers ─────────────────────────────────────────────────────────────────

export function CustomersTilePreview({ tileId: _ }: { tileId: string }) {
  const { data, isLoading } = useCustomers({ limit: 50 });
  const customers = data?.results ?? [];
  const total = data?.count ?? customers.length;
  const recent = customers.slice(0, 3);

  if (isLoading && customers.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.statsRow}>
          <span className={s.chip} data-tone="muted">Загрузка…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.statsRow}>
        <span className={s.chip} data-tone="accent">{total} клиентов</span>
      </div>
      <div className={s.list}>
        {recent.length === 0
          ? <span className={s.empty}>Нет клиентов</span>
          : recent.map(c => (
            <div key={c.id} className={s.row}>
              <span className={s.rowDot} data-tone="accent" />
              <span className={s.rowName}>{c.full_name}</span>
              {c.company_name && <span className={s.rowMeta}>{c.company_name}</span>}
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

const TASK_STATUS_TONE: Record<string, string> = {
  backlog: 'muted', in_progress: 'accent', review: 'warning', done: 'success',
};
const TASK_STATUS_LABEL: Record<string, string> = {
  backlog: 'Бэклог', in_progress: 'В работе', review: 'Ревью', done: 'Готово',
};
const TASK_PRIORITY_TONE: Record<string, string> = {
  low: 'muted', medium: 'accent', high: 'warning', critical: 'danger',
};

export function TasksTilePreview({ tileId: _ }: { tileId: string }) {
  const { data, isLoading } = useTasks({ limit: 50 });
  const tasks = data?.results ?? [];
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const backlog = tasks.filter(t => t.status === 'backlog').length;
  const overdue = tasks.filter(t =>
    t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date(),
  ).length;
  const activeTasks = tasks.filter(t => t.status !== 'done').slice(0, 3);

  if (isLoading && tasks.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.statsRow}>
          <span className={s.chip} data-tone="muted">Загрузка…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.statsRow}>
        {inProgress > 0 && <span className={s.chip} data-tone="accent">{inProgress} в работе</span>}
        {backlog > 0 && <span className={s.chip} data-tone="muted">{backlog} в беклоге</span>}
        {overdue > 0 && <span className={s.chip} data-tone="danger">{overdue} просроч.</span>}
        {tasks.length === 0 && <span className={s.chip} data-tone="muted">0 задач</span>}
      </div>
      <div className={s.list}>
        {activeTasks.length === 0
          ? <span className={s.empty}>Нет активных задач</span>
          : activeTasks.map(t => (
            <div key={t.id} className={s.row}>
              <span className={s.rowDot} data-tone={TASK_PRIORITY_TONE[t.priority] ?? 'muted'} />
              <span className={s.rowName}>{t.title}</span>
              <span className={s.rowMeta}>{TASK_STATUS_LABEL[t.status]}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Warehouse ─────────────────────────────────────────────────────────────────

export function WarehouseTilePreview({ tileId: _ }: { tileId: string }) {
  const { data: summary, isLoading } = useWarehouseSummary();
  const { data: alerts } = useWarehouseAlerts();
  const alertCount = Array.isArray(alerts) ? alerts.length : 0;

  if (isLoading && !summary) {
    return (
      <div className={s.root}>
        <div className={s.statsRow}>
          <span className={s.chip} data-tone="muted">Загрузка…</span>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className={s.root}>
        <span className={s.empty}>Нет данных склада</span>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.statsRow}>
        <span className={s.chip} data-tone="accent">{summary.totalItems} позиций</span>
        {summary.lowStockCount > 0 && (
          <span className={s.chip} data-tone="warning">{summary.lowStockCount} мало</span>
        )}
        {alertCount > 0 && (
          <span className={s.chip} data-tone="danger">{alertCount} alert</span>
        )}
      </div>
      <div className={s.statGrid}>
        <div className={s.statCell}>
          <span className={s.statCellNum}>{summary.totalItems}</span>
          <span className={s.statCellLabel}>Позиций</span>
        </div>
        <div className={s.statCell}>
          <span className={s.statCellNum}>{summary.categories}</span>
          <span className={s.statCellLabel}>Категорий</span>
        </div>
        <div className={s.statCell}>
          <span className={`${s.statCellNum} ${summary.lowStockCount > 0 ? s.expense : ''}`}>
            {summary.lowStockCount}
          </span>
          <span className={s.statCellLabel}>Мало запасов</span>
        </div>
        <div className={s.statCell}>
          <span className={`${s.statCellNum} ${alertCount > 0 ? s.expense : ''}`}>
            {alertCount > 0 ? alertCount : '—'}
          </span>
          <span className={s.statCellLabel}>Оповещений</span>
        </div>
      </div>
    </div>
  );
}

// ── Finance ───────────────────────────────────────────────────────────────────

export function FinanceTilePreview({ tileId: _ }: { tileId: string }) {
  const { data, isLoading } = useFinanceSummary();

  if (isLoading && !data) {
    return (
      <div className={s.root}>
        <div className={s.statsRow}>
          <span className={s.chip} data-tone="muted">Загрузка…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.statsRow}>
        <span className={s.chip} data-tone={data && data.balance >= 0 ? 'success' : 'danger'}>
          {data ? `${data.balance >= 0 ? '+' : ''}${fmtNum(data.balance)} ₸` : 'Нет данных'}
        </span>
      </div>
      <div className={s.statGrid}>
        <div className={s.statCell}>
          <span className={`${s.statCellNum} ${s.income}`}>
            {data ? fmtNum(data.income) : '—'}
          </span>
          <span className={s.statCellLabel}>Доходы</span>
        </div>
        <div className={s.statCell}>
          <span className={`${s.statCellNum} ${s.expense}`}>
            {data ? fmtNum(data.expense) : '—'}
          </span>
          <span className={s.statCellLabel}>Расходы</span>
        </div>
      </div>
    </div>
  );
}

// ── Employees ─────────────────────────────────────────────────────────────────

export function EmployeesTilePreview({ tileId: _ }: { tileId: string }) {
  const { data, isLoading } = useEmployees();
  const employees = data?.results ?? [];
  const total = data?.count ?? employees.length;

  if (isLoading && employees.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.statsRow}>
          <span className={s.chip} data-tone="muted">Загрузка…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.statsRow}>
        <span className={s.chip} data-tone="accent">{total} сотрудников</span>
      </div>
      <div className={s.list}>
        {employees.slice(0, 3).map(e => (
          <div key={e.id} className={s.row}>
            <span className={s.rowDot} data-tone="accent" />
            <span className={s.rowName}>{e.full_name}</span>
            {e.department && <span className={s.rowMeta}>{e.department}</span>}
          </div>
        ))}
        {employees.length === 0 && <span className={s.empty}>Нет сотрудников</span>}
      </div>
    </div>
  );
}

// ── Chapan ────────────────────────────────────────────────────────────────────

const ORDER_STATUS_LABEL: Record<string, string> = {
  new: 'Новый', confirmed: 'Подтв.', in_production: 'Произв.',
  ready: 'Готов', on_warehouse: 'На складе', shipped: 'Отправлен',
  completed: 'Завершён', cancelled: 'Отменён',
};
const ORDER_STATUS_TONE: Record<string, string> = {
  new: 'muted', confirmed: 'accent', in_production: 'warning',
  ready: 'success', on_warehouse: 'success', shipped: 'success',
};

export function ChapanTilePreview({ tileId: _ }: { tileId: string }) {
  const { data, isLoading } = useOrders({ limit: 50 });
  const orders = data?.results ?? [];
  const active = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  const inProd = active.filter(o => o.status === 'in_production').length;
  const ready = active.filter(o => o.status === 'ready' || o.status === 'on_warehouse').length;
  const recent = active.slice(0, 3);

  if (isLoading && orders.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.statsRow}>
          <span className={s.chip} data-tone="muted">Загрузка…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.statsRow}>
        <span className={s.chip} data-tone="accent">{active.length} активных</span>
        {inProd > 0 && <span className={s.chip} data-tone="warning">{inProd} в произв.</span>}
        {ready > 0 && <span className={s.chip} data-tone="success">{ready} готово</span>}
      </div>
      <div className={s.list}>
        {recent.length === 0
          ? <span className={s.empty}>Нет активных заказов</span>
          : recent.map(o => (
            <div key={o.id} className={s.row}>
              <span className={s.rowDot} data-tone={ORDER_STATUS_TONE[o.status] ?? 'muted'} />
              <span className={s.rowName}>{o.clientName || o.orderNumber}</span>
              <span className={s.rowMeta}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────

export function ReportsTilePreview({ tileId: _ }: { tileId: string }) {
  const { data: leadsData } = useLeads({ limit: 100 });
  const { data: dealsData } = useDeals({ limit: 100 });
  const leads = leadsData?.results ?? [];
  const deals = dealsData?.results ?? [];
  const wonDeals = deals.filter(d => d.stage === 'won');
  const wonValue = wonDeals.reduce((sum, d) => sum + (d.amount ?? 0), 0);

  return (
    <div className={s.root}>
      <div className={s.statsRow}>
        <span className={s.chip} data-tone="accent">Аналитика</span>
      </div>
      <div className={s.statGrid}>
        <div className={s.statCell}>
          <span className={s.statCellNum}>{leads.length}</span>
          <span className={s.statCellLabel}>Лидов</span>
        </div>
        <div className={s.statCell}>
          <span className={s.statCellNum}>{deals.length}</span>
          <span className={s.statCellLabel}>Сделок</span>
        </div>
        <div className={s.statCell}>
          <span className={`${s.statCellNum} ${s.income}`}>{wonDeals.length}</span>
          <span className={s.statCellLabel}>Закрыто</span>
        </div>
        <div className={s.statCell}>
          <span className={`${s.statCellNum} ${s.income}`}>{wonValue > 0 ? fmtNum(wonValue) : '—'}</span>
          <span className={s.statCellLabel}>₸ выручки</span>
        </div>
      </div>
    </div>
  );
}

// ── Documents ─────────────────────────────────────────────────────────────────

export function DocumentsTilePreview({ tileId: _ }: { tileId: string }) {
  return (
    <div className={s.root}>
      <div className={s.statsRow}>
        <span className={s.chip} data-tone="accent">Документы</span>
      </div>
      <div className={s.placeholder}>
        <FolderOpen size={20} className={s.placeholderIcon} />
        <span className={s.placeholderText}>Рабочие документы и счета</span>
      </div>
    </div>
  );
}

// ── Production ────────────────────────────────────────────────────────────────

export function ProductionTilePreview({ tileId: _ }: { tileId: string }) {
  return (
    <div className={s.root}>
      <div className={s.statsRow}>
        <span className={s.chip} data-tone="warning">В разработке</span>
      </div>
      <div className={s.placeholder}>
        <Factory size={20} className={s.placeholderIcon} />
        <span className={s.placeholderText}>Производственный модуль скоро будет доступен</span>
      </div>
    </div>
  );
}
