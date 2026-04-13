import type { WorkspaceSnapshot } from '../../model/types';
import { TasksSPA } from './spa/TasksSPA';

export function TasksTilePreview({ tileId }: { snapshot?: WorkspaceSnapshot; tileId: string }) {
  return <TasksSPA tileId={tileId} />;
}
