import { translate } from '../i18n/translator';

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
  /** Brand names stay as they are; only "Website" is translated. */
  readonly label: string;
  /** `form.placeholder.social.<key>`, translated when read. */
  readonly placeholder: string;
}

const BRAND_LABELS: Record<Exclude<SocialPlatformKey, 'website'>, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  twitter: 'X / Twitter',
  linkedin: 'LinkedIn',
};

/**
 * Getters, not values: this is a module constant, evaluated before the
 * language file has loaded (same reason as `enumLabelMap`).
 */
export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = SOCIAL_PLATFORM_KEYS.map((key) => ({
  key,
  get label() {
    return key === 'website' ? translate('form.label.website') : BRAND_LABELS[key];
  },
  get placeholder() {
    return translate(`form.placeholder.social.${key}`);
  },
}));
