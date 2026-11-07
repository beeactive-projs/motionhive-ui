import { OnboardingSteps, SocialPlatformKey } from 'core';
import type { OnboardingStep } from 'core';
import {
  alertCircleOutline,
  atOutline,
  banOutline,
  barbellOutline,
  callOutline,
  cameraOutline,
  checkmarkCircle,
  closeOutline,
  colorPaletteOutline,
  compassOutline,
  copyOutline,
  eyeOutline,
  globeOutline,
  imageOutline,
  languageOutline,
  linkOutline,
  locationOutline,
  logoFacebook,
  logoInstagram,
  logoLinkedin,
  logoTiktok,
  logoTwitter,
  logoYoutube,
  logOutOutline,
  mailOutline,
  openOutline,
  peopleOutline,
  personOutline,
  qrCodeOutline,
  shareSocialOutline,
  timeOutline,
  trashOutline,
  trophyOutline,
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
  barbellOutline,
  callOutline,
  cameraOutline,
  checkmarkCircle,
  closeOutline,
  colorPaletteOutline,
  compassOutline,
  copyOutline,
  eyeOutline,
  globeOutline,
  imageOutline,
  languageOutline,
  linkOutline,
  locationOutline,
  logOutOutline,
  logoFacebook,
  logoInstagram,
  logoLinkedin,
  logoTiktok,
  logoTwitter,
  logoYoutube,
  mailOutline,
  openOutline,
  peopleOutline,
  personOutline,
  qrCodeOutline,
  shareSocialOutline,
  timeOutline,
  trashOutline,
  trophyOutline,
};

/** The welcome flow's own screens the Profile card opens, as editors. */
export const ACCOUNT_WELCOME_STEPS = {
  /** What you coach. */
  coachCategories: [OnboardingSteps.CoachCategories],
  /** What you like to train, then your level and goals. */
  interests: [OnboardingSteps.Interests, OnboardingSteps.Level],
  /** Become a coach: the role question, then the coach's own steps. */
  role: [OnboardingSteps.Role],
} as const satisfies Record<string, readonly OnboardingStep[]>;

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
