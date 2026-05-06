import type { WorkspaceSnapshot } from '../../model/types';
import { ReportsSPA } from './spa/ReportsSPA';

export function ReportsTilePreview({ snapshot }: { snapshot?: WorkspaceSnapshot }) {
  return <ReportsSPA snapshot={snapshot} />;
}
