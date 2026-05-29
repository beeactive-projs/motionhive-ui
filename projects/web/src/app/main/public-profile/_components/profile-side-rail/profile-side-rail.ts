import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Card } from 'primeng/card';
import { Button } from 'primeng/button';
import { MessageService } from 'primeng/api';
import type { PublicInstructorProfile, ViewerMode } from 'core';
import { countryNameFromCode, ViewerMode as ViewerModes } from 'core';

interface SocialLink {
  key: string;
  label: string;
  icon: string;
  url: string;
  display: string;
}

interface GlanceRow {
  icon: string;
  label: string;
  value: string;
}

/**
 * Sticky right rail (desktop ≥ lg) for the instructor profile:
 *   1. CTA card — pulse pill + name + reassurance + [Contact] + [Book].
 *   2. At a glance — label/value rows pulled from the profile.
 *   3. Find me elsewhere — socials list.
 *   4. Share row — `Liking this profile? [Share] [Copy link]`.
 *
 * Below `lg` the rail is hidden; its CTAs surface in the hero and
 * (later) in the sticky mobile CTA bar.
 */
@Component({
  selector: 'mh-profile-side-rail',
  imports: [DatePipe, Card, Button],
  templateUrl: './profile-side-rail.html',
  styleUrl: './profile-side-rail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSideRail {
  private readonly _messageService = inject(MessageService);

  readonly profile = input.required<PublicInstructorProfile>();
  readonly viewerMode = input.required<ViewerMode>();

  readonly book = output<void>();
  readonly message = output<void>();
  readonly share = output<void>();

  protected readonly Modes = ViewerModes;

  readonly isOwner = computed(() => this.viewerMode() === ViewerModes.Owner);

  readonly firstName = computed(() => this.profile().firstName?.trim() || 'them');

  readonly contactLabel = computed(() => `Contact ${this.firstName()}`);

  readonly glanceRows = computed<GlanceRow[]>(() => {
    const p = this.profile();
    const rows: GlanceRow[] = [];
    const location = [p.city, countryNameFromCode(p.countryCode)].filter(Boolean).join(', ');
    if (location) rows.push({ icon: 'pi pi-map-marker', label: 'Based in', value: location });
    if (p.yearsOfExperience != null && p.yearsOfExperience > 0) {
      const yrs = p.yearsOfExperience;
      rows.push({
        icon: 'pi pi-briefcase',
        label: 'Experience',
        value: `${yrs} ${yrs === 1 ? 'year' : 'years'}`,
      });
    }
    if (p.email) rows.push({ icon: 'pi pi-envelope', label: 'Email', value: p.email });
    if (p.phone) rows.push({ icon: 'pi pi-phone', label: 'Phone', value: p.phone });
    if (p.language) rows.push({ icon: 'pi pi-globe', label: 'Language', value: p.language });
    if (p.timezone) rows.push({ icon: 'pi pi-clock', label: 'Timezone', value: p.timezone });
    return rows;
  });

  readonly socials = computed<SocialLink[]>(() => {
    const links = this.profile().socialLinks ?? {};
    const out: SocialLink[] = [];
    const push = (key: string, label: string, icon: string, url: string | undefined) => {
      if (!url) return;
      out.push({ key, label, icon, url, display: this.displayHandle(url) });
    };
    push('instagram', 'Instagram', 'pi pi-instagram', links['instagram']);
    push('youtube', 'YouTube', 'pi pi-youtube', links['youtube']);
    push('tiktok', 'TikTok', 'pi pi-tiktok', links['tiktok']);
    push('facebook', 'Facebook', 'pi pi-facebook', links['facebook']);
    push('twitter', 'X / Twitter', 'pi pi-twitter', links['twitter']);
    push('linkedin', 'LinkedIn', 'pi pi-linkedin', links['linkedin']);
    push('website', 'Website', 'pi pi-globe', links['website']);
    return out;
  });

  /**
   * Pull a recognisable handle / hostname out of a URL so the row reads
   * `Instagram   @mayapetrov` rather than a full URL.
   */
  private displayHandle(url: string): string {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      const path = u.pathname.replace(/\/$/, '');
      const segments = path.split('/').filter(Boolean);
      const first = segments[0]?.replace(/^@/, '');

      if (host.includes('instagram.com') || host.includes('tiktok.com')) {
        return first ? `@${first}` : host;
      }
      if (host.includes('youtube.com')) {
        return path.startsWith('/@') ? path.slice(1) : `youtube.com${path}`;
      }
      if (host.includes('facebook.com') || host.endsWith('fb.com')) {
        return first ? `@${first}` : host;
      }
      if (host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')) {
        return first ? `@${first}` : host;
      }
      if (host.includes('linkedin.com')) {
        // linkedin.com/in/<handle>, /company/<slug>, /school/<slug>
        const slug = segments[1] ?? segments[0];
        return slug ? `@${slug.replace(/^@/, '')}` : host;
      }
      return host + (path && path !== '/' ? path : '');
    } catch {
      return url;
    }
  }

  onCopyLink(): void {
    const handle = this.profile().handle;
    if (!handle) return;
    const url = `${window.location.origin}/@${handle}`;
    void navigator.clipboard.writeText(url).then(
      () =>
        this._messageService.add({
          severity: 'success',
          summary: 'Link copied',
          detail: url,
          life: 2000,
        }),
      () =>
        this._messageService.add({
          severity: 'warn',
          summary: 'Copy failed',
          detail: 'Couldn\'t copy the link. Long-press to copy manually.',
          life: 2500,
        }),
    );
  }
}
