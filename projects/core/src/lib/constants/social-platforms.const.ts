/**
 * The social platforms an instructor profile can link out to.
 *
 * Keys match `InstructorProfile.socialLinks`, so the order here is the order
 * every app renders them in. Icons are deliberately absent: web names PrimeIcons
 * classes and mobile names ionicons, and baking either one in would make this
 * unusable by the other — the same reason mobile keeps its own `TabItem` instead
 * of reusing `NavItem`. Each app maps the key to its own icon set.
 */

export const SOCIAL_PLATFORM_KEYS = [
  'instagram',
  'youtube',
  'tiktok',
  'facebook',
  'twitter',
  'linkedin',
  'website',
] as const;

export type SocialPlatformKey = (typeof SOCIAL_PLATFORM_KEYS)[number];

export interface SocialPlatform {
  key: SocialPlatformKey;
  label: string;
  placeholder: string;
}

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'instagram.com/yourhandle' },
  { key: 'youtube', label: 'YouTube', placeholder: 'youtube.com/@yourchannel' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'tiktok.com/@yourhandle' },
  { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/yourpage' },
  { key: 'twitter', label: 'X / Twitter', placeholder: 'x.com/yourhandle' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/yourhandle' },
  { key: 'website', label: 'Website', placeholder: 'yourwebsite.com' },
];
