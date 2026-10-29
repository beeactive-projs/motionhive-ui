import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { forkJoin, take } from 'rxjs';

import {
  AuthStore,
  ProfilePreviewAs,
  ProfileService,
  ProfileWorkout,
  PublicUserProfile,
  appLocale,
  formatTotalDuration,
  translate,
} from 'core';

import { ActionSheet } from '../../../_shared/components/action-sheet/action-sheet';
import type { SheetAction } from '../../../_shared/components/action-sheet/action-sheet.model';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { StatTile } from '../../../_shared/components/stat-tile/stat-tile';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { ReportWorkoutSheet } from '../_sheets/report-workout-sheet/report-workout-sheet';
import { PROFILE_WORKOUT_ICONS, profileWorkoutTiles } from './profile-workout.config';

type WorkoutActionId = 'report';

/**
 * One workout on someone's profile: who did it, when, their words, the
 * photo if there is one, and what it amounted to. Only the safe summary
 * the profile shows, never a note or a weight. The photo comes through
 * the API under the same rule as the workout, so it shows to exactly the
 * people the workout does.
 *
 * Mounted next to the profile in every stack that names people, at
 * `person/:handle/workout/:workoutLogId`. `?as=COACH` carries the owner's
 * preview of their own page as their coaches see it.
 */
@Component({
  selector: 'mh-profile-workout',
  imports: [
    ActionSheet,
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    ReportWorkoutSheet,
    StatTile,
    TranslatePipe,
  ],
  templateUrl: './profile-workout.html',
  styleUrl: './profile-workout.scss',
})
export class ProfileWorkoutPage {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _navController = inject(NavController);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _profileService = inject(ProfileService);
  private readonly _authStore = inject(AuthStore);

  readonly person = signal<PublicUserProfile | null>(null);
  readonly workout = signal<ProfileWorkout | null>(null);
  readonly photoUrl = signal<string | null>(null);
  readonly loading = signal(true);
  readonly unavailable = signal(false);

  readonly reportOpen = signal(false);
  readonly menuOpen = signal(false);
  readonly actions: readonly SheetAction<WorkoutActionId>[] = [
    {
      id: 'report',
      label: translate('person.workouts.report.action'),
      icon: 'flag-outline',
      destructive: true,
    },
  ];

  /** The profile this workout sits on, in the same stack: where back goes. */
  readonly profileUrl = computed(() =>
    this._router.url.split('?')[0].replace(/\/workout\/[^/]+$/, ''),
  );

  readonly name = computed(() => {
    const person = this.person();
    if (!person) return '';
    return (
      [person.firstName, person.lastName].filter(Boolean).join(' ').trim() ||
      translate('common.someone')
    );
  });

  readonly tone = computed(() => avatarToneFor(this.person()?.userId));

  /** Your own workout has nothing to report. */
  readonly isSelf = computed(
    () => !!this.person() && this.person()?.userId === this._authStore.user()?.id,
  );

  /** "Wednesday, 22 October 2026": the day, in full, as the page's kicker. */
  readonly day = computed(() => {
    const at = this.workout()?.completedAt;
    if (!at) return null;
    return new Date(at).toLocaleDateString(appLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  readonly tiles = computed(() => {
    const workout = this.workout();
    return workout ? profileWorkoutTiles(workout, formatTotalDuration) : [];
  });

  constructor() {
    addIcons(PROFILE_WORKOUT_ICONS);
    this._destroyRef.onDestroy(() => this._dropPhoto());

    const params = this._route.snapshot.paramMap;
    const handle = params.get('handle') ?? '';
    const workoutLogId = params.get('workoutLogId') ?? '';
    const previewAs: ProfilePreviewAs | undefined =
      this._route.snapshot.queryParamMap.get('as') === 'COACH' ? 'COACH' : undefined;
    this._load(handle, workoutLogId, previewAs);
  }

  openProfile(): void {
    void this._navController.navigateBack(this.profileUrl());
  }

  onAction(id: WorkoutActionId): void {
    if (id === 'report') this.reportOpen.set(true);
  }

  private _load(handle: string, workoutLogId: string, previewAs?: ProfilePreviewAs): void {
    if (!handle || !workoutLogId) {
      this.loading.set(false);
      this.unavailable.set(true);
      return;
    }
    // Either one missing is the same answer: there is nothing here for you.
    forkJoin({
      person: this._profileService.getUserByHandle(handle, previewAs),
      workout: this._profileService.getUserWorkout(handle, workoutLogId, previewAs),
    })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ person, workout }) => {
          this.person.set(person);
          this.workout.set(workout);
          this.loading.set(false);
          if (workout.hasPhoto) this._loadPhoto(handle, workout, previewAs);
        },
        error: () => {
          this.loading.set(false);
          this.unavailable.set(true);
        },
      });
  }

  /** Quiet on failure: the workout stands without its picture. */
  private _loadPhoto(handle: string, workout: ProfileWorkout, previewAs?: ProfilePreviewAs): void {
    this._profileService
      .getUserWorkoutPhoto(handle, workout.id, workout.photoVersion, previewAs)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (blob) => {
          this._dropPhoto();
          this.photoUrl.set(URL.createObjectURL(blob));
        },
        error: () => undefined,
      });
  }

  private _dropPhoto(): void {
    const url = this.photoUrl();
    if (url) URL.revokeObjectURL(url);
    this.photoUrl.set(null);
  }
}
