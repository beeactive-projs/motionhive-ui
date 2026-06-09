import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  apiErrorMessage,
  AuthService,
  BillingCountsStore,
  ClientService,
  countryNameFromCode,
  MyProfile,
  PrivacyControlledField,
  ProfilePrivacy,
  ProfileService,
  PublicProfileStore,
  showApiError,
  UserPrivacySettings,
  UserService,
} from 'core';
import { MessageService } from 'primeng/api';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { SkeletonModule } from 'primeng/skeleton';
import { CardModule } from 'primeng/card';
import { Button } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ProfileHeroCard } from './_components/profile-hero-card/profile-hero-card';
import { Details } from './tabs/details/details';
import { ProfileCoaches } from './tabs/coaches/coaches';
import { ProfileNotifications } from './tabs/notifications/notifications';
import { ProfileSafety } from './tabs/safety/safety';
import { ProfileBilling } from './tabs/billing/billing';
import { EditPersonalInfo } from './_dialogs/edit-personal-info/edit-personal-info';
import { EditHandle } from './_dialogs/edit-handle/edit-handle';
import { ShareDialog } from '../../_shared/components/share-dialog/share-dialog';

export const ProfileTabs = {
  Details: 'details',
  Coaches: 'coaches',
  Billing: 'billing',
  Notifications: 'notifications',
  Safety: 'safety',
} as const;

export type ProfileTab = (typeof ProfileTabs)[keyof typeof ProfileTabs];

const VALID_TABS = new Set<string>(Object.values(ProfileTabs));

/**
 * Legacy tab values still arriving from notification deep-links
 * (`screen: 'profile', queryParams: { tab: 'invoices' | 'memberships' }`
 * in the BE notifications). Both now resolve to the consolidated Billing
 * tab — don't drop these mappings without updating the BE notifications.
 */
const LEGACY_TAB_ALIASES: Record<string, ProfileTab> = {
  invoices: ProfileTabs.Billing,
  memberships: ProfileTabs.Billing,
};

/**
 * `/profile` — Facebook-style owner view.
 *
 * The page owns identity-level state (avatar upload, optimistic
 * privacy override, dialog visibility) so the hero card stays
 * presentational and the Details tab is just a card composer. Tab
 * routing and `MyProfile` fetch remain here unchanged.
 */
@Component({
  selector: 'mh-profile',
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    SkeletonModule,
    CardModule,
    Button,
    ToastModule,
    ProfileHeroCard,
    Details,
    ProfileCoaches,
    ProfileNotifications,
    ProfileSafety,
    ProfileBilling,
    EditPersonalInfo,
    EditHandle,
    ShareDialog,
  ],
  providers: [MessageService],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile implements OnInit {
  private readonly _profileService = inject(ProfileService);
  private readonly _userService = inject(UserService);
  private readonly _authService = inject(AuthService);
  private readonly _billingCounts = inject(BillingCountsStore);
  private readonly _clientService = inject(ClientService);
  private readonly _publicProfileStore = inject(PublicProfileStore);
  private readonly _messageService = inject(MessageService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  readonly Tabs = ProfileTabs;

  /** Server-truth snapshot of MyProfile (set by `loadProfile`). */
  private readonly _rawProfile = signal<MyProfile | null>(null);

  /**
   * Optimistic patch applied on top of `_rawProfile.account.privacySettings`.
   * Survives across tab switches so quickly flipping a chooser doesn't
   * reset back to server truth before the PATCH resolves. Cleared on
   * full profile reload.
   */
  private readonly _privacyOverride = signal<UserPrivacySettings | null>(null);

  readonly loading = signal(true);
  readonly incomingRequestsCount = signal(0);

  /**
   * Optimistic avatar URL — wins over the server value between a
   * successful upload and the parent reloading the profile.
   */
  readonly pendingAvatarUrl = signal<string | null>(null);
  readonly uploadingAvatar = signal(false);
  readonly resendingVerification = signal(false);

  readonly editPersonalInfoVisible = signal(false);
  readonly editHandleVisible = signal(false);
  readonly shareDialogVisible = signal(false);

  /**
   * The effective MyProfile passed to children — applies the optimistic
   * privacy override and the pending avatar URL on top of server truth.
   */
  readonly profile = computed<MyProfile | null>(() => {
    const raw = this._rawProfile();
    if (!raw) return null;
    const override = this._privacyOverride();
    const pendingAvatar = this.pendingAvatarUrl();
    if (!override && pendingAvatar === null) return raw;
    return {
      ...raw,
      account: {
        ...raw.account,
        ...(pendingAvatar !== null ? { avatarUrl: pendingAvatar } : null),
        privacySettings: override
          ? { ...raw.account.privacySettings, ...override }
          : raw.account.privacySettings,
      },
    };
  });

  private readonly _queryParams = toSignal(this._route.queryParamMap, {
    initialValue: this._route.snapshot.queryParamMap,
  });

  readonly activeTab = computed<ProfileTab>(() => {
    const tab = this._queryParams().get('tab');
    let resolved: ProfileTab = ProfileTabs.Details;
    if (tab) {
      if (LEGACY_TAB_ALIASES[tab]) resolved = LEGACY_TAB_ALIASES[tab];
      else if (VALID_TABS.has(tab)) resolved = tab as ProfileTab;
    }
    // The Billing tab only exists once the user has billing — a stale
    // bookmark / deep-link to it falls back to Details instead of a blank.
    if (resolved === ProfileTabs.Billing && !this._billingCounts.hasBilling()) {
      return ProfileTabs.Details;
    }
    return resolved;
  });

  /**
   * Billing surfaces read the shared cached counts (one request per
   * session, fetched by the account menu). Tab hides until the user has
   * real billing; badge shows open invoices needing payment.
   */
  readonly showBillingTab = this._billingCounts.hasBilling;
  readonly billingBadge = this._billingCounts.openInvoices;

  ngOnInit(): void {
    this.loadProfile();
    // Idempotent — reuses the cache the account menu already populated.
    this._billingCounts.ensureLoaded();
    this.loadIncomingRequestsCount();
  }

  loadProfile(): void {
    this.loading.set(true);
    this._profileService.getMyProfile().subscribe({
      next: (data) => {
        this._rawProfile.set(data);
        // Server response is canonical — drop the optimistic layers.
        this._privacyOverride.set(null);
        this.pendingAvatarUrl.set(null);
        this.loading.set(false);
        // Drop any cached public-profile view of this handle so the
        // next visit re-fetches and reflects edits made here
        // (e.g. social-links visibility toggle).
        this._publicProfileStore.invalidate(data.account.handle);
      },
      error: () => {
        this.loading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load profile data',
        });
      },
    });
  }

  onTabChange(value: string | number | undefined): void {
    const tab =
      typeof value === 'string' && VALID_TABS.has(value)
        ? value
        : ProfileTabs.Details;
    if (tab === this.activeTab()) return;
    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  // -------------------------------------------------------------
  // Hero action handlers
  // -------------------------------------------------------------

  viewAsPublic(): void {
    const handle = this.profile()?.account.handle;
    if (!handle) return;
    void this._router.navigate(['/@' + handle]);
  }

  onShare(): void {
    if (!this.profile()?.account.handle) return;
    this.shareDialogVisible.set(true);
  }

  /** Public URL of the current user's profile — `https://<origin>/@<handle>`. */
  readonly shareUrl = computed(() => {
    const handle = this.profile()?.account.handle ?? '';
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://motionhive.fit';
    return handle ? `${origin}/@${handle}` : origin;
  });

  /** Preview card title — full name (+ instructor bio if present). */
  readonly sharePreviewTitle = computed(() => {
    const p = this.profile();
    if (!p) return 'MotionHive';
    const name = `${p.account.firstName} ${p.account.lastName}`.trim();
    const bio = p.instructorProfile?.bio?.trim();
    return bio ? `${name} · ${bio}` : name;
  });

  /** Preview card meta — `city, Country · N yrs experience`. */
  readonly sharePreviewSubtitle = computed(() => {
    const p = this.profile();
    if (!p) return '';
    const parts: string[] = [];
    const city = p.account.city;
    const country = countryNameFromCode(p.account.countryCode);
    if (city && country) parts.push(`${city}, ${country}`);
    else if (city) parts.push(city);
    else if (country) parts.push(country);
    const years = p.instructorProfile?.yearsOfExperience;
    if (years && years > 0) parts.push(`${years} yrs experience`);
    return parts.join(' · ');
  });

  onAvatarSelected(file: File): void {
    this.uploadingAvatar.set(true);
    this._userService.uploadAvatar(file).subscribe({
      next: ({ avatarUrl }) => {
        this.pendingAvatarUrl.set(avatarUrl);
        this.uploadingAvatar.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Profile picture updated',
        });
        this.loadProfile();
      },
      error: (err: unknown) => {
        this.uploadingAvatar.set(false);
        showApiError(
          this._messageService,
          'Upload failed',
          'Could not upload the picture.',
          err,
        );
      },
    });
  }

  /**
   * Re-sends the email-verification link. Backend is rate-limited and
   * idempotent, so we surface any rejection as info rather than error.
   */
  resendVerification(): void {
    if (this.resendingVerification()) return;
    const email = this.profile()?.account.email;
    if (!email) return;
    this.resendingVerification.set(true);
    this._authService.resendVerification(email).subscribe({
      next: () => {
        this.resendingVerification.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Verification email sent',
          detail: `Check ${email}.`,
        });
      },
      error: (err: unknown) => {
        this.resendingVerification.set(false);
        this._messageService.add({
          severity: 'info',
          summary: 'Could not resend',
          detail: apiErrorMessage(
            err,
            'If the email is already verified or you recently asked, please try again later.',
          ),
        });
      },
    });
  }

  // -------------------------------------------------------------
  // Privacy patch — owned by the page so override survives tab switches
  // -------------------------------------------------------------

  onPrivacyChange(event: {
    field: PrivacyControlledField;
    level: ProfilePrivacy;
  }): void {
    const { field, level } = event;
    const baseline =
      this._privacyOverride() ??
      this._rawProfile()?.account.privacySettings ??
      {};
    const optimistic: UserPrivacySettings = { ...baseline, [field]: level };
    this._privacyOverride.set(optimistic);

    this._profileService.updatePrivacy({ [field]: level }).subscribe({
      next: (res) => {
        this._privacyOverride.set(res.privacySettings ?? optimistic);
      },
      error: (err: unknown) => {
        this._privacyOverride.set(baseline);
        showApiError(
          this._messageService,
          'Error',
          'Could not update visibility.',
          err,
        );
      },
    });
  }

  // -------------------------------------------------------------
  // Tabs / counts
  // -------------------------------------------------------------

  private loadIncomingRequestsCount(): void {
    this._clientService.getPendingRequests().subscribe({
      next: (requests) =>
        this.incomingRequestsCount.set(
          requests.filter((r) => r.type === 'INSTRUCTOR_TO_CLIENT').length,
        ),
      error: () => this.incomingRequestsCount.set(0),
    });
  }
}
