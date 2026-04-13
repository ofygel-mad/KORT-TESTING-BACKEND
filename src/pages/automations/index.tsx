import { useState, type CSSProperties } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Plus, Play, Pause, Trash2, ChevronRight,
  UserPlus, TrendingUp, CheckSquare, AlertCircle, ArrowRight,
  MessageSquare, Bell, Globe, RefreshCw, X,
  Filter, Layers, ChevronUp, ChevronDown,
} from 'lucide-react';
import { api } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Button } from '../../shared/ui/Button';
import { Badge } from '../../shared/ui/Badge';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Skeleton } from '../../shared/ui/Skeleton';
import { Drawer } from '../../shared/ui/Drawer';
import { toast } from 'sonner';
import { useCapabilities } from '../../shared/hooks/useCapabilities';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import styles from './Automations.module.css';

interface Condition {
  field_path: string;
  operator: string;
  value_json: string | number | null;
}

interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Condition[];
}

interface RuleAction {
  action_type: string;
  config_json: Record<string, unknown>;
  position: number;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  status: string;
  condition_groups: ConditionGroup[];
  actions: RuleAction[];
  executions_count: number;
  last_executed_at: string | null;
  created_at: string;
}

type Tone = 'default' | 'success' | 'info' | 'warning' | 'danger' | 'accent';
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const TONE_COLOR: Record<Tone, string> = {
  default: 'var(--text-tertiary)',
  success: 'var(--fill-positive)',
  info: 'var(--fill-info)',
  warning: 'var(--fill-warning)',
  danger: 'var(--fill-negative)',
  accent: 'var(--fill-accent)',
};

const TRIGGERS = [
  { value: 'customer.created', label: 'Клиент создан', icon: UserPlus, tone: 'success' as Tone },
  { value: 'deal.created', label: 'Сделка создана', icon: TrendingUp, tone: 'info' as Tone },
  { value: 'deal.stage_changed', label: 'Сделка сменила этап', icon: ArrowRight, tone: 'warning' as Tone },
  { value: 'deal.stalled', label: 'Сделка зависла (5+ дней)', icon: AlertCircle, tone: 'danger' as Tone },
  { value: 'task.created', label: 'Задача создана', icon: CheckSquare, tone: 'accent' as Tone },
  { value: 'task.overdue', label: 'Задача просрочена', icon: AlertCircle, tone: 'danger' as Tone },
  { value: 'customer.follow_up_due', label: 'Follow-up просрочен', icon: Bell, tone: 'warning' as Tone },
];

const FIELDS_BY_TRIGGER: Record<string, { value: string; label: string; type: 'text' | 'number' | 'select' }[]> = {
  'deal.stalled': [
    { value: 'deal.amount', label: 'Сумма сделки', type: 'number' },
    { value: 'deal.days_silent', label: 'Дней без касания', type: 'number' },
  ],
  'customer.follow_up_due': [
    { value: 'customer.response_state', label: 'Статус ответа', type: 'text' },
  ],
  'customer.created': [
    { value: 'customer.source', label: 'Источник клиента', type: 'text' },
    { value: 'customer.status', label: 'Статус клиента', type: 'select' },
  ],
  'deal.created': [
    { value: 'deal.amount', label: 'Сумма сделки', type: 'number' },
    { value: 'customer.source', label: 'Источник клиента', type: 'text' },
  ],
  'deal.stage_changed': [
    { value: 'deal.amount', label: 'Сумма сделки', type: 'number' },
    { value: 'customer.source', label: 'Источник клиента', type: 'text' },
    { value: 'customer.status', label: 'Статус клиента', type: 'select' },
  ],
  'task.created': [
    { value: 'task.priority', label: 'Приоритет задачи', type: 'select' },
  ],
};

const OPERATORS_BY_TYPE = {
  text: [{ v: 'eq', l: '=' }, { v: 'neq', l: '≠' }, { v: 'contains', l: 'содержит' }, { v: 'is_empty', l: 'пусто' }],
  number: [{ v: 'eq', l: '=' }, { v: 'neq', l: '≠' }, { v: 'gt', l: '>' }, { v: 'gte', l: '>=' }, { v: 'lt', l: '<' }, { v: 'lte', l: '<=' }],
  select: [{ v: 'eq', l: '=' }, { v: 'neq', l: '≠' }],
};

const ACTION_TYPES = [
  {
    value: 'create_task', label: 'Создать задачу', icon: CheckSquare, tone: 'info' as Tone,
    fields: [{ key: 'title_template', label: 'Заголовок задачи', placeholder: 'Связаться с {{customer.full_name}}' },
      { key: 'due_in_hours', label: 'Срок (часов)', placeholder: '24', type: 'number' }],
  },
  {
    value: 'create_note', label: 'Добавить заметку', icon: MessageSquare, tone: 'accent' as Tone,
    fields: [{ key: 'body_template', label: 'Текст заметки', placeholder: 'Автоматически создано' }],
  },
  {
    value: 'send_internal_notification', label: 'Уведомить пользователя', icon: Bell, tone: 'warning' as Tone,
    fields: [{ key: 'title_template', label: 'Заголовок', placeholder: 'Новое событие' },
      { key: 'body_template', label: 'Текст', placeholder: 'Сделка {{deal.title}} обновлена' }],
  },
  {
    value: 'update_field', label: 'Обновить поле', icon: RefreshCw, tone: 'success' as Tone,
    fields: [{ key: 'field', label: 'Поле', placeholder: 'status' },
      { key: 'value', label: 'Значение', placeholder: 'hot' }],
  },
  {
    value: 'change_deal_stage', label: 'Сменить этап сделки', icon: ArrowRight, tone: 'danger' as Tone,
    fields: [{ key: 'stage_id', label: 'ID этапа', placeholder: 'uuid этапа' }],
  },
  {
    value: 'webhook', label: 'Вебхук', icon: Globe, tone: 'default' as Tone,
    fields: [{ key: 'url', label: 'URL', placeholder: 'https://...' }],
  },
];

const STATUS_CFG: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Активна', variant: 'success' },
  paused: { label: 'Пауза', variant: 'warning' },
  draft: { label: 'Черновик', variant: 'default' },
  archived: { label: 'Архив', variant: 'default' },
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function emptyCondition(): Condition {
  return { field_path: '', operator: 'eq', value_json: '' };
}
function emptyGroup(): ConditionGroup {
  return { operator: 'AND', conditions: [emptyCondition()] };
}
function emptyAction(type: string): RuleAction {
  return { action_type: type, config_json: {}, position: 0 };
}

function TriggerSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className={styles.triggerGrid}>
      {TRIGGERS.map((t) => {
        const Icon = t.icon;
        const active = value === t.value;
        return (
          <motion.button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            whileTap={{ scale: 0.98 }}
            className={cx(styles.selectorButton, active && styles.selectorButtonActive)}
            style={{ '--trigger-color': TONE_COLOR[t.tone] } as CSSProperties}
          >
            <div className={styles.selectorIcon}>
              <Icon size={14} />
            </div>
            <span className={styles.selectorText}>{t.label}</span>
            {active && <ChevronRight size={13} className={styles.selectorChevron} />}
          </motion.button>
        );
      })}
    </div>
  );
}

function ConditionRow({
  condition, triggerType, onChange, onRemove, canRemove,
}: {
  condition: Condition; triggerType: string;
  onChange: (c: Condition) => void; onRemove: () => void; canRemove: boolean;
}) {
  const fields = FIELDS_BY_TRIGGER[triggerType] ?? [];
  const field = fields.find((f) => f.value === condition.field_path);
  const ops = OPERATORS_BY_TYPE[field?.type ?? 'text'];

  return (
    <div className={styles.conditionRow}>
      <select
        value={condition.field_path}
        onChange={(e) => onChange({ ...condition, field_path: e.target.value, operator: 'eq', value_json: '' })}
        className={cx('kort-input', styles.compactInput, styles.flex2)}
      >
        <option value="">Выберите поле...</option>
        {fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value })}
        className={cx('kort-input', styles.compactInput, styles.flex1)}
      >
        {ops.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      {condition.operator !== 'is_empty' && condition.operator !== 'is_not_empty' && (
        <input
          value={String(condition.value_json ?? '')}
          onChange={(e) => onChange({ ...condition, value_json: e.target.value })}
          placeholder="Значение"
          className={cx('kort-input', styles.compactInput, styles.flex2)}
        />
      )}
      {canRemove && (
        <button type="button" onClick={onRemove} className={styles.removeButton}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function ConditionBuilder({
  groups, triggerType, onChange,
}: {
  groups: ConditionGroup[]; triggerType: string; onChange: (g: ConditionGroup[]) => void;
}) {
  const updateGroup = (idx: number, g: ConditionGroup) => {
    const next = [...groups]; next[idx] = g; onChange(next);
  };
  const removeGroup = (idx: number) => onChange(groups.filter((_, i) => i !== idx));
  const addGroup = () => onChange([...groups, emptyGroup()]);

  return (
    <div className={styles.builderBody}>
      {groups.map((group, gi) => (
        <motion.div
          key={gi}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.groupCard}
        >
          <div className={styles.groupHeader}>
            <div className={styles.groupLogic}>
              {(['AND', 'OR'] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => updateGroup(gi, { ...group, operator: op })}
                  className={cx(styles.logicButton, group.operator === op && styles.logicButtonActive)}
                >
                  {op}
                </button>
              ))}
            </div>
            {groups.length > 1 && (
              <button type="button" onClick={() => removeGroup(gi)} className={styles.iconButton}>
                <Trash2 size={13} />
              </button>
            )}
          </div>

          <div className={styles.conditionList}>
            {group.conditions.map((cond, ci) => (
              <ConditionRow
                key={ci}
                condition={cond}
                triggerType={triggerType}
                onChange={(c) => {
                  const conds = [...group.conditions]; conds[ci] = c;
                  updateGroup(gi, { ...group, conditions: conds });
                }}
                onRemove={() => {
                  const conds = group.conditions.filter((_, i) => i !== ci);
                  updateGroup(gi, { ...group, conditions: conds });
                }}
                canRemove={group.conditions.length > 1}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => updateGroup(gi, { ...group, conditions: [...group.conditions, emptyCondition()] })}
            className={styles.addConditionButton}
          >
            + Добавить условие
          </button>
        </motion.div>
      ))}

      <button type="button" onClick={addGroup} className={styles.addGroupButton}>
        + Добавить группу условий (OR)
      </button>
    </div>
  );
}

function ActionCard({
  action, index, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  action: RuleAction; index: number;
  onChange: (a: RuleAction) => void; onRemove: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
  isFirst: boolean; isLast: boolean;
}) {
  const cfg = ACTION_TYPES.find((t) => t.value === action.action_type);
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      className={styles.actionCard}
    >
      <div className={styles.actionHeader}>
        <div className={styles.actionMove}>
          <button type="button" onClick={onMoveUp} disabled={isFirst} className={styles.moveButton}>
            <ChevronUp size={12} />
          </button>
          <button type="button" onClick={onMoveDown} disabled={isLast} className={styles.moveButton}>
            <ChevronDown size={12} />
          </button>
        </div>
        <div className={styles.actionIconWrap} style={{ '--action-color': TONE_COLOR[cfg.tone] } as CSSProperties}>
          <Icon size={13} />
        </div>
        <span className={styles.actionOrder}>{index + 1}. {cfg.label}</span>
        <button type="button" onClick={onRemove} className={styles.iconButton}>
          <Trash2 size={13} />
        </button>
      </div>
      <div className={styles.actionFields}>
        {cfg.fields.map((f) => (
          <div key={f.key}>
            <label className={styles.fieldLabel}>{f.label}</label>
            <input
              value={String(action.config_json[f.key] ?? '')}
              onChange={(e) => onChange({ ...action, config_json: { ...action.config_json, [f.key]: e.target.value } })}
              placeholder={f.placeholder}
              type={f.type === 'number' ? 'number' : 'text'}
              className={cx('kort-input', styles.compactInput)}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ActionBuilder({
  actions, onChange,
}: { actions: RuleAction[]; onChange: (a: RuleAction[]) => void }) {
  const [addOpen, setAddOpen] = useState(false);

  const update = (idx: number, a: RuleAction) => { const n = [...actions]; n[idx] = a; onChange(n); };
  const remove = (idx: number) => onChange(actions.filter((_, i) => i !== idx));
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const n = [...actions]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; onChange(n);
  };
  const moveDown = (idx: number) => {
    if (idx === actions.length - 1) return;
    const n = [...actions]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; onChange(n);
  };

  return (
    <div className={styles.builderBody}>
      <AnimatePresence>
        {actions.map((a, i) => (
          <ActionCard
            key={i} action={a} index={i}
            onChange={(updated) => update(i, updated)}
            onRemove={() => remove(i)}
            onMoveUp={() => moveUp(i)}
            onMoveDown={() => moveDown(i)}
            isFirst={i === 0} isLast={i === actions.length - 1}
          />
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={styles.addActionMenu}
          >
            <div className={styles.addActionHeader}>
              <span className={styles.sectionTitle}>Выберите действие</span>
              <button type="button" onClick={() => setAddOpen(false)} className={styles.chooseActionClose}><X size={13} /></button>
            </div>
            <div className={styles.actionTypeGrid}>
              {ACTION_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <motion.button
                    key={t.value}
                    type="button"
                    onClick={() => { onChange([...actions, emptyAction(t.value)]); setAddOpen(false); }}
                    whileTap={{ scale: 0.97 }}
                    className={styles.actionPickerButton}
                    style={{ '--action-color': TONE_COLOR[t.tone] } as CSSProperties}
                  >
                    <div className={styles.actionPickerIcon}>
                      <Icon size={12} />
                    </div>
                    <span className={styles.actionTitle}>{t.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!addOpen && (
        <button type="button" onClick={() => setAddOpen(true)} className={styles.addActionButton}>
          + Добавить действие
        </button>
      )}
    </div>
  );
}

function LivePreview({ triggerType, groups, actions }: {
  triggerType: string; groups: ConditionGroup[]; actions: RuleAction[];
}) {
  const trigger = TRIGGERS.find((t) => t.value === triggerType);
  const hasConditions = groups.some((g) => g.conditions.some((c) => c.field_path));

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={styles.preview}
    >
      <div className={styles.previewTitle}>Предпросмотр правила</div>
      {!triggerType ? (
        <span className={styles.previewMuted}>Выберите триггер...</span>
      ) : (
        <>
          <span>Когда </span>
          <span className={styles.previewHighlight}>{trigger?.label ?? triggerType}</span>
          {hasConditions && <span> и выполняются условия</span>}
          {actions.length > 0 && (
            <>
              <span>, то: </span>
              {actions.map((a, i) => {
                const cfg = ACTION_TYPES.find((t) => t.value === a.action_type);
                return (
                  <span key={i}>
                    <span className={styles.previewTextStrong}>{cfg?.label}</span>
                    {i < actions.length - 1 && <span className={styles.previewMuted}>, </span>}
                  </span>
                );
              })}
            </>
          )}
          .
        </>
      )}
    </motion.div>
  );
}

function BuilderDrawer({
  open, onClose,
}: {
  open: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<'trigger' | 'conditions' | 'actions'>('trigger');
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [groups, setGroups] = useState<ConditionGroup[]>([emptyGroup()]);
  const [actions, setActions] = useState<RuleAction[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const createRule = useMutation({
    mutationFn: async () => {
      const rule = await api.post('/automations/', {
        name: name || `Правило ${triggerType}`,
        trigger_type: triggerType,
        status: 'active',
      });
      const ruleId = (rule as { id: string }).id;
      const validGroups = groups
        .map((g) => ({ ...g, conditions: g.conditions.filter((c) => c.field_path) }))
        .filter((g) => g.conditions.length > 0);
      if (validGroups.length > 0) {
        await api.post(`/automations/${ruleId}/conditions/`, { groups: validGroups });
      }
      if (actions.length > 0) {
        await api.post(`/automations/${ruleId}/actions/`, { actions });
      }
      return rule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Автоматизация создана');
      onClose();
      setStep('trigger');
      setName('');
      setTriggerType('');
      setGroups([emptyGroup()]);
      setActions([]);
    },
    onError: () => toast.error('Ошибка при создании'),
  });

  const STEPS = [
    { id: 'trigger', label: 'Триггер', icon: Zap },
    { id: 'conditions', label: 'Условия', icon: Filter },
    { id: 'actions', label: 'Действия', icon: Layers },
  ] as const;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Конструктор автоматизации"
      width={560}
      footer={
        <div className={styles.footerActions}>
          <button type="button" onClick={() => setShowPreview((v) => !v)} className={styles.previewToggle}>
            {showPreview ? 'Скрыть' : 'Предпросмотр'}
          </button>
          <div className={styles.footerButtons}>
            {step !== 'trigger' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStep(step === 'actions' ? 'conditions' : 'trigger')}
              >
                Назад
              </Button>
            )}
            {step !== 'actions' ? (
              <Button
                size="sm"
                onClick={() => setStep(step === 'trigger' ? 'conditions' : 'actions')}
                disabled={!triggerType}
              >
                Далее
              </Button>
            ) : (
              <Button size="sm" loading={createRule.isPending} onClick={() => createRule.mutate()}>
                Создать правило
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className={styles.builderBody}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название правила..."
          className={cx('kort-input', styles.nameInput)}
        />

        <div className={styles.steps}>
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = STEPS.findIndex((x) => x.id === step) > i;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={cx(styles.stepButton, active && styles.stepButtonActive, done && styles.stepButtonDone)}
              >
                <span className={styles.stepButtonInner}><Icon size={13} />{s.label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.15 }}
          >
            {step === 'trigger' && <TriggerSelector value={triggerType} onChange={setTriggerType} />}
            {step === 'conditions' && (
              <div>
                <p className={styles.conditionIntro}>Условия опциональны. Если не добавлять - правило срабатывает всегда.</p>
                <ConditionBuilder groups={groups} triggerType={triggerType} onChange={setGroups} />
              </div>
            )}
            {step === 'actions' && (
              <div>
                <p className={styles.actionsIntro}>Добавьте одно или несколько действий. Выполняются по порядку.</p>
                <ActionBuilder actions={actions} onChange={setActions} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {showPreview && <LivePreview triggerType={triggerType} groups={groups} actions={actions} />}
        </AnimatePresence>
      </div>
    </Drawer>
  );
}

export default function AutomationsPage() {
  useDocumentTitle('Автоматизации');
  const { can } = useCapabilities();
  const qc = useQueryClient();
  const [builderOpen, setBuilderOpen] = useState(false);

  const { data, isLoading } = useQuery<{ results: AutomationRule[] }>({
    queryKey: ['automations'],
    queryFn: () => api.get('/automations/'),
  });

  const { data: executions } = useQuery<any[]>({
    queryKey: ['automation-executions'],
    queryFn: () => api.get('/automations/executions/'),
    enabled: can('automations.manage'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.post(`/automations/${id}/toggle/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); toast.success('Статус изменён'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/automations/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); toast.success('Удалено'); },
  });

  if (!can('automations.manage')) {
    return (
      <div className={styles.accessDenied}>
        <EmptyState
          icon={<Zap size={22} />}
          title="Автоматизации недоступны"
          subtitle="Обновите режим Kort до Продвинутого или Промышленного"
        />
      </div>
    );
  }

  const rules: AutomationRule[] = (data?.results as AutomationRule[]) ?? [];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Автоматизации"
        subtitle={`${rules.length} правил · ${rules.filter((r) => r.status === 'active').length} активных`}
        actions={
          <Button size="sm" icon={<Plus size={13} />} onClick={() => setBuilderOpen(true)}>
            Создать правило
          </Button>
        }
      />

      <div className={styles.rulesCard}>
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className={cx(styles.skeletonRow, i < 3 && styles.skeletonDivider)}>
              <Skeleton height={14} width="40%" />
            </div>
          ))
        ) : rules.length === 0 ? (
          <EmptyState
            icon={<Zap size={20} />}
            title="Правил нет"
            subtitle="Создайте первое правило автоматизации"
            action={<Button size="sm" onClick={() => setBuilderOpen(true)}>Создать</Button>}
          />
        ) : (
          rules.map((rule, idx) => {
            const st = STATUS_CFG[rule.status] ?? STATUS_CFG.draft;
            const trigger = TRIGGERS.find((t) => t.value === rule.trigger_type);
            const TIcon = trigger?.icon ?? Zap;
            return (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.04 }}
                className={cx(styles.ruleRow, idx < rules.length - 1 && styles.ruleDivider)}
              >
                <div
                  className={cx(styles.ruleIcon, rule.status === 'active' && styles.ruleIconActive)}
                  style={{ '--trigger-color': TONE_COLOR[trigger?.tone ?? 'success'] } as CSSProperties}
                >
                  <TIcon size={16} />
                </div>

                <div className={styles.ruleContent}>
                  <div className={styles.ruleTitle}>{rule.name}</div>
                  <div className={styles.ruleMeta}>
                    <span className={styles.ruleMetaText}>{trigger?.label ?? rule.trigger_type}</span>
                    {rule.condition_groups.length > 0 && (
                      <>
                        <span className={styles.separatorDot}>·</span>
                        <span className={styles.ruleMetaText}>{rule.condition_groups.reduce((s, g) => s + g.conditions.length, 0)} условий</span>
                      </>
                    )}
                    {rule.actions.length > 0 && (
                      <>
                        <span className={styles.separatorDot}>·</span>
                        <span className={styles.ruleMetaText}>{rule.actions.length} действий</span>
                      </>
                    )}
                    {rule.executions_count > 0 && (
                      <>
                        <span className={styles.separatorDot}>·</span>
                        <span className={cx(styles.ruleMetaText, styles.ruleMetaSuccess)}>{rule.executions_count} выполнений</span>
                      </>
                    )}
                  </div>
                </div>

                <Badge variant={st.variant} dot>{st.label}</Badge>

                <div className={styles.ruleActions}>
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={rule.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
                    onClick={() => toggleMutation.mutate(rule.id)}
                  >
                    {rule.status === 'active' ? 'Пауза' : 'Старт'}
                  </Button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    onClick={() => { if (confirm('Удалить правило?')) deleteMutation.mutate(rule.id); }}
                    className={cx(styles.iconButton, styles.dangerButton)}
                  >
                    <Trash2 size={13} />
                  </motion.button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {executions && executions.length > 0 && (
        <div className={styles.executionsWrapper}>
          <div className={styles.executionsTitle}>Последние выполнения</div>
          <div className={styles.executionsCard}>
            {executions.slice(0, 10).map((ex: any, idx: number) => (
              <div key={ex.id} className={cx(styles.executionRow, idx < Math.min(10, executions.length) - 1 && styles.executionDivider)}>
                <div className={cx(
                  styles.executionDot,
                  ex.status === 'completed' && styles.executionDotCompleted,
                  ex.status === 'failed' && styles.executionDotFailed,
                )} />
                <span className={styles.executionName}>{ex.rule_name}</span>
                <span className={styles.executionMeta}>{ex.entity_type} · {ex.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <BuilderDrawer open={builderOpen} onClose={() => setBuilderOpen(false)} />
    </div>
  );
}
