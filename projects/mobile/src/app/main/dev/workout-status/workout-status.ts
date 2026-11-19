import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { RestLiveState } from '../../../_shared/native/rest-live';
import { RestTimerBar } from '../../workouts/_components/rest-timer-bar/rest-timer-bar';
import { ResumeCard } from '../../workouts/_components/resume-card/resume-card';
import { allSetsDone } from '../../workouts/_services/active-session.store';
import { ActiveStatus, activeStatus } from '../../workouts/_services/active-status.config';
import { Translate, liveState } from '../../workouts/_services/lock-screen.config';
import { workoutClock } from '../../workouts/workouts.config';
import { ActiveBarPreview } from './_components/active-bar-preview/active-bar-preview';
import { LiveActivityMock } from './_components/live-activity-mock/live-activity-mock';
import { NotificationMock } from './_components/notification-mock/notification-mock';
import {
  AndroidLiveFace,
  LiveLayouts,
  PREVIEW_FLAG_FIELDS,
  PREVIEW_NUMBER_FIELDS,
  PREVIEW_TEXT_FIELDS,
  PreviewMock,
  PreviewNumberField,
  PreviewScenario,
  PreviewScenarios,
  PreviewTextKey,
  PreviewWorld,
  androidLiveFace,
  nudgedRest,
  parsePreviewNumber,
  previewMock,
  previewWorld,
} from './workout-status.config';

/** One scenario on the form, or every preset at once. */
export const PreviewModes = { One: 'one', Every: 'every' } as const;
export type PreviewMode = (typeof PreviewModes)[keyof typeof PreviewModes];

/** One workout on the page: what it is called, and what the store would hold. */
interface PreviewItem {
  key: string;
  label: string;
  world: PreviewWorld;
}

/** Everything the surfaces of one workout read, at this second. */
interface PreviewView extends PreviewItem {
  live: RestLiveState;
  android: AndroidLiveFace;
  /** The rest timer's times; null while no rest runs or its bar is hidden. */
  restBar: { endsAt: number; startedAt: number } | null;
  elapsed: string;
  /** What the mini-bar and the resume card show of it. */
  status: ActiveStatus;
  restAlert: string;
  stillTraining: string;
}

/** The one workout the form edits. */
const CUSTOM_KEY = 'custom';

/**
 * Every place a workout in progress shows itself, on mock data, for
 * developers (never in a production build): the real mini-bar, rest timer
 * and resume card, and pictures of the lock screen on iOS and Android
 * drawn from the state the app would send. Pick a preset, change any field,
 * or press the rest timer's own buttons; every surface follows. The clocks
 * run, so a rest drains to Go and into overtime as it would.
 */
@Component({
  selector: 'mh-workout-status',
  imports: [
    ActiveBarPreview,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToggle,
    IonToolbar,
    LiveActivityMock,
    NotificationMock,
    RestTimerBar,
    ResumeCard,
    TranslatePipe,
  ],
  templateUrl: './workout-status.html',
  styleUrl: './workout-status.scss',
})
export class WorkoutStatus {
  private readonly _translateService = inject(TranslateService);
  private readonly _translate: Translate = (key, params) =>
    this._translateService.instant(key, params);

  readonly Modes = PreviewModes;
  readonly Layouts = LiveLayouts;
  readonly scenarios = Object.values(PreviewScenarios);
  readonly textFields = PREVIEW_TEXT_FIELDS;
  readonly numberFields = PREVIEW_NUMBER_FIELDS;
  readonly flagFields = PREVIEW_FLAG_FIELDS;

  readonly mode = signal<PreviewMode>(PreviewModes.One);
  /** The preset last applied; the fields may have moved on from it. */
  readonly scenario = signal<PreviewScenario>(PreviewScenarios.Resting);
  readonly mock = signal<PreviewMock>(previewMock(PreviewScenarios.Resting, this._translate));
  readonly now = signal(Date.now());
  private readonly _items = signal<PreviewItem[]>(this._build(Date.now()));

  readonly views = computed<PreviewView[]>(() => {
    const now = this.now();
    return this._items().map((item) => {
      const { session, rest, next, steps, progress } = item.world;
      const done = allSetsDone(progress);
      const live = liveState(session, rest, next, this._translate, now, steps, done);
      return {
        ...item,
        live,
        android: androidLiveFace(live, now),
        restBar:
          rest && rest.endsAt !== null
            ? { endsAt: rest.endsAt, startedAt: rest.startedAt }
            : null,
        elapsed: workoutClock(session, now),
        status: activeStatus(session, rest, now, allSetsDone(item.world.progress)),
        restAlert: next || this._translate('workouts.restAlert.body'),
        stillTraining: this._translate('workouts.stillTraining.body', { name: session.name }),
      };
    });
  });

  /** What the phone is handed, for the one workout on the form. */
  readonly liveJson = computed(() => {
    const views = this.views();
    return views.length === 1 ? JSON.stringify(views[0].live, null, 2) : '';
  });

  constructor() {
    const handle = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(handle));
  }

  setMode(value: unknown): void {
    const mode = Object.values(PreviewModes).find((m) => m === value);
    if (!mode || mode === this.mode()) return;
    this.mode.set(mode);
    this.restart();
  }

  /** A preset: its data on the form, its clocks from now. */
  pick(scenario: PreviewScenario): void {
    this.scenario.set(scenario);
    this.mock.set(previewMock(scenario, this._translate));
    this.restart();
  }

  edit<K extends keyof PreviewMock>(key: K, value: PreviewMock[K]): void {
    this.mock.update((mock) => ({ ...mock, [key]: value }));
    this.restart();
  }

  setText(key: PreviewTextKey, raw: string | number | null | undefined): void {
    this.edit(key, String(raw ?? ''));
  }

  setNumber(field: PreviewNumberField, raw: string | number | null | undefined): void {
    const value = parsePreviewNumber(raw, field.nullable ?? false);
    if (value !== undefined) this.edit(field.key, value);
  }

  /** Every clock from now again, as the data says. */
  restart(): void {
    const now = Date.now();
    this.now.set(now);
    this._items.set(this._build(now));
  }

  // The rest timer's own buttons, answered as the logger does.

  nudgeRest(key: string, seconds: number): void {
    this._updateRest(key, (rest) => nudgedRest(rest, seconds, Date.now()));
  }

  /** Skip before zero, Start set from zero on: the rest is over. */
  endRest(key: string): void {
    this._updateRest(key, () => null);
  }

  /** Hide, in overtime: the bar goes, the rest is kept without its end. */
  hideRest(key: string): void {
    this._updateRest(key, (rest) => ({ ...rest, endsAt: null }));
  }

  private _updateRest(
    key: string,
    change: (rest: NonNullable<PreviewWorld['rest']>) => PreviewWorld['rest'],
  ): void {
    this._items.update((items) =>
      items.map((item) => {
        const rest = item.world.rest;
        if (item.key !== key || !rest) return item;
        return { ...item, world: { ...item.world, rest: change(rest) } };
      }),
    );
  }

  private _build(now: number): PreviewItem[] {
    if (this.mode() === PreviewModes.One) {
      return [
        {
          key: CUSTOM_KEY,
          label: `dev.workoutStatus.scenarios.${this.scenario()}`,
          world: previewWorld(this.mock(), now, this._translate),
        },
      ];
    }
    return this.scenarios.map((scenario) => ({
      key: scenario,
      label: `dev.workoutStatus.scenarios.${scenario}`,
      world: previewWorld(previewMock(scenario, this._translate), now, this._translate),
    }));
  }
}
