import { Component, computed, inject, OnInit } from '@angular/core';
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

import { appLocale, localDayKey } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { RowSkeleton } from '../../../_shared/components/row-skeleton/row-skeleton';
import { NeedRowItem } from '../_components/need-row/need-row';
import { CoachHomeStore } from '../coach-home/coach-home.store';
import { NeedReason, needGroups, needRow, NeedRow } from '../home.config';
import { HOME_ICONS } from '../home.icons';
import { injectActOnNeed } from './need-actions';

/** One heading of the page and its rows, in the reader's words. */
interface NeedSection {
  reason: NeedReason;
  label: string;
  count: number;
  rows: NeedRow[];
}

/**
 * Everyone who needs the coach, from Home's "Show more": a heading per
 * reason (requests, not started, quiet, falling behind, no plan, plans
 * ending) with how many, and each row's one verb, the same rows as Home's.
 * In Home's stack, so back returns to Home and a chat opened from here
 * returns here.
 */
@Component({
  selector: 'mh-needs-you',
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
    NeedRowItem,
    RowSkeleton,
    TranslatePipe,
  ],
  templateUrl: './needs-you.html',
  styleUrl: './needs-you.scss',
  providers: [CoachHomeStore],
})
export class NeedsYou implements OnInit, ViewWillEnter {
  private readonly _translateService = inject(TranslateService);

  readonly store = inject(CoachHomeStore);
  readonly act = injectActOnNeed();

  readonly skeletonRows = [0, 1, 2, 3, 4];

  /** The first entry is the first load (`ngOnInit`). */
  private _entered = false;

  /** Shimmer only before the first answer; a refresh keeps the rows. */
  readonly loading = computed(() => this.store.rosterLoading() && !this.store.roster());

  readonly sections = computed<NeedSection[]>(() => {
    const t = (key: string, params?: Record<string, unknown>) =>
      this._translateService.instant(key, params);
    const copy = { t, locale: appLocale(), todayKey: localDayKey(new Date()) };
    return needGroups(this.store.needs()).map((group) => ({
      reason: group.reason,
      label: t(`home.coach.needs.groups.${group.reason}`),
      count: group.count,
      rows: group.items.map((item) => needRow(item, copy)),
    }));
  });

  constructor() {
    addIcons(HOME_ICONS);
  }

  ngOnInit(): void {
    this.store.loadNeeds();
  }

  /** Back from a chat or a client page: someone may be dealt with. */
  ionViewWillEnter(): void {
    if (this._entered) this.store.loadNeeds();
    this._entered = true;
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.loadNeeds(() => void event.target.complete());
  }

  retry(): void {
    this.store.loadNeeds();
  }
}
