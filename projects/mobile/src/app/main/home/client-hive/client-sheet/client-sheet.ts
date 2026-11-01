import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import { catchError, forkJoin, map, Observable, of, Subscription, take } from 'rxjs';

import {
  appLocale,
  formatRelativeShort,
  localDayKey,
  ProgramAssignment,
  ProgramAssignmentService,
  RosterClient,
  RosterWindow,
  weekdayNames,
  WorkoutLog,
  WorkoutLogService,
} from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { injectOpenDirectMessage } from '../../../../_shared/utils/direct-message';
import { clientPath, CoachStacks } from '../../../clients/client-paths';
import { ClientTabs } from '../../../clients/clients.config';
import { workoutDuration } from '../../../workouts/workouts.config';
import { HiveBoard } from '../../_components/hive-board/hive-board';
import { HiveLegend, LegendItem, LegendSwatches } from '../../_components/hive-board/hive-legend';
import { HOME_STACK } from '../../home-stack.config';
import {
  ClientAction,
  ClientActions,
  ClientWeekDay,
  clientActions,
  clientStatus,
  clientWeek,
  lastWorkoutRow,
  planEndsText,
  plannedInWeek,
  statusText,
  weekStripCells,
  weekSummaryText,
  weekWindow,
} from '../client-hive.config';

/** The client's week and latest workout, as the sheet shows them. */
interface SheetData {
  week: ClientWeekDay[];
  last: WorkoutLog | null;
}

const States = { Loading: 'loading', Ready: 'ready', Failed: 'failed' } as const;
type State = (typeof States)[keyof typeof States];

/** Workouts read for one week: a day rarely holds more than one. */
const WEEK_LIMIT = 50;

/**
 * A client from the coach's hive: who they are and how the range went,
 * their week as seven cells (trained, skipped, planned, nothing), their
 * last workout, and the quick actions: Message, the one that fits (assign
 * a plan, open a plan that ends soon) and their page.
 *
 * Everything it opens is in Home's stack, so back returns to the hive. It
 * closes before it navigates (`surfaces-and-sheets.md`).
 */
@Component({
  selector: 'mh-client-sheet',
  imports: [
    HexAvatar,
    HiveBoard,
    HiveLegend,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSkeletonText,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './client-sheet.html',
  styleUrl: './client-sheet.scss',
})
export class ClientSheet {
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _programAssignmentService = inject(ProgramAssignmentService);
  private readonly _openDirectMessage = injectOpenDirectMessage();
  private readonly _shell = viewChild(SheetShell);

  readonly open = model(false);
  readonly client = input<RosterClient | null>(null);
  readonly range = input.required<RosterWindow>();
  /** The client's active plans (list rows), for the planned days. */
  readonly plans = input<readonly ProgramAssignment[]>([]);
  /** Their plan that ends within the week, if one does. */
  readonly endingPlan = input<ProgramAssignment | null>(null);

  readonly state = signal<State>(States.Loading);
  readonly data = signal<SheetData | null>(null);
  readonly States = States;

  private _load: Subscription | null = null;

  readonly letters = weekdayNames('narrow');

  private readonly _t = (key: string, params?: Record<string, unknown>) =>
    this._translateService.instant(key, params);

  readonly legend: LegendItem[] = [
    { swatch: LegendSwatches.Honey, label: this._t('clientHive.sheet.legend.trained') },
    { swatch: LegendSwatches.Track, label: this._t('clientHive.sheet.legend.planned') },
    { swatch: LegendSwatches.Dashed, label: this._t('clientHive.sheet.legend.skipped') },
  ];

  readonly name = computed(() => this.client()?.name ?? '');
  readonly tone = computed(() => avatarToneFor(this.client()?.clientId));

  readonly status = computed(() => {
    const client = this.client();
    return client ? statusText(clientStatus(client), this.range(), this._t) : '';
  });

  readonly planEnds = computed(() => {
    const plan = this.endingPlan();
    return plan ? planEndsText(plan, localDayKey(new Date()), appLocale(), this._t) : '';
  });

  readonly actions = computed(() => {
    const client = this.client();
    return client ? clientActions(client, !!this.endingPlan(), this._t) : [];
  });

  /** The week while it loads: seven empty cells, breathing. */
  readonly stripCells = computed(() =>
    weekStripCells(this.data()?.week ?? clientWeek(new Date(), [], [])),
  );

  readonly stripLabel = computed(() => {
    const week = this.data()?.week;
    return week
      ? weekSummaryText(week, this._t)
      : this._translateService.instant('clientHive.sheet.week');
  });

  readonly last = computed(() => {
    const log = this.data()?.last;
    return log
      ? lastWorkoutRow(log, { t: this._t, time: formatRelativeShort, duration: workoutDuration })
      : null;
  });

  constructor() {
    // A new client (or the sheet opening on one) reads their week afresh.
    effect(() => {
      const client = this.client();
      const open = this.open();
      if (client && open) untracked(() => this.load(client));
    });
    inject(DestroyRef).onDestroy(() => this._load?.unsubscribe());
  }

  retry(): void {
    const client = this.client();
    if (client) this.load(client);
  }

  /**
   * This week's timeline (finished workouts and skipped plan days), the
   * latest finished workout, and each active plan's tree for the days
   * still planned. A plan that fails to load only leaves its days out.
   */
  load(client: RosterClient): void {
    this._load?.unsubscribe();
    this.data.set(null);
    this.state.set(States.Loading);
    const today = new Date();
    const window = weekWindow(today);
    const id = client.clientId;

    const week$ = this._workoutLogService
      .listForClient(id, { kind: 'all', ...window, limit: WEEK_LIMIT }, { silent: true })
      .pipe(map((page) => page.items));
    const last$ = this._workoutLogService
      .listForClient(id, { limit: 1 }, { silent: true })
      .pipe(map((page) => page.items[0] ?? null));
    const plans = this.plans().filter((plan) => plan.clientId === id);
    const trees$: Observable<ProgramAssignment[]> = plans.length
      ? forkJoin(
          plans.map((plan) =>
            this._programAssignmentService
              .get(plan.id, { silent: true })
              .pipe(catchError(() => of(null))),
          ),
        ).pipe(map((trees) => trees.filter((tree): tree is ProgramAssignment => tree !== null)))
      : of([]);

    this._load = forkJoin({ week: week$, last: last$, trees: trees$ })
      .pipe(take(1))
      .subscribe({
        next: ({ week, last, trees }) => {
          this.data.set({
            week: clientWeek(today, week, plannedInWeek(trees, window)),
            last,
          });
          this.state.set(States.Ready);
        },
        error: () => this.state.set(States.Failed),
      });
  }

  async act(action: ClientAction): Promise<void> {
    const client = this.client();
    if (!client) return;
    await this._shell()?.close();
    switch (action) {
      case ClientActions.Message:
        this._openDirectMessage({ id: client.clientId, firstName: client.name });
        return;
      case ClientActions.OpenPlan:
        void this._router.navigate(clientPath(CoachStacks.Home, client.clientId), {
          queryParams: { tab: ClientTabs.Training },
        });
        return;
      default:
        // Assign and Profile: their page, where a plan is assigned.
        void this._router.navigate(clientPath(CoachStacks.Home, client.clientId));
    }
  }

  /** The workout, read as their coach, in Home's stack. */
  async openLast(id: string): Promise<void> {
    await this._shell()?.close();
    void this._router.navigate([HOME_STACK, 'log', id]);
  }
}
