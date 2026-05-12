import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { AuthStore, PublicProfileStore } from 'core';
import { Button } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { Message } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import {
  ProfileHero,
  type PublicProfileHero,
} from './_components/profile-hero/profile-hero';
import { ProfileTabs } from './_components/profile-tabs/profile-tabs';
import { ProfileSideRail } from './_components/profile-side-rail/profile-side-rail';
import { MobileCtaBar } from './_components/mobile-cta-bar/mobile-cta-bar';
import { RequestToBeClientDialog } from '../../_shared/components/request-to-be-client-dialog/request-to-be-client-dialog';
import { MessageService } from 'primeng/api';
import { DatePipe } from '@angular/common';

/**
 * `/@<handle>` — public profile of an instructor.
 *
 * Owns the root layout (hero + stat strip + tabs + sticky right rail
 * + mobile sticky CTA bar). All tab data flows through `PublicProfileStore`
 * so tab switches don't refetch the root profile.
 */
@Component({
  selector: 'mh-public-profile',
  imports: [
    RouterOutlet,
    Button,
    CardModule,
    DatePipe,
    Message,
    SkeletonModule,
    ToastModule,
    ProfileHero,
    ProfileTabs,
    ProfileSideRail,
    MobileCtaBar,
    RequestToBeClientDialog,
  ],
  providers: [MessageService],
  templateUrl: './public-profile.html',
  styleUrl: './public-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfile implements OnInit {
  readonly store = inject(PublicProfileStore);
  private readonly _authStore = inject(AuthStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  readonly userProfile = this.store.userProfile;
  readonly profile = this.store.profile;
  readonly loading = this.store.loadingProfile;
  readonly error = this.store.error;
  readonly dialogVisible = signal(false);

  /**
   * The instructor branch only renders once the instructor payload
   * has actually arrived — the user payload may resolve first when a
   * handle belongs to an instructor (we fan out in parallel).
   */
  readonly isInstructor = computed(
    () => !!this.userProfile()?.isInstructor && !!this.profile(),
  );

  /** Server should be the source of truth, but client-side gate is fine for v1. */
  readonly isSelf = computed(() => {
    const me = this._authStore.user();
    const u = this.userProfile();
    return !!(me && u && me.id === u.userId);
  });

  /**
   * Hero needs to render against either profile shape. Prefer the
   * instructor payload when present so we keep `displayName` /
   * `isAcceptingClients`; fall back to the user payload otherwise.
   */
  readonly heroProfile = computed<PublicProfileHero | null>(() => {
    const inst = this.profile();
    const user = this.userProfile();
    if (inst) {
      return {
        userId: inst.userId,
        handle: inst.handle,
        firstName: inst.firstName ?? null,
        lastName: inst.lastName ?? null,
        displayName: inst.displayName,
        avatarUrl: inst.avatarUrl,
        city: inst.city,
        countryCode: inst.countryCode,
        isAcceptingClients: inst.isAcceptingClients,
        showInstructorCtas: true,
      };
    }
    if (user) {
      return {
        userId: user.userId,
        handle: user.handle,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: null,
        avatarUrl: user.avatarUrl,
        city: user.city,
        countryCode: user.countryCode,
        displayRoles: user.displayRoles,
        showInstructorCtas: false,
      };
    }
    return null;
  });

  /**
   * Visible facts for the non-instructor about card. The server has
   * already masked anything the viewer isn't allowed to see, so we
   * just keep the non-null entries and render them in a predictable
   * order.
   */
  readonly visibleFacts = computed<{ label: string; value: string }[]>(() => {
    const u = this.userProfile();
    if (!u) return [];
    const facts: { label: string; value: string }[] = [];
    if (u.email) facts.push({ label: 'Email', value: u.email });
    if (u.phone) facts.push({ label: 'Phone', value: u.phone });
    const location = [u.city, u.countryCode].filter(Boolean).join(', ');
    if (location) facts.push({ label: 'Location', value: location });
    if (u.language) facts.push({ label: 'Language', value: u.language });
    if (u.timezone) facts.push({ label: 'Timezone', value: u.timezone });
    return facts;
  });

  ngOnInit(): void {
    this._route.paramMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        const handle = params.get('handle');
        if (handle) this.store.load(handle);
      });
  }

  onMessage(): void {
    if (this.isSelf()) return;
    this.dialogVisible.set(true);
  }

  onBook(): void {
    void this._router.navigate(['offerings'], { relativeTo: this._route });
  }

  goBack(): void {
    void this._router.navigate(['/explore']);
  }
}
