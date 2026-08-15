import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  AuthStore,
  ProfileService,
  countryNameFromCode,
  PublicInstructorProfile,
  PublicUserProfile,
} from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../_shared/utils/avatar-tone.utils';
import { injectOpenDirectMessage } from '../../_shared/utils/direct-message';
import { PERSON_ICONS } from './person.config';

/**
 * Someone else's profile, reached from anywhere a person is named.
 *
 * The server decides what a given viewer may see and nulls the rest, so this
 * renders whatever came back rather than deciding for itself. A coach viewing
 * their own client gets contact details; the same screen for a stranger shows
 * name and roles only.
 *
 * Registered under both the sessions and messages tabs so the tab you came
 * from stays lit and back returns where you were.
 */
@Component({
  selector: 'mh-person',
  imports: [
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './person.html',
  styleUrl: './person.scss',
})
export class Person {
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _profileService = inject(ProfileService);
  private readonly _authStore = inject(AuthStore);
  private readonly _openDirectMessage = injectOpenDirectMessage();
  private readonly _router = inject(Router);

  /**
   * Where back goes on a cold load. The screen is mounted under two tabs, so
   * the fallback follows whichever one the URL is in — without it a deep link
   * renders a header with no way out.
   */
  readonly backHref = computed(() =>
    this._router.url.startsWith('/tabs/messages') ? '/tabs/messages' : '/tabs/sessions',
  );

  readonly profile = signal<PublicUserProfile | null>(null);
  /**
   * Only instructors have one. It carries everything the generic profile
   * omits — bio, specializations, experience, rating — which is why
   * `isInstructor` exists on the payload as a hint to come and get it.
   */
  readonly coachProfile = signal<PublicInstructorProfile | null>(null);
  readonly loading = signal(false);
  readonly notFound = signal(false);

  readonly name = computed(() => {
    const profile = this.profile();
    if (!profile) return '';
    return [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || 'Someone';
  });

  readonly firstName = computed(() => this.profile()?.firstName?.trim() || 'They');

  readonly tone = computed(() => avatarToneFor(this.profile()?.userId));

  /** Your own profile is edited in Account, not messaged from here. */
  readonly isSelf = computed(
    () => !!this.profile() && this.profile()?.userId === this._authStore.user()?.id,
  );

  /** USER is filtered out server-side, so anything left is worth showing. */
  readonly roles = computed(() => this.profile()?.displayRoles ?? []);

  readonly location = computed(() => {
    const profile = this.profile();
    if (!profile) return null;
    // "RO" on its own tells you nothing; the country name does.
    const country = countryNameFromCode(profile.countryCode);
    return [profile.city, country].filter(Boolean).join(', ') || null;
  });

  readonly memberSince = computed(() => {
    const iso = this.profile()?.memberSince;
    if (!iso) return null;
    return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  });

  /** Contact rows only exist when the viewer's tier includes them. */
  readonly hasContactDetails = computed(() => {
    const profile = this.profile();
    return !!profile && (!!profile.email || !!profile.phone || !!this.location());
  });

  readonly bio = computed(() => this.coachProfile()?.bio?.trim() || null);

  readonly specializations = computed(() => this.coachProfile()?.specializations ?? []);

  readonly experience = computed(() => {
    const years = this.coachProfile()?.yearsOfExperience;
    if (!years) return null;
    return `${years} ${years === 1 ? 'year' : 'years'} of experience`;
  });

  readonly rating = computed(() => {
    const rating = this.coachProfile()?.rating;
    if (!rating || rating.total === 0) return null;
    return `${rating.average.toFixed(1)} · ${rating.total} ${rating.total === 1 ? 'review' : 'reviews'}`;
  });

  /**
   * Nothing beyond a name and a handle. Worth saying out loud rather than
   * leaving a screen that looks like it failed to load.
   */
  readonly hasNothingToShow = computed(
    () =>
      !!this.profile() &&
      !this.bio() &&
      this.specializations().length === 0 &&
      !this.experience() &&
      !this.rating() &&
      !this.hasContactDetails() &&
      this.roles().length === 0,
  );

  constructor() {
    addIcons(PERSON_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const handle = params.get('handle');
      if (handle) this.load(handle);
    });
  }

  load(handle: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.coachProfile.set(null);

    this._profileService
      .getUserByHandle(handle)
      .pipe(take(1))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.loading.set(false);
          if (profile.isInstructor) this._loadCoachProfile(handle);
        },
        error: () => {
          this.loading.set(false);
          this.notFound.set(true);
        },
      });
  }

  /** Silent on failure: a private or missing coach profile just means no bio. */
  private _loadCoachProfile(handle: string): void {
    this._profileService
      .getInstructorByHandle(handle)
      .pipe(take(1))
      .subscribe({
        next: (coach) => this.coachProfile.set(coach),
        error: () => this.coachProfile.set(null),
      });
  }

  message(): void {
    const profile = this.profile();
    if (!profile) return;
    this._openDirectMessage({
      id: profile.userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
    });
  }
}
