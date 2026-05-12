import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { Button } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { Avatar } from '../../../../_shared/components/avatar/avatar';
import type { AvatarUser } from 'core';

/**
 * Minimal shape ProfileHero needs to render. Both
 * `PublicInstructorProfile` and `PublicUserProfile` adapt cleanly into
 * this — the page composes the right object up front so the hero
 * doesn't have to branch on type at the template layer.
 *
 * Instructor-only fields (`displayName`, `isAcceptingClients`) are
 * optional; user-only fields (`displayRoles`) are too.
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
  isAcceptingClients?: boolean | null;
  displayRoles?: string[];
  /**
   * Show the "Message" / "Book a session" CTAs. Only instructor heroes
   * use them; user-only heroes hide them entirely.
   */
  showInstructorCtas?: boolean;
}

@Component({
  selector: 'mh-profile-hero',
  imports: [Avatar, Button, TagModule],
  templateUrl: './profile-hero.html',
  styleUrl: './profile-hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileHero {
  readonly profile = input.required<PublicProfileHero>();
  readonly isSelf = input<boolean>(false);

  readonly book = output<void>();
  readonly message = output<void>();

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
    return p.displayName || full || (p.handle ? `@${p.handle}` : 'Member');
  });

  readonly locationLabel = computed(() => {
    const p = this.profile();
    return [p.city, p.countryCode].filter(Boolean).join(', ');
  });

  readonly showCtas = computed(
    () => !this.isSelf() && !!this.profile().showInstructorCtas,
  );
}
