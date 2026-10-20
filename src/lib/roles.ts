// DR-style production roles: they all get the same access and the same "assigned orders only" scope.
export const DR_ROLES = ['SW', 'CG', 'EDITOR', 'ARTIST'] as const;

export const isDrRole = (role: string | null | undefined): boolean =>
  !!role && (DR_ROLES as readonly string[]).includes(role);

/** Team keys ('DR_TEAM' = all DR-style roles) vs a user's/task's role. */
export const roleInTeam = (role: string | null | undefined, team: string): boolean =>
  team === 'DR_TEAM' ? isDrRole(role) : role === team;

/** Order/project the user is attached to: classic DR field or any production-stage assignee. */
export const isAssignedTo = (
  entity: { designerRepresentativeId?: string | null; stageAssignees?: Record<string, { id: string }> | null },
  userId: string | null | undefined,
): boolean =>
  !!userId &&
  (entity.designerRepresentativeId === userId ||
    Object.values(entity.stageAssignees ?? {}).some((a) => a?.id === userId));
