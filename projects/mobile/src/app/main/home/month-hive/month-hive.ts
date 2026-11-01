import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { appLocale, dayFromKey, sentenceCase, weekdayNames } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../_shared/components/sheet-shell/sheet-shell';
import { workoutDuration } from '../../workouts/workouts.config';
import { HiveBoard } from '../_components/hive-board/hive-board';
import { HiveLegend, LegendItem, LegendSwatches } from '../_components/hive-board/hive-legend';
import { workoutLinks } from '../home-stack.config';
import {
  canGoNext,
  dayRow,
  ghostMonthCells,
  MonthDay,
  MONTH_HIVE_ICONS,
  monthCells,
  monthName,
  monthSummary,
  monthTitle,
  summaryParts,
} from './month-hive.config';
import { MonthHiveStore } from './month-hive.store';

/**
 * The trainee's month, from the Home week card: one honeycomb row per week,
 * Monday first, one cell per day, honey where they trained (or the
 * workout's photo), a dot for a record, today ringed. The arrows are the
 * date filter; next stops at this month. A trained day opens its workout in
 * Home's stack, so back returns here on the same month (the page stays
 * alive under it); a day with two or more lists them first.
 */
@Component({
  selector: 'mh-month-hive',
  imports: [
    EmptyState,
    HexAvatar,
    HiveBoard,
    HiveLegend,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './month-hive.html',
  styleUrl: './month-hive.scss',
  host: { class: 'mh-whole-words' },
  providers: [MonthHiveStore],
})
export class MonthHive implements OnInit, ViewWillEnter {
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);
  private readonly _sheet = viewChild(SheetShell);

  readonly store = inject(MonthHiveStore);

  readonly letters = weekdayNames('narrow');

  /** The day whose workouts the sheet lists (kept while it closes). */
  readonly openDay = signal<MonthDay | null>(null);
  readonly sheetOpen = signal(false);

  /** The first entry is the first load (`ngOnInit`). */
  private _entered = false;

  private readonly _t = (key: string, params?: Record<string, unknown>) =>
    this._translateService.instant(key, params);

  readonly legend: LegendItem[] = [
    { swatch: LegendSwatches.Honey, label: this._t('monthHive.legend.trained') },
    { swatch: LegendSwatches.Dot, label: this._t('monthHive.legend.record') },
    { swatch: LegendSwatches.Dashed, label: this._t('monthHive.legend.skipped') },
    { swatch: LegendSwatches.Today, label: this._t('monthHive.legend.today') },
  ];

  readonly title = computed(() => monthTitle(this.store.month(), appLocale()));
  /** The month inside a sentence: lower case where the language writes it so. */
  private readonly _monthName = computed(() => monthName(this.store.month(), appLocale()));
  readonly hasNext = computed(() => canGoNext(this.store.month(), this.store.today()));

  readonly cells = computed(() => {
    const days = this.store.days();
    if (this.store.loading() || this.store.showError()) return ghostMonthCells(days);
    return monthCells(days, {
      t: this._t,
      dateLabel: (key) => this._dateLabel(key),
      photoUrl: (log) => this.store.photoUrl(log),
    });
  });

  readonly summary = computed(() => monthSummary(this.store.days()));

  readonly headline = computed(() =>
    this._t('monthHive.summary.workouts', { count: this.summary().workouts }),
  );

  readonly line = computed(() =>
    summaryParts(this.summary(), this._t, workoutDuration).join(' · '),
  );

  /** Nothing finished: a calm line under the board, never an error. */
  readonly emptyLine = computed(() =>
    this.hasNext()
      ? this._t('monthHive.empty.past', { month: this._monthName() })
      : this._t('monthHive.empty.current'),
  );

  readonly boardLabel = computed(() =>
    this.store.loading()
      ? this._t('a11y.loading')
      : this._t('monthHive.board', { month: this._monthName() }),
  );

  readonly sheetTitle = computed(() => {
    const day = this.openDay();
    return day ? this._dateLabel(day.key) : '';
  });

  readonly sheetRows = computed(() => {
    const day = this.openDay();
    const time = (iso: string) =>
      new Date(iso).toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' });
    return day ? day.workouts.map((log) => dayRow(log, this._t, time, workoutDuration)) : [];
  });

  constructor() {
    addIcons(MONTH_HIVE_ICONS);
  }

  ngOnInit(): void {
    this.store.load();
  }

  /** Back from a workout: a photo may have been added, or a workout discarded. */
  ionViewWillEnter(): void {
    if (this._entered) this.store.load();
    this._entered = true;
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.load(() => void event.target.complete());
  }

  retry(): void {
    this.store.load();
  }

  step(delta: number): void {
    if (delta > 0 && !this.hasNext()) return;
    this.store.step(delta);
  }

  /** One workout opens; two or more are listed first. */
  pick(key: string): void {
    const day = this.store.days().find((one) => one.key === key);
    if (!day?.workouts.length) return;
    if (day.workouts.length === 1) {
      this._openWorkout(day.workouts[0]!.id);
      return;
    }
    this.openDay.set(day);
    this.sheetOpen.set(true);
  }

  async openFromSheet(id: string): Promise<void> {
    await this._sheet()?.close();
    this._openWorkout(id);
  }

  /** The finished workout in Home's stack (`workoutLinks`), so back returns here. */
  private _openWorkout(id: string): void {
    void this._router.navigate(workoutLinks(this._router.url).finish(id));
  }

  /** "Tuesday 7 October", "Marți, 7 octombrie". */
  private _dateLabel(key: string): string {
    const locale = appLocale();
    return sentenceCase(
      dayFromKey(key).toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      locale,
    );
  }
}
