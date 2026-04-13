import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Briefcase,
  CheckSquare,
  Mail,
  MessageSquare,
  Phone,
  UserPlus,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { listContainer, listItem } from '../../shared/motion/presets';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Skeleton } from '../../shared/ui/Skeleton';
import s from './Feed.module.css';

interface FeedItem {
  id: string;
  type: string;
  payload: Record<string, any>;
  actor: { id: string; full_name: string } | null;
  customer: { id: string; full_name: string } | null;
  deal: { id: string; title: string } | null;
  created_at: string;
}

type Tone = 'accent' | 'positive' | 'info' | 'warning' | 'muted';

const TYPE_META: Record<string, { icon: LucideIcon; tone: Tone; label: string }> = {
  note: { icon: MessageSquare, tone: 'accent', label: 'Заметка' },
  call: { icon: Phone, tone: 'positive', label: 'Звонок' },
  email_sent: { icon: Mail, tone: 'info', label: 'Email отправлен' },
  email_in: { icon: Mail, tone: 'accent', label: 'Email получен' },
  whatsapp: { icon: MessageSquare, tone: 'positive', label: 'WhatsApp' },
  status_change: { icon: ArrowRight, tone: 'warning', label: 'Смена статуса' },
  stage_change: { icon: ArrowRight, tone: 'warning', label: 'Смена стадии' },
  deal_created: { icon: Briefcase, tone: 'accent', label: 'Сделка создана' },
  task_created: { icon: CheckSquare, tone: 'info', label: 'Задача создана' },
  task_done: { icon: CheckSquare, tone: 'positive', label: 'Задача выполнена' },
  customer_created: { icon: UserPlus, tone: 'warning', label: 'Клиент добавлен' },
};

const TONE_CLASS: Record<Tone, string> = {
  accent: s.toneAccent,
  positive: s.tonePositive,
  info: s.toneInfo,
  warning: s.toneWarning,
  muted: s.toneMuted,
};

function FeedCard({ item }: { item: FeedItem }) {
  const navigate = useNavigate();
  const meta = TYPE_META[item.type] ?? { icon: Zap, tone: 'muted' as const, label: item.type };
  const Icon = meta.icon;
  const customer = item.customer;
  const deal = item.deal;

  return (
    <motion.div className={s.feedItem} variants={listItem}>
      <div className={`${s.iconDot} ${TONE_CLASS[meta.tone]}`}>
        <Icon size={16} className={s.iconSvg} />
      </div>

      <div className={s.feedBody}>
        <div className={s.feedText}>
          <span className={s.feedActor}>{item.actor?.full_name ?? 'Система'}</span>
          {' — '}
          <span className={s.feedType}>{meta.label}</span>

          {customer && (
            <>
              {' для '}
              <button className={s.feedLink} onClick={() => navigate(`/customers/${customer.id}`)}>
                {customer.full_name}
              </button>
            </>
          )}

          {deal && (
            <>
              {' по сделке '}
              <button className={s.feedLink} onClick={() => navigate(`/deals/${deal.id}`)}>
                {deal.title}
              </button>
            </>
          )}
        </div>

        {item.payload?.body && <div className={s.feedPreview}>{String(item.payload.body)}</div>}

        <div className={s.feedTime}>
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ru })}
        </div>
      </div>
    </motion.div>
  );
}

export default function FeedPage() {
  useDocumentTitle('Лента');

  const { data, isLoading } = useQuery<FeedItem[]>({
    queryKey: ['feed'],
    queryFn: () => api.get('/feed/'),
    refetchInterval: 30_000,
  });

  return (
    <div className={s.page}>
      <PageHeader
        title="Лента активности"
        subtitle="Все события организации в реальном времени, без переключения между карточками и сущностями"
      />

      {isLoading && (
        <div className={s.skeletonList}>
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className={s.skeletonItem}>
              <div className={s.skeletonDot} />
              <div className={s.skeletonBody}>
                <div className={s.skeletonTitle}>
                  <Skeleton className={s.skeletonLinePrimary} />
                </div>
                <Skeleton className={s.skeletonLineSecondary} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <EmptyState
          icon={<Activity size={22} />}
          title="Лента пока пустая"
          subtitle="Активность появится после первых действий в системе"
        />
      )}

      {!isLoading && data && data.length > 0 && (
        <motion.div variants={listContainer} initial="hidden" animate="visible" className={s.feedList}>
          {data.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
