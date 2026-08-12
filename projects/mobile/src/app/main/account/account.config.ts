import { NotificationCategory, SocialPlatformKey } from 'core';
import {
  alertCircleOutline,
  atOutline,
  banOutline,
  calendarOutline,
  cameraOutline,
  cardOutline,
  chatbubbleEllipsesOutline,
  checkmarkCircle,
  close,
  colorPaletteOutline,
  copyOutline,
  globeOutline,
  imageOutline,
  languageOutline,
  linkOutline,
  locationOutline,
  logInOutline,
  logoFacebook,
  logoInstagram,
  logoLinkedin,
  logoTiktok,
  logoTwitter,
  logoYoutube,
  logOutOutline,
  mailOutline,
  notificationsOutline,
  openOutline,
  peopleOutline,
  personOutline,
  ribbonOutline,
  shareSocialOutline,
  shieldCheckmarkOutline,
  timeOutline,
  trashOutline,
} from 'ionicons/icons';

/**
 * Every icon the account area renders, in one place — the same discipline as
 * `TAB_ICONS`. An unregistered name renders as a blank box with no error, so
 * `account.config.spec.ts` asserts that every name string used here has a
 * matching camelCase key.
 */
export const ACCOUNT_ICONS = {
  alertCircleOutline,
  atOutline,
  banOutline,
  calendarOutline,
  cameraOutline,
  cardOutline,
  chatbubbleEllipsesOutline,
  checkmarkCircle,
  close,
  colorPaletteOutline,
  copyOutline,
  globeOutline,
  imageOutline,
  languageOutline,
  linkOutline,
  locationOutline,
  logInOutline,
  logOutOutline,
  logoFacebook,
  logoInstagram,
  logoLinkedin,
  logoTiktok,
  logoTwitter,
  logoYoutube,
  mailOutline,
  notificationsOutline,
  openOutline,
  peopleOutline,
  personOutline,
  ribbonOutline,
  shareSocialOutline,
  shieldCheckmarkOutline,
  timeOutline,
  trashOutline,
};

/** ionicons name for each social platform core knows about. */
export const SOCIAL_ICONS: Record<SocialPlatformKey, string> = {
  instagram: 'logo-instagram',
  youtube: 'logo-youtube',
  tiktok: 'logo-tiktok',
  facebook: 'logo-facebook',
  twitter: 'logo-twitter',
  linkedin: 'logo-linkedin',
  website: 'globe-outline',
};

export interface NotificationCategoryStyle {
  icon: string;
  color: string;
}

/**
 * Presentation for the notification categories. The server owns the list and
 * the copy, so this is keyed defensively — a category added server-side renders
 * with `NOTIFICATION_STYLE_FALLBACK` rather than an empty tile.
 */
export const NOTIFICATION_STYLE_FALLBACK: NotificationCategoryStyle = {
  icon: 'notifications-outline',
  color: 'medium',
};

export const NOTIFICATION_CATEGORY_STYLES: Partial<
  Record<NotificationCategory, NotificationCategoryStyle>
> = {
  [NotificationCategory.Sessions]: { icon: 'calendar-outline', color: 'info' },
  [NotificationCategory.Coaching]: { icon: 'ribbon-outline', color: 'primary' },
  [NotificationCategory.Groups]: { icon: 'people-outline', color: 'violet' },
  [NotificationCategory.Payments]: { icon: 'card-outline', color: 'success' },
  [NotificationCategory.Posts]: { icon: 'chatbubble-ellipses-outline', color: 'medium' },
  [NotificationCategory.Account]: { icon: 'shield-checkmark-outline', color: 'dark' },
};
