import type { Project, ProjectStatusType } from '@/types';
import { ORDER_SUBMITTED_ID, READY_FOR_DESIGN_STATUS_ID, ON_HOLD_STATUS_ID, DELIVERED_STATUS_ID } from './status-constants';

// Single source of truth for project stages (board order). Each stage is backed by an order status id.
export const PROJECT_STAGE_CONFIG: Array<{
  status: ProjectStatusType;
  orderStatusId: string;
  timestampField: keyof Project;
  color: string; // used when seeding the matching order status
}> = [
  { status: 'CR Clearance', orderStatusId: ORDER_SUBMITTED_ID, timestampField: 'crClearanceAt', color: '#0284C7' },
  { status: 'Operation Manager', orderStatusId: 'co-clearance', timestampField: 'coClearanceAt', color: '#0D9488' },
  { status: 'Requirements Collection', orderStatusId: 'requirements-collection', timestampField: 'requirementsCollectionAt', color: '#06B6D4' },
  { status: 'On Script', orderStatusId: READY_FOR_DESIGN_STATUS_ID, timestampField: 'onDesignAt', color: '#9333EA' },
  { status: 'Approval Period', orderStatusId: ON_HOLD_STATUS_ID, timestampField: 'onHoldAt', color: '#EAB308' },
  { status: 'Script Done', orderStatusId: 'script-done', timestampField: 'scriptDoneAt', color: '#7C3AED' },
  { status: 'Artist Booked', orderStatusId: 'artist-booked', timestampField: 'artistBookedAt', color: '#DB2777' },
  { status: 'Cinematographer', orderStatusId: 'cinematographer', timestampField: 'cinematographerAt', color: '#2563EB' },
  { status: 'CG Complete', orderStatusId: 'cg-complete', timestampField: 'cgCompleteAt', color: '#0891B2' },
  { status: 'On Editor', orderStatusId: 'on-editor', timestampField: 'onEditorAt', color: '#4F46E5' },
  { status: 'Client Revision', orderStatusId: 'client-revision', timestampField: 'clientRevisionAt', color: '#EA580C' },
  { status: 'Project Complete', orderStatusId: 'project-complete', timestampField: 'projectCompleteAt', color: '#16A34A' },
  { status: 'Due Payment', orderStatusId: 'due-payment', timestampField: 'duePaymentAt', color: '#DC2626' },
  { status: 'Project Delivered', orderStatusId: DELIVERED_STATUS_ID, timestampField: 'deliveredAt', color: '#059669' },
];

export const PROJECT_STAGES: ProjectStatusType[] = PROJECT_STAGE_CONFIG.map((s) => s.status);

export const orderStatusIdForStage = (status: ProjectStatusType): string | undefined =>
  PROJECT_STAGE_CONFIG.find((s) => s.status === status)?.orderStatusId;

export const timestampFieldForStage = (status: ProjectStatusType): keyof Project | undefined =>
  PROJECT_STAGE_CONFIG.find((s) => s.status === status)?.timestampField;

/** Map an order status id to a project stage. Retired legacy statuses fall back to the nearest stage. */
export function stageForOrderStatus(orderStatusId: string): ProjectStatusType {
  const hit = PROJECT_STAGE_CONFIG.find((s) => s.orderStatusId === orderStatusId);
  if (hit) return hit.status;
  if (orderStatusId === ON_HOLD_STATUS_ID || orderStatusId === 'on-hold') return 'Approval Period';
  if (orderStatusId.toLowerCase().includes('design')) return 'On Script';
  if (orderStatusId === 'shipped') return 'Project Delivered';
  if (orderStatusId === 'logistics') return 'Project Complete';
  return 'CR Clearance';
}

export const STAGE_BADGE_CLASS: Record<ProjectStatusType, string> = {
  'CR Clearance': 'bg-sky-600 text-sky-50 hover:bg-sky-600/80',
  'Operation Manager': 'bg-teal-600 text-teal-50 hover:bg-teal-600/80',
  'Requirements Collection': 'bg-cyan-600 text-cyan-50 hover:bg-cyan-600/80',
  'On Script': 'bg-purple-600 text-purple-50 hover:bg-purple-600/80',
  'Approval Period': 'bg-yellow-500 text-yellow-950 hover:bg-yellow-500/80',
  'On Hold': 'bg-yellow-500 text-yellow-950 hover:bg-yellow-500/80',
  'Script Done': 'bg-violet-600 text-violet-50 hover:bg-violet-600/80',
  'Artist Booked': 'bg-pink-600 text-pink-50 hover:bg-pink-600/80',
  'Cinematographer': 'bg-blue-600 text-blue-50 hover:bg-blue-600/80',
  'CG Complete': 'bg-cyan-600 text-cyan-50 hover:bg-cyan-600/80',
  'On Editor': 'bg-indigo-600 text-indigo-50 hover:bg-indigo-600/80',
  'Client Revision': 'bg-orange-600 text-orange-50 hover:bg-orange-600/80',
  'Project Complete': 'bg-green-600 text-green-50 hover:bg-green-600/80',
  'Due Payment': 'bg-red-600 text-red-50 hover:bg-red-600/80',
  'Project Delivered': 'bg-emerald-600 text-emerald-50 hover:bg-emerald-600/80',
};

/** Stages that ask "who is doing this?" when a project is moved into them, and which role can be picked. */
export const STAGE_ASSIGN_ROLE: Partial<Record<ProjectStatusType, { role: string; label: string; roles?: string[] }>> = {
  // role = key the assignee is stored under; roles = which user roles can be picked (defaults to [role])
  'Operation Manager': { role: 'OM', label: 'Operation Manager', roles: ['ADMIN'] },
  'On Script': { role: 'SW', label: 'Script Writer' },
  'Artist Booked': { role: 'ARTIST', label: 'Artist' },
  'Cinematographer': { role: 'CG', label: 'Cinematographer' },
  'On Editor': { role: 'EDITOR', label: 'Editor' },
};

/** Stages that cannot be entered without an uploaded proof image (the proof URL travels in the move note as "Proof: <url>"). */
export const PROOF_REQUIRED_STAGES: Partial<Record<ProjectStatusType, { title: string; description: string }>> = {
  'Operation Manager': {
    title: 'Group Creation Proof',
    description: 'Upload a screenshot as evidence that the project group has been created. The project moves to Operation Manager once the proof is uploaded.',
  },
};

/** Stages that cannot be entered without a link (the URL travels in the move note as "Link: <url>"). */
export const LINK_REQUIRED_STAGES: Partial<Record<ProjectStatusType, { title: string; description: string; label: string; placeholder: string }>> = {
  'Script Done': {
    title: 'Script Link',
    description: 'Submit the link of the finished script. The project moves to Script Done once the link is submitted.',
    label: 'Script URL',
    placeholder: 'https://docs.google.com/document/...',
  },
  'CG Complete': {
    title: 'Footage Link',
    description: 'Submit the link of the completed footage. The project moves to CG Complete once the link is submitted.',
    label: 'Footage URL',
    placeholder: 'https://drive.google.com/...',
  },
  'Project Complete': {
    title: 'Final Project Link',
    description: 'Submit the link of the completed project. The project moves to Project Complete once the link is submitted.',
    label: 'Project URL',
    placeholder: 'https://drive.google.com/...',
  },
};

export const hasLinkInNote = (note?: string | null): boolean => /Link:\s*https?:\/\/\S+/i.test(note ?? '');

export const hasProofInNote = (note?: string | null): boolean => /Proof:\s*(\/uploads\/|https?:\/\/)\S+/i.test(note ?? '');
