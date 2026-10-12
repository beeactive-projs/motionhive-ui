import { LOCALE_ID, inject } from '@angular/core';
import { languageOfLocale, withAppLanguage } from 'core';

/**
 * Canonical site identity — the single source of truth for absolute URLs.
 *
 * Used by the canonical/hreflang links, every JSON-LD block, and share links.
 * Do not re-declare `SITE_ORIGIN` in a component; import it from here.
 */
export const SITE_ORIGIN = 'https://www.motionhive.fit';

/** Absolute URL of the brand logo (JSON-LD `Organization.logo`, og:image). */
export const SITE_LOGO_URL = `${SITE_ORIGIN}/png/logo-bg-navy.png`;

/**
 * True when the running localized build is Romanian. Each locale is compiled
 * separately and Angular stamps `<html lang>`, so that's the reliable signal
 * (works during prerender too).
 */
export function isRoLocale(doc: Document): boolean {
  return (doc.documentElement.lang || 'en').toLowerCase().startsWith('ro');
}

/**
 * Absolute, locale-aware URL for a site path — EN at the root, RO under /ro.
 * `siteUrl('/pricing', true)` → `https://www.motionhive.fit/ro/pricing`.
 */
export function siteUrl(path: string, isRo: boolean): string {
  const clean = path === '/' ? '' : path;
  return `${SITE_ORIGIN}${isRo ? '/ro' : ''}${clean}`;
}

/**
 * A web app URL (sign-up, login) that opens the app in this build's language,
 * so a visitor reading the Romanian site lands in a Romanian app regardless of
 * the language their browser or device last stored. A signed-in user keeps
 * their account's language instead. Call it from a field initializer (needs
 * an injection context).
 */
export function webAppLink(url: string): string {
  return withAppLanguage(url, languageOfLocale(inject(LOCALE_ID)));
}
