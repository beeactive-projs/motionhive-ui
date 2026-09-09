import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { AuthService, environment } from 'core';
import { ErrorDialog } from './_shared/components/error-dialog/error-dialog';
import { FeedbackDialog } from './_shared/components/feedback-dialog/feedback-dialog';
import { WaitlistDialog } from './_shared/components/waitlist-dialog/waitlist-dialog';
import { ImpersonationBanner } from './_shared/components/impersonation-banner/impersonation-banner';
import { PwaUpdate } from './_shared/components/pwa-update/pwa-update';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    FeedbackDialog,
    ErrorDialog,
    WaitlistDialog,
    ImpersonationBanner,
    PwaUpdate,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('web');

  private readonly _meta = inject(Meta);
  private readonly _authService = inject(AuthService);

  constructor() {
    this.tempDebugSession();

    const imageUrl = `${environment.appUrl}/svg/logo-navy.svg`;
    this._meta.addTags([
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: environment.appUrl },
      { property: 'og:title', content: 'MotionHive' },
      { property: 'og:description', content: 'Where active communities come together' },
      { property: 'og:image', content: imageUrl },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'MotionHive' },
      { name: 'twitter:description', content: 'Where active communities come together' },
      { name: 'twitter:image', content: imageUrl },
    ]);
  }

  /**
   * [TEMP-DEBUG] Prints which API this bundle resolved to and which
   * identity is in localStorage, so a "wrong environment" or "wrong
   * session" can be seen at a glance. Delete this whole method and its
   * call in the constructor once the notification issue is solved:
   * grep -rn "TEMP-DEBUG" projects/
   */
  private tempDebugSession(): void {
    try {
      const raw = localStorage.getItem('motionhive_user');
      const user = raw ? (JSON.parse(raw) as { id?: string; email?: string }) : null;
      const token = localStorage.getItem('motionhive_access_token');
      const claims = token
        ? (JSON.parse(atob(token.split('.')[1] ?? '')) as {
            sub?: string;
            act_as?: string;
            exp?: number;
          })
        : null;

      // eslint-disable-next-line no-console
      console.log('[TEMP-DEBUG] session', {
        apiUrl: environment.apiUrl,
        host: window.location.host,
        storedUser: user ? { id: user.id, email: user.email } : null,
        tokenSub: claims?.sub ?? null,
        impersonating: claims?.act_as ?? null,
        tokenExpired: claims?.exp ? claims.exp * 1000 < Date.now() : null,
        mismatch: !!user?.id && !!claims?.sub && user.id !== claims.sub,
      });
    } catch {
      /* diagnostic only — never break boot */
    }
  }
}
