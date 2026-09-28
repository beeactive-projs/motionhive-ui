import {
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Avatar } from '../../../../_shared/components/avatar/avatar';
import { BadgeStrip } from '../badge-strip/badge-strip';
import {
  type AvatarUser,
  countryNameFromCode,
  EnumLabelPipe,
  type ProfileBadge,
  ViewerMode,
} from 'core';

/**
 * Minimal shape ProfileHero needs to render. Both
 * `PublicInstructorProfile` and `PublicUserProfile` adapt cleanly into
 * this — the page composes the right object up front so the hero
 * doesn't have to branch on type at the template layer.
 */
export interface PublicProfileHero {
  userId: string;
  handle: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName?: string | null;
  avatarUrl: string | null;
  city: string | null;
  countryCode: string | null;
  /** Instructor only — drives the pulse pill in the meta line. */
  isAcceptingClients?: boolean | null;
  /** Short bio shown under the name. */
  bio?: string | null;
  /** Instructor only — shown in the meta line as `N yrs coaching`. */
  yearsOfExperience?: number | null;
  /** User only — chip row in the meta line. */
  displayRoles?: string[];
  /**
   * Credibility badges (verified, top-rated, fast responder, certs).
   * Empty until the backend ships the computation; the strip renders
   * nothing if empty.
   */
  badges?: readonly ProfileBadge[];
  /**
   * Show the instructor-specific CTAs (Book a session, Contact lead
   * capture). User profiles set this false so the lighter user-mode
   * CTAs render instead.
   */
  showInstructorCtas?: boolean;
}

@Component({
  selector: 'mh-profile-hero',
  imports: [Avatar, ButtonDirective, Card, BadgeStrip, RouterLink, TranslatePipe, EnumLabelPipe],
  templateUrl: './profile-hero.html',
  styleUrl: './profile-hero.scss',
})
export class ProfileHero {
  private readonly _translateService = inject(TranslateService);

  readonly profile = input.required<PublicProfileHero>();
  readonly viewerMode = input.required<ViewerMode>();

  readonly book = output<void>();
  readonly message = output<void>();
  readonly share = output<void>();
  readonly save = output<void>();
  readonly edit = output<void>();

  readonly avatarUser = computed<AvatarUser>(() => {
    const p = this.profile();
    return {
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      avatarUrl: p.avatarUrl,
    };
  });

  readonly displayName = computed(() => {
    const p = this.profile();
    const full = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
    return (
      p.displayName ||
      full ||
      (p.handle ? `@${p.handle}` : this._translateService.instant('publicProfile.hero.member'))
    );
  });

  readonly firstName = computed(() => this.profile().firstName?.trim() || null);

  readonly locationLabel = computed(() => {
    const p = this.profile();
    return [p.city, countryNameFromCode(p.countryCode)].filter(Boolean).join(', ');
  });

  readonly yearsLabel = computed(() => {
    const yrs = this.profile().yearsOfExperience;
    if (yrs == null || yrs <= 0) return null;
    return this._translateService.instant('publicProfile.hero.yearsCoaching', { count: yrs });
  });

  /** Personalises the primary CTA, e.g. `Contact Maya`. */
  readonly contactLabel = computed(() => {
    const name = this.firstName();
    return name
      ? this._translateService.instant('publicProfile.common.contactName', { name })
      : this._translateService.instant('publicProfile.common.contact');
  });

  readonly badges = computed<readonly ProfileBadge[]>(
    () => this.profile().badges ?? [],
  );

  readonly isOwner = computed(() => this.viewerMode() === ViewerMode.Owner);

  readonly showInstructorCtas = computed(
    () => !this.isOwner() && !!this.profile().showInstructorCtas,
  );

  readonly showUserCtas = computed(
    () => !this.isOwner() && !this.profile().showInstructorCtas,
  );
}
