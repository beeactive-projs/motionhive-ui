export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'motionhive_access_token',
  REFRESH_TOKEN: 'motionhive_refresh_token',
  USER: 'motionhive_user',
  LANGUAGE: 'motionhive_language',
  /** Set while a device language choice has not yet reached the account. */
  LANGUAGE_PENDING_SYNC: 'motionhive_language_pending_sync',
  THEME: 'motionhive_theme',
  PERMISSIONS: 'motionhive_permissions',
  ROLES: 'motionhive_roles',
  /**
   * Coach/Train workspace mode. Deliberately keeps its historical `mh-` name
   * rather than the `motionhive_` prefix — it is already persisted in live
   * users' browsers, and renaming it would silently reset their preference.
   */
  NAV_MODE: 'mh-nav-mode',
  /** Per-program collapse state in the program builder (suffix = program id). */
  PROGRAM_BUILDER_EXPANDED: (programId: string) =>
    `motionhive_program_builder_expanded_${programId}`,
  /** Whether the workout history calendar is folded down to one week. */
  HISTORY_CALENDAR_COLLAPSED: 'motionhive_history_calendar_collapsed',
} as const;
