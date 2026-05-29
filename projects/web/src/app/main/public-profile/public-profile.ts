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
import { ActivatedRoute, Router } from '@angular/router';
import {
  AuthStore,
  LockedAction,
  PublicProfileStore,
  ViewerMode,
  type AvatarUser,
  type ProfileBadge,
  type ProfileStat,
} from 'core';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  ProfileHero,
  type PublicProfileHero,
} from './_components/profile-hero/profile-hero';
import { ProfileSideRail } from './_components/profile-side-rail/profile-side-rail';
import { MobileCtaBar } from './_components/mobile-cta-bar/mobile-cta-bar';
import { StatStrip } from './_components/stat-strip/stat-strip';
import { UserProfile as UserProfileSection } from './_components/user-profile/user-profile';
import { UserSidePanel } from './_components/user-side-panel/user-side-panel';
import { AboutTab } from './tabs/about-tab/about-tab';
import { OfferingsTab } from './tabs/offerings-tab/offerings-tab';
import { GroupsTab } from './tabs/groups-tab/groups-tab';
import { ContactInstructorDialog } from './_dialogs/contact-instructor-dialog/contact-instructor-dialog';
import { SignupPromptDialog } from './_dialogs/signup-prompt-dialog/signup-prompt-dialog';
import { ShareDialog } from '../../_shared/components/share-dialog/share-dialog';

/**
 * `/@<handle>` — public profile shell.
 *
 * Branches on `isInstructor()`:
 *   - Instructor → stacked section cards (about / offerings / groups)
 *     with the sticky right rail and mobile CTA bar.
 *   - User       → long-scroll `<mh-user-profile>` wrapper.
 *
 * Mounted from two places, with identical behavior in both:
 *   - `pages/public-profile/` — for guests (slim public top bar above).
 *   - `main.routes.ts`        — for authed users (inside `SidenavLayout`).
 */
@Component({
  selector: 'mh-public-profile',
  imports: [
    Button,
    Message,
    SkeletonModule,
    ToastModule,
    ProfileHero,
    ProfileSideRail,
    MobileCtaBar,
    StatStrip,
    UserProfileSection,
    UserSidePanel,
    AboutTab,
    OfferingsTab,
    GroupsTab,
    ContactInstructorDialog,
    SignupPromptDialog,
    ShareDialog,
  ],
  providers: [MessageService],
  templateUrl: './public-profile.html',
  styleUrl: './public-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfile implements OnInit {
  private readonly _store = inject(PublicProfileStore);
  private readonly _authStore = inject(AuthStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _messageService = inject(MessageService);
  private readonly _currentYear = new Date().getFullYear();

  readonly Actions = LockedAction;

  readonly userProfile = this._store.userProfile;
  readonly profile = this._store.profile;
  readonly loading = this._store.loadingProfile;
  readonly error = this._store.error;

  /** Contact-instructor dialog visibility (existing `RequestToBeClientDialog`). */
  readonly contactDialogVisible = signal(false);

  /** Guest sign-up wall. Opened by `onLockedAction()` for Book / Save / Group intents. */
  readonly signupPromptVisible = signal(false);
  readonly signupPromptAction = signal<LockedAction>(LockedAction.Book);
  readonly signupPromptNext = computed(() => {
    const handle = this.userProfile()?.handle ?? '';
    return handle ? `/@${handle}` : '/';
  });
  readonly signupPromptInstructorName = computed(() => {
    const p = this.profile();
    if (p) return p.displayName || `${p.firstName} ${p.lastName}`.trim();
    const u = this.userProfile();
    return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '';
  });

  /** Public URL for the share dialog — `https://<origin>/@<handle>`. */
  readonly shareUrl = computed(() => {
    const handle = this.userProfile()?.handle ?? '';
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://motionhive.fit';
    return handle ? `${origin}/@${handle}` : origin;
  });

  /** Title line shown inside the share-dialog preview card. */
  readonly sharePreviewTitle = computed(() => {
    const p = this.profile();
    if (p) {
      const name = p.displayName || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
      return p.bio ? `${name} · ${p.bio}` : name;
    }
    const u = this.userProfile();
    return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'MotionHive';
  });

  /** Meta line below the preview title — location · experience · rating. */
  readonly sharePreviewSubtitle = computed(() => {
    const p = this.profile();
    const u = this.userProfile();
    const parts: string[] = [];
    const city = p?.city ?? u?.city;
    const country = p?.countryCode ?? u?.countryCode;
    if (city && country) parts.push(`${city}, ${country}`);
    else if (city) parts.push(city);
    if (p?.yearsOfExperience && p.yearsOfExperience > 0) {
      parts.push(`${p.yearsOfExperience} yrs experience`);
    }
    if (p?.rating && p.rating.total > 0) {
      parts.push(`★ ${p.rating.average.toFixed(1)} (${p.rating.total})`);
    }
    return parts.join(' · ');
  });

  /** Share dialog ships in Phase B2 — for now we just track the deep-link intent. */
  readonly shareDialogVisible = signal(false);

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
   * Drives the CTA matrix on hero / side rail / mobile CTA bar and the
   * locked-action mechanic. Guests get a signup prompt instead of the
   * real handler; owners see edit affordances; signed-in non-owners get
   * the regular interaction set.
   */
  readonly viewerMode = computed<ViewerMode>(() => {
    if (!this._authStore.isAuthenticated()) return ViewerMode.Guest;
    return this.isSelf() ? ViewerMode.Owner : ViewerMode.User;
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
        bio: inst.bio,
        yearsOfExperience: inst.yearsOfExperience,
        badges: this.instructorBadges(),
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
   * Stats derived from existing instructor fields. Backend ships the
   * full set (clients, sessions/year, reply time) in a later phase — for
   * now we render whatever real data we have. A 1-4 cell strip degrades
   * gracefully when the backend isn't populated yet.
   */
  readonly instructorStats = computed<ProfileStat[]>(() => {
    const p = this.profile();
    if (!p) return [];
    const stats: ProfileStat[] = [];
    if (p.rating && p.rating.total > 0) {
      stats.push({
        value: `${p.rating.average.toFixed(1)}★`,
        label: p.rating.total === 1 ? '1 review' : `${p.rating.total} reviews`,
      });
    }
    if (p.yearsOfExperience != null && p.yearsOfExperience > 0) {
      stats.push({
        value: `${p.yearsOfExperience}+`,
        label: 'Years coaching',
      });
    }
    if (p.certifications && p.certifications.length > 0) {
      stats.push({
        value: String(p.certifications.length),
        label: p.certifications.length === 1 ? 'Certification' : 'Certifications',
      });
    }
    if (p.specializations && p.specializations.length > 0) {
      stats.push({
        value: String(p.specializations.length),
        label: 'Specialties',
      });
    }
    return stats;
  });

  /** Header avatar for the contact dialog. */
  readonly instructorAvatar = computed<AvatarUser | null>(() => {
    const p = this.profile();
    if (!p) return null;
    return {
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      avatarUrl: p.avatarUrl,
    };
  });

  readonly instructorBadges = computed<ProfileBadge[]>(() => {
    const p = this.profile();
    if (!p) return [];
    const badges: ProfileBadge[] = [];
    if (p.rating && p.rating.average >= 4.8 && p.rating.total >= 30) {
      badges.push({
        id: 'top-rated',
        icon: 'star',
        label: `Top rated ${this._currentYear}`,
        sub: `${p.rating.average.toFixed(1)} over ${p.rating.total} reviews`,
        tone: 'gold',
      });
    }
    // First two certifications as navy shield badges.
    for (const cert of (p.certifications ?? []).slice(0, 2)) {
      badges.push({
        id: `cert-${cert.name}`,
        icon: 'shield',
        label: cert.name,
        tone: 'navy',
      });
    }
    return badges;
  });

  ngOnInit(): void {
    // Handle deep-link dialogs (/@<handle>/contact, /@<handle>/share) on
    // initial route activation. The intent flag is set on the child route
    // snapshot in `publicProfileTabRoutes`.
    const intent = this._route.firstChild?.snapshot.data?.['openDialog'] as
      | 'contact'
      | 'share'
      | undefined;
    if (intent === 'contact') this.contactDialogVisible.set(true);
    if (intent === 'share') this.shareDialogVisible.set(true);

    this._route.paramMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        const handle = params.get('handle');
        if (handle) this._store.load(handle);
      });
  }

  /** Hero/sidebar share button — opens the share dialog. */
  onShare(): void {
    this.shareDialogVisible.set(true);
  }

  /** Bookmark / save action — guests hit signup, authed users no-op until the bookmark feature ships. */
  onSave(): void {
    if (this.viewerMode() === ViewerMode.Guest) {
      this.onLockedAction(LockedAction.Save);
      return;
    }
    this._messageService.add({
      severity: 'info',
      summary: 'Saved',
      detail: 'Bookmarking is coming soon.',
      life: 2000,
    });
  }

  /** Hero edit button — only visible for owner. */
  onEdit(): void {
    void this._router.navigate(['/profile']);
  }

  onMessage(): void {
    if (this.viewerMode() === ViewerMode.Owner) return;
    // Contact on an instructor profile is the one always-public action
    // (lead capture) — both guests and authed viewers open the dialog.
    if (this.isInstructor()) {
      this.contactDialogVisible.set(true);
      return;
    }
    // User-to-user messaging still requires auth.
    if (this.viewerMode() === ViewerMode.Guest) {
      this.onLockedAction(LockedAction.Message);
      return;
    }
    const u = this.userProfile();
    if (u) void this._router.navigate(['/messages'], { queryParams: { to: u.userId } });
  }

  onBook(): void {
    if (this.viewerMode() === ViewerMode.Guest) {
      this.onLockedAction(LockedAction.Book);
      return;
    }
    void this._router.navigate(['offerings'], { relativeTo: this._route });
  }

  /**
   * Guest viewers hit a sign-up wall for every action that mutates state.
   * For Book we open the in-page signup prompt dialog; other locked
   * actions still redirect to `/auth/signup` until their flows pick up
   * the dialog too.
   */
  onLockedAction(action: LockedAction): void {
    if (this.viewerMode() !== ViewerMode.Guest) return;
    if (
      action === LockedAction.Book ||
      action === LockedAction.Save ||
      action === LockedAction.Group
    ) {
      this.signupPromptAction.set(action);
      this.signupPromptVisible.set(true);
      return;
    }
    void this._router.navigate(['/auth/signup'], {
      queryParams: { next: this.signupPromptNext(), intent: action },
    });
  }

  goBack(): void {
    void this._router.navigate(['/explore']);
  }
}
