import { Skeleton, SkeletonAvatar } from '../../../shared/ui/Skeleton';
import styles from './MessageSkeleton.module.css';

function SkeletonBubble({ mine }: { mine: boolean }) {
  return (
    <div className={[styles.row, mine ? styles.rowMine : styles.rowTheirs].join(' ')}>
      {!mine && <SkeletonAvatar size={28} />}
      <div className={styles.bubbleWrap}>
        <Skeleton
          width={mine ? 160 : 200}
          height={36}
          radius="var(--radius-md)"
        />
      </div>
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className={styles.root}>
      <SkeletonBubble mine={false} />
      <SkeletonBubble mine={true} />
      <SkeletonBubble mine={false} />
      <SkeletonBubble mine={true} />
      <SkeletonBubble mine={false} />
    </div>
  );
}
