import { STAGE_ASSIGN_ROLE, orderStatusIdForStage } from './project-stages';
import type { TrackingLink, User, ProjectStatusType } from '@/types';

const completionStages: Partial<Record<ProjectStatusType, ProjectStatusType>> = {
  'Operation Manager': 'On Script',
  'On Script': 'Script Done',
  'Cinematographer': 'CG Complete',
  'On Editor': 'Project Complete',
};

export const LEADERBOARD_BOARDS = [
  { id: 'cr_board', label: 'Sales Executive', roles: ['CR'], assignmentKey: 'CR', assignedStatus: '', completedStatus: '' },
  ...Object.entries(STAGE_ASSIGN_ROLE).flatMap(([stage, config]) => {
    if (!config || config.role === 'ARTIST') return [];
    const completion = completionStages[stage as ProjectStatusType];
    if (!completion) return [];
    return [{
      id: `${config.role.toLowerCase()}_board`, label: config.label,
      roles: config.roles ?? [config.role], assignmentKey: config.role,
      assignedStatus: orderStatusIdForStage(stage as ProjectStatusType)!,
      completedStatus: orderStatusIdForStage(completion)!,
    }];
  }),
];

export function getProjectPerformanceCounts(user: User, orders: TrackingLink[], boardId: string, start: Date, end: Date) {
  const board = LEADERBOARD_BOARDS.find(item => item.id === boardId);
  if (!board || board.assignmentKey === 'CR' || !board.roles.includes(user.role) || user.role === 'ARTIST') {
    return { designsAssigned: 0, designsDone: 0 };
  }
  const hasStageInPeriod = (order: TrackingLink, status: string) => (order.statusHistory ?? []).some(entry => {
    const date = new Date(entry.timestamp);
    return entry.status === status && date >= start && date <= end;
  });
  const assigned = orders.filter(order =>
    order.stageAssignees?.[board.assignmentKey]?.id === user.id ||
    (board.assignmentKey === 'SW' && !order.stageAssignees?.SW && order.designerRepresentativeId === user.id)
  );
  return {
    designsAssigned: assigned.filter(order => hasStageInPeriod(order, board.assignedStatus)).length,
    designsDone: assigned.filter(order => hasStageInPeriod(order, board.completedStatus)).length,
  };
}
