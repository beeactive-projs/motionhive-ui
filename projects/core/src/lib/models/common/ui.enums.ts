export const TagSeverity = {
  Success: 'success',
  Warn: 'warn',
  Danger: 'danger',
  Secondary: 'secondary',
  Info: 'info',
  Contrast: 'contrast',
} as const;

export type TagSeverity = (typeof TagSeverity)[keyof typeof TagSeverity] | null | undefined;
