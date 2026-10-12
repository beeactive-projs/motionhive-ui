/**
 * A notice's hue, one of the wash pairs in variables.css. The names match the
 * badge and session-row tones and Ionic's colour names (`warning`, not `warn`).
 */
export const NoticeTones = {
  Medium: 'medium',
  Info: 'info',
  Success: 'success',
  Warning: 'warning',
  Danger: 'danger',
} as const;

export type NoticeTone = (typeof NoticeTones)[keyof typeof NoticeTones];
