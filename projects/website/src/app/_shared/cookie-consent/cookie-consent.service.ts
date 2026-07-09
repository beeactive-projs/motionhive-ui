import { Injectable, PLATFORM_ID, effect, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ThemeService } from 'core';
import type { CookieConsentConfig } from 'vanilla-cookieconsent';

/**
 * Lightweight wrapper around `vanilla-cookieconsent`.
 *
 * The library (~10 KB gzip) is loaded with a dynamic `import()` so it lands in
 * its own chunk and is fetched on browser idle — it never blocks first paint.
 * We currently only declare `necessary` + `functional`; an `analytics` category
 * goes here the day we add tracking (see the marker below).
 */
@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly theme = inject(ThemeService);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private api: typeof import('vanilla-cookieconsent') | null = null;
  private started = false;

  constructor() {
    if (this.isBrowser) {
      // Keep the consent UI in step with the site's light/dark theme.
      effect(() => {
        document.documentElement.classList.toggle('cc--darkmode', this.theme.isDark());
      });
    }
  }

  /** Fire-and-forget init from the root component; defers to idle. */
  init(): void {
    if (this.started || !this.isBrowser) return;
    this.started = true;
    const start = (): void => void this.run();
    const ric = (
      window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }
    ).requestIdleCallback;
    if (ric) ric(start, { timeout: 2000 });
    else setTimeout(start, 1200);
  }

  /** Re-open the preferences modal (used by the footer link). */
  async showPreferences(): Promise<void> {
    if (!this.isBrowser) return;
    if (!this.api) await this.run();
    this.api?.showPreferences();
  }

  private async run(): Promise<void> {
    if (this.api) return;
    this.api = await import('vanilla-cookieconsent');
    await this.api.run(this.config());
  }

  private config(): CookieConsentConfig {
    return {
      guiOptions: {
        consentModal: { layout: 'box wide', position: 'bottom left', equalWeightButtons: true },
        preferencesModal: { layout: 'box', equalWeightButtons: true },
      },
      categories: {
        necessary: { enabled: true, readOnly: true },
        functional: { enabled: true },
        // analytics: {},  // <- add here (with default-off) when GTM/analytics is introduced
      },
      language: {
        default: 'en',
        translations: {
          en: {
            consentModal: {
              title: $localize`:@@cc.modal.title:We use cookies`,
              description: $localize`:@@cc.modal.desc:We use essential cookies to run MotionHive and functional cookies to remember your preferences (like theme and language). We don't use tracking or advertising cookies. See our <a href="/legal/cookie-policy" class="cc__link">Cookie Policy</a>.`,
              acceptAllBtn: $localize`:@@cc.acceptAll:Accept all`,
              acceptNecessaryBtn: $localize`:@@cc.rejectAll:Reject all`,
              showPreferencesBtn: $localize`:@@cc.manage:Manage preferences`,
            },
            preferencesModal: {
              title: $localize`:@@cc.pm.title:Cookie preferences`,
              acceptAllBtn: $localize`:@@cc.acceptAll:Accept all`,
              acceptNecessaryBtn: $localize`:@@cc.rejectAll:Reject all`,
              savePreferencesBtn: $localize`:@@cc.save:Save preferences`,
              closeIconLabel: $localize`:@@cc.close:Close`,
              sections: [
                {
                  title: $localize`:@@cc.pm.necessary.title:Strictly necessary`,
                  description: $localize`:@@cc.pm.necessary.desc:Required to run the website and keep you signed in. These cannot be switched off.`,
                  linkedCategory: 'necessary',
                },
                {
                  title: $localize`:@@cc.pm.functional.title:Functional`,
                  description: $localize`:@@cc.pm.functional.desc:Remember your preferences, such as theme, language, and saved tool inputs. Not used for tracking.`,
                  linkedCategory: 'functional',
                },
                {
                  title: $localize`:@@cc.pm.more.title:More information`,
                  description: $localize`:@@cc.pm.more.desc:For any questions about our use of cookies, <a href="mailto:contact@motionhive.fit" class="cc__link">contact us</a> or read our <a href="/legal/cookie-policy" class="cc__link">Cookie Policy</a>.`,
                },
              ],
            },
          },
        },
      },
    };
  }
}
