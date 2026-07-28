export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'motionhive_access_token',
  REFRESH_TOKEN: 'motionhive_refresh_token',
  USER: 'motionhive_user',
  LANGUAGE: 'motionhive_language',
  THEME: 'motionhive_theme',
  PERMISSIONS: 'motionhive_permissions',
  ROLES: 'motionhive_roles',
  /** Per-program collapse state in the program builder (suffix = program id). */
  PROGRAM_BUILDER_EXPANDED: (programId: string) =>
    `motionhive_program_builder_expanded_${programId}`,
} as const;
