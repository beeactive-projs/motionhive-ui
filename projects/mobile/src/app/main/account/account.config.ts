import { SocialPlatformKey } from 'core';
import {
  alertCircleOutline,
  atOutline,
  banOutline,
  cameraOutline,
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
  openOutline,
  personOutline,
  shareSocialOutline,
  timeOutline,
  trashOutline,
} from 'ionicons/icons';

import { CATEGORY_ICONS } from '../../_shared/config/notification-categories.config';

/**
 * Every icon the account area renders, in one place — the same discipline as
 * `TAB_ICONS`. An unregistered name renders as a blank box with no error, so
 * `account.config.spec.ts` asserts that every name string used here has a
 * matching camelCase key.
 */
export const ACCOUNT_ICONS = {
  ...CATEGORY_ICONS,
  alertCircleOutline,
  atOutline,
  banOutline,
  cameraOutline,
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
  openOutline,
  personOutline,
  shareSocialOutline,
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
