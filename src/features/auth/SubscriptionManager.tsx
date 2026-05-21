import { useState } from 'react';
import { Check, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { useSubscription, usePlans, useChangePlan } from '@/entities/subscription/queries';
import { useAuthStore } from '@/shared/stores/auth';
import styles from './SubscriptionManager.module.css';

const STATUS_LABEL: Record<string, string> = {
  active: 'Активна',
  trial: 'Пробный период',
  suspended: 'Приостановлена',
  cancelled: 'Отменена',
};

export function SubscriptionManager() {
  const { data: subscription, isLoading } = useSubscription();
  const { data: plansData } = usePlans();
  const changePlan = useChangePlan();
  const org = useAuthStore((s) => s.org);
  const setOrg = useAuthStore((s) => s.setOrg);
  const [pending, setPending] = useState<string | null>(null);

  const plans = plansData?.results ?? [];
  const currentCode = subscription?.plan_code;

  async function handleSwitch(code: string) {
    if (code === currentCode || changePlan.isPending) return;
    setPending(code);
    try {
      await changePlan.mutateAsync(code);
      // Organization.mode is the cache route-gating reads — keep it fresh.
      if (org) setOrg({ ...org, mode: code as typeof org.mode });
      toast.success('Тарифный план обновлён');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Не удалось сменить план');
    } finally {
      setPending(null);
    }
  }

  if (isLoading) {
    return <div className={styles.loading}>Загрузка подписки…</div>;
  }

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <CreditCard size={18} />
        </div>
        <div>
          <div className={styles.headerTitle}>Тарифный план</div>
          <div className={styles.headerSubtitle}>
            План определяет доступные модули и лимит сотрудников.
            {subscription && ` Статус подписки: ${STATUS_LABEL[subscription.status] ?? subscription.status}.`}
          </div>
        </div>
      </div>

      <div className={styles.planGrid}>
        {plans.map((plan) => {
          const isCurrent = plan.code === currentCode;
          const isPending = pending === plan.code;
          return (
            <div
              key={plan.code}
              className={`${styles.planCard} ${isCurrent ? styles.planCardCurrent : ''}`}
            >
              <div className={styles.planName}>{plan.name}</div>
              <div className={styles.planDesc}>{plan.description}</div>
              <div className={styles.planMeta}>
                <span>
                  {plan.max_users == null
                    ? 'Без лимита сотрудников'
                    : `До ${plan.max_users} сотрудников`}
                </span>
                <span>{plan.features.length} модулей</span>
              </div>
              {isCurrent ? (
                <div className={styles.currentBadge}>
                  <Check size={13} /> Текущий план
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.switchBtn}
                  disabled={changePlan.isPending}
                  onClick={() => handleSwitch(plan.code)}
                >
                  {isPending ? 'Переключаем…' : 'Перейти на этот план'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
