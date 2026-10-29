import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonBackButton,
  IonBadge,
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
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import {
  AuthStore,
  ProfilePreviewAs,
  ProfileWorkout,
  PublicSharedGroup,
  appLocale,
  countryNameFromCode,
  languageName,
  publicProfileUrl,
  timezonePlace,
  translate,
} from 'core';

import { ActionSheet } from '../../_shared/components/action-sheet/action-sheet';
import type { SheetAction } from '../../_shared/components/action-sheet/action-sheet.model';
import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { DETAIL_TILES } from '../../_shared/config/detail-tiles.config';
import { avatarToneFor } from '../../_shared/utils/avatar-tone.utils';
import { injectOpenDirectMessage } from '../../_shared/utils/direct-message';
import { ProfileStacks, groupLinks, stackRootOf } from '../../_shared/utils/stack-paths';
import { ProfileWorkoutRow } from './_components/profile-workout-row/profile-workout-row';
import { ReportWorkoutSheet } from './_sheets/report-workout-sheet/report-workout-sheet';
import {
  PERSON_ICONS,
  PersonTab,
  PersonTabs,
  personTabs,
  roleLabel,
  workoutMonths,
} from './person.config';
import { PersonStore } from './person.store';

type WorkoutActionId = 'report';

/**
 * A person's profile, reached from anywhere a person is named: who they
 * are, and the workouts they let this viewer see. Mounted in every stack
 * that names people, so the tab you came from stays lit and back returns
 * where you were.
 *
 * The server decides what a given viewer may see and nulls the rest, so
 * this renders whatever came back rather than deciding for itself. A coach
 * viewing their own client gets contact details; the same screen for a
 * stranger shows the name and what is public. Your own page is a preview:
 * as anyone sees it, or as your coaches do.
 */
@Component({
  selector: 'mh-person',
  imports: [
    ActionSheet,
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonBadge,
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
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    ProfileWorkoutRow,
    ReportWorkoutSheet,
    TranslatePipe,
  ],
  templateUrl: './person.html',
  styleUrl: './person.scss',
  providers: [PersonStore],
})
export class Person {
  readonly Tiles = DETAIL_TILES;
  readonly Tabs = PersonTabs;

  readonly store = inject(PersonStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _authStore = inject(AuthStore);
  private readonly _openDirectMessage = injectOpenDirectMessage();
  private readonly _router = inject(Router);

  /**
   * Where back goes on a cold load. The screen is mounted under every stack
   * that names people, so the fallback follows whichever one the URL is in;
   * without it a deep link renders a header with no way out.
   */
  readonly backHref = computed(() => stackRootOf(this._router.url) ?? ProfileStacks.CoachSessions);

  readonly name = computed(() => {
    const profile = this.store.profile();
    if (!profile) return '';
    return (
      [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
      translate('common.someone')
    );
  });

  /** Null when the name is hidden; the copy then says "They" instead. */
  readonly firstName = computed(() => this.store.profile()?.firstName?.trim() || null);

  readonly tone = computed(() => avatarToneFor(this.store.profile()?.userId));

  /** Your own page: a preview with Edit profile, nothing to message or report. */
  readonly isSelf = computed(
    () => !!this.store.profile() && this.store.profile()?.userId === this._authStore.user()?.id,
  );

  /** USER is filtered out server-side, so anything left is worth showing. */
  readonly roles = computed(() => (this.store.profile()?.displayRoles ?? []).map(roleLabel));

  /** "@ana · Cluj-Napoca, Romania": who to look for, and where they are. */
  readonly handleLine = computed(() => {
    const profile = this.store.profile();
    if (!profile) return '';
    // "RO" on its own tells you nothing; the country name does.
    const country = countryNameFromCode(profile.countryCode);
    const place = [profile.city, country].filter(Boolean).join(', ');
    return [`@${profile.handle}`, place].filter(Boolean).join(' · ');
  });

  readonly memberSince = computed(() => {
    const iso = this.store.profile()?.memberSince;
    if (!iso) return null;
    return new Date(iso).toLocaleDateString(appLocale(), { month: 'long', year: 'numeric' });
  });

  /** Only for their trainees: since when this person has coached you. */
  readonly coachSince = computed(() => {
    const iso = this.store.profile()?.yourCoachSince;
    if (!iso) return null;
    return new Date(iso).toLocaleDateString(appLocale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  });

  /** Their language, named in the reader's: shown only when their settings allow it. */
  readonly language = computed(() => languageName(this.store.profile()?.language) || null);

  /**
   * Their time zone as the place and the time it is there now ("Bucharest ·
   * 14:32"): what a coach wants before messaging someone. Read when the page
   * renders; it does not tick.
   */
  readonly localTime = computed(() => {
    const timezone = this.store.profile()?.timezone;
    if (!timezone) return null;
    const place = timezonePlace(timezone);
    try {
      const now = new Intl.DateTimeFormat(appLocale(), {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      }).format(new Date());
      return `${place} · ${now}`;
    } catch {
      // An unknown zone name: the place alone still says where they are.
      return place;
    }
  });

  /** Everything here depends on their privacy settings; the server nulls the rest. */
  readonly hasDetails = computed(() => {
    const profile = this.store.profile();
    return (
      !!profile && (!!profile.email || !!profile.phone || !!this.language() || !!this.localTime())
    );
  });

  /** Groups you are both in: the one thing here that is about the two of you. */
  readonly sharedGroups = computed(() => this.store.profile()?.sharedGroups ?? []);

  /** A group you share, opened in this stack so back returns to the profile. */
  openGroup(group: PublicSharedGroup): void {
    void this._router.navigate(groupLinks(this._router.url).group(group.id));
  }

  readonly bio = computed(() => this.store.coachProfile()?.bio?.trim() || null);

  readonly specializations = computed(() => this.store.coachProfile()?.specializations ?? []);

  readonly experience = computed(() => {
    const years = this.store.coachProfile()?.yearsOfExperience;
    if (!years) return null;
    return translate('person.experience', { count: years });
  });

  readonly rating = computed(() => {
    const rating = this.store.coachProfile()?.rating;
    if (!rating || rating.total === 0) return null;
    const average = new Intl.NumberFormat(appLocale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(rating.average);
    return translate('person.rating', { average, count: rating.total });
  });

  /**
   * Which tabs there are and which opens first. Your own page always has
   * Activity, if only to say which of your workouts show there.
   */
  readonly layout = computed(() => {
    const profile = this.store.profile();
    return personTabs({
      activity: this.isSelf() || (profile?.workoutCount ?? 0) > 0,
      about: !!this.bio() || this.specializations().length > 0 || this.hasDetails(),
      isCoach: !!profile?.isInstructor,
    });
  });

  /** The tab picked, until the person behind the page changes. */
  private readonly _picked = signal<PersonTab | null>(null);
  private readonly _personId = computed(() => this.store.profile()?.userId ?? null);
  readonly tab = computed(() => {
    const { tabs, initial } = this.layout();
    const picked = this._picked();
    return picked && tabs.includes(picked) ? picked : initial;
  });

  readonly months = computed(() => workoutMonths(this.store.workouts()));

  /** The workout whose menu or report sheet is open. */
  readonly workoutTarget = signal<ProfileWorkout | null>(null);
  readonly workoutMenuOpen = signal(false);
  readonly reportOpen = signal(false);

  readonly workoutActions: readonly SheetAction<WorkoutActionId>[] = [
    {
      id: 'report',
      label: translate('person.workouts.report.action'),
      icon: 'flag-outline',
      destructive: true,
    },
  ];

  constructor() {
    addIcons(PERSON_ICONS);

    // Via the param stream rather than a snapshot: Ionic reuses this page, so
    // opening a second profile has to re-init rather than keep showing the
    // first. The store ignores a repeat of the handle it already holds.
    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const handle = params.get('handle');
      if (handle) this.store.init(handle);
    });

    // A new person opens on their own first tab, not the last one's. Keyed
    // on who, so switching the preview keeps the tab you were on.
    effect(() => {
      this._personId();
      this._picked.set(null);
    });
  }

  setTab(value: unknown): void {
    if (value === PersonTabs.Activity || value === PersonTabs.About) this._picked.set(value);
  }

  setPreviewAs(value: unknown): void {
    if (value === 'PUBLIC' || value === 'COACH') this.store.setPreviewAs(value as ProfilePreviewAs);
  }

  /**
   * The workout's own page, next to this one in the same stack. Your own
   * preview as your coaches carries on there, or a Coaches only workout
   * would not be found.
   */
  openWorkout(workout: ProfileWorkout): void {
    const asCoaches = this.isSelf() && this.store.previewAs() === 'COACH';
    void this._router.navigate(['workout', workout.id], {
      relativeTo: this._route,
      queryParams: asCoaches ? { as: 'COACH' } : {},
    });
  }

  openWorkoutMenu(workout: ProfileWorkout): void {
    this.workoutTarget.set(workout);
    this.workoutMenuOpen.set(true);
  }

  onWorkoutAction(id: WorkoutActionId): void {
    if (id === 'report') this.reportOpen.set(true);
  }

  /**
   * A coach's shareable page on the web, the one their link and QR code
   * open, in the browser for the offerings and reviews this screen leaves
   * out.
   */
  openPublicPage(): void {
    const handle = this.store.profile()?.handle;
    if (handle) window.open(publicProfileUrl(handle), '_blank', 'noopener');
  }

  editProfile(): void {
    void this._router.navigate(['/tabs/more/account/profile']);
  }

  message(): void {
    const profile = this.store.profile();
    if (!profile) return;
    this._openDirectMessage({
      id: profile.userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
    });
  }
}
