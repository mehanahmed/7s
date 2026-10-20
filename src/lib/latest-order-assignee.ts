import type { TrackingLink } from '@/types';
import { STAGE_ASSIGN_ROLE } from './project-stages';

/** Use assignment times/history rather than the insertion order of role keys. */
export function getLatestOrderAssignee(order: Pick<TrackingLink, 'stageAssignees' | 'statusHistory' | 'designerRepresentativeId' | 'designerRepresentativeName'>): { id: string; name: string; role?: string } | null {
  const stageAssignees = order.stageAssignees ?? {};
  const legacyAssignee = order.designerRepresentativeId
    ? { id: order.designerRepresentativeId, name: order.designerRepresentativeName || 'N/A', role: 'SW' }
    : null;
  let latest: { id: string; name: string; role?: string } | null = null;
  let latestTime = -Infinity;
  const consider = (assignee: { id: string; name: string } | undefined | null, timestamp?: string, role?: string) => {
    const time = timestamp ? Date.parse(timestamp) : NaN;
    if (assignee && Number.isFinite(time) && time >= latestTime) {
      latest = { ...assignee, role };
      latestTime = time;
    }
  };
  for (const [role, assignee] of Object.entries(stageAssignees)) consider(assignee, assignee.assignedAt, role);
  for (const entry of order.statusHistory ?? []) {
    const notes = entry.notes ?? '';
    for (const config of Object.values(STAGE_ASSIGN_ROLE)) {
      if (config && notes.includes(`Assigned ${config.label}:`)) consider(stageAssignees[config.role], entry.timestamp, config.role);
    }
    if (notes.startsWith('Assigned to Designer:')) consider(legacyAssignee, entry.timestamp, 'SW');
  }
  const fallback = Object.entries(stageAssignees).slice(-1)[0];
  return latest ?? (fallback ? { ...fallback[1], role: fallback[0] } : legacyAssignee);
}
