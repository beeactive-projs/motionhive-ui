/**
 * A notice's hue, one of the wash pairs in variables.css. `warning` matches
 * the session-row spine and Ionic's colour name; ion-badge's older `warn`
 * tone is a separate vocabulary.
 */
export const NoticeTones = {
  Medium: 'medium',
  Info: 'info',
  Success: 'success',
  Warning: 'warning',
  Danger: 'danger',
} as const;

export type NoticeTone = (typeof NoticeTones)[keyof typeof NoticeTones];
