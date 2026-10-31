import { Component, computed, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { AppModeStore, appLocale, AuthStore, dayDividerLabel, NavMode, NavModes } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { RowSkeleton } from '../../../_shared/components/row-skeleton/row-skeleton';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { workoutDuration } from '../../workouts/workouts.config';
import { LatestRowItem } from '../_components/latest-row/latest-row';
import { dayGroups, LatestRow, latestRow } from '../home.config';
import { HOME_ICONS } from '../home.icons';
import { LatestStore } from './latest.store';

/** One day of the page: its label ("Today", "Yesterday", "Monday 26 October") and rows. */
interface LatestDay {
  key: string;
  label: string;
  rows: LatestRow[];
}

/**
 * Latest in full, from Home's "See all": the last two weeks by day, newest
 * first. A coach sees their clients' finished workouts (each opens the
 * workout); a trainee their groups' posts and their own records (a post
 * opens the post, a record its exercise's progress). All in Home's stack,
 * so back returns here, and from here to Home.
 */
@Component({
  selector: 'mh-latest',
  imports: [
    EmptyState,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    LatestRowItem,
    RowSkeleton,
    TranslatePipe,
  ],
  templateUrl: './latest.html',
  styleUrl: './latest.scss',
  providers: [LatestStore],
})
export class Latest implements OnInit, ViewWillEnter {
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);
  private readonly _authStore = inject(AuthStore);
  private readonly _appModeStore = inject(AppModeStore);

  readonly store = inject(LatestStore);

  readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  /** The side the reader is on, as Home decides it. */
  readonly mode = computed<NavMode>(() =>
    this._authStore.isInstructor() ? this._appModeStore.mode() : NavModes.Train,
  );

  readonly isCoach = computed(() => this.mode() === NavModes.Coach);

  /** The first entry is the first load (`ngOnInit`). */
  private _entered = false;

  readonly days = computed<LatestDay[]>(() => {
    const locale = appLocale();
    const copy = {
      t: (key: string, params?: Record<string, unknown>) =>
        this._translateService.instant(key, params),
      locale,
      // The day is in the label above, so a row says the time of day.
      time: (iso: string) =>
        new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      duration: workoutDuration,
      tone: avatarToneFor,
    };
    return dayGroups(this.store.entries()).map((day) => ({
      key: day.key,
      label: dayDividerLabel(day.key),
      rows: day.items.map((entry) => latestRow(entry, copy)),
    }));
  });

  constructor() {
    addIcons(HOME_ICONS);
  }

  ngOnInit(): void {
    this.store.load(this.mode());
  }

  /** Back from a workout or a post: something new may have landed. */
  ionViewWillEnter(): void {
    if (this._entered) this.store.load(this.mode());
    this._entered = true;
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.load(this.mode(), () => void event.target.complete());
  }

  retry(): void {
    this.store.load(this.mode());
  }

  open(row: LatestRow): void {
    void this._router.navigate(row.link, row.state ? { state: row.state } : {});
  }
}
