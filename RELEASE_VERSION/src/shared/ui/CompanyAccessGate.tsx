import type { ReactNode } from 'react';
import { Building2, Clock3, ShieldX, UserRoundPlus } from 'lucide-react';
import { Button } from './Button';
import { useCompanyAccess } from '../hooks/useCompanyAccess';
import styles from './CompanyAccessGate.module.css';

type Props = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  actionLabel?: string;
  action?: () => void;
  extra?: ReactNode;
};

function resolveCopy(state: ReturnType<typeof useCompanyAccess>['state'], companyName: string | null) {
  if (state === 'anonymous') {
    return {
      icon: <UserRoundPlus size={18} />,
      title: 'Войдите в аккаунт',
      subtitle: 'Сначала авторизуйтесь, затем подключите компанию или перейдите по реферальной ссылке.',
    };
  }

  if (state === 'pending') {
    return {
      icon: <Clock3 size={18} />,
      title: 'Ожидайте подтверждения администратора',
      subtitle: companyName
        ? `Заявка в компанию «${companyName}» уже отправлена. Плитки и оболочка доступны, но данные компании откроются только после подтверждения.`
        : 'Заявка уже отправлена. Данные компании откроются после подтверждения администратора.',
    };
  }

  if (state === 'rejected') {
    return {
      icon: <ShieldX size={18} />,
      title: 'Доступ в компанию отклонён',
      subtitle: companyName
        ? `Запрос в «${companyName}» был отклонён. Можно выбрать другую компанию или использовать новую ссылку приглашения.`
        : 'Запрос был отклонён. Выберите другую компанию или используйте новую ссылку приглашения.',
    };
  }

  return {
    icon: <Building2 size={18} />,
    title: 'Вы ещё не подключены к компании',
    subtitle: 'Выберите компанию в настройках или вставьте реферальную ссылку. До этого рабочее пространство остаётся ограниченным.',
  };
}

export function CompanyAccessGate({ title, subtitle, compact, actionLabel, action, extra }: Props) {
  const access = useCompanyAccess();
  const copy = resolveCopy(access.state, access.companyName);

  return (
    <div className={`${styles.card} ${compact ? styles.compact : ''}`}>
      <div className={styles.icon}>{copy.icon}</div>
      <div className={styles.body}>
        <div className={styles.title}>{title ?? copy.title}</div>
        <div className={styles.subtitle}>{subtitle ?? copy.subtitle}</div>
        {extra}
      </div>
      {action && actionLabel && (
        <div className={styles.actions}>
          <Button size="sm" onClick={action}>{actionLabel}</Button>
        </div>
      )}
    </div>
  );
}
