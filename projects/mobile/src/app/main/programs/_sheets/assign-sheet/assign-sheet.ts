import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import {
  IonBadge,
  IonButton,
  IonChip,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSearchbar,
  IonTextarea,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  ClientService,
  InstructorClient,
  InstructorClientStatuses,
  Program,
  ProgramService,
  ProgramSource,
  ProgramStatus,
  ProgramWorkout,
  appLocale,
  displayName,
  weekdayNames,
} from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import {
  ProgramOrigin,
  ProgramOrigins,
  programMeta,
  scheduledDateFor,
  scheduledDateFromMonday,
  todayIso,
  weekLabel,
  weekdayScheduleStart,
} from '../../programs.config';

/** One line of the schedule preview. */
export interface PreviewRow {
  name: string;
  date: string;
  week: string;
}

export interface AssignRequest {
  /** Only when the sheet chose the program (opened from a client). */
  programId?: string;
  clientId: string;
  startDate: string;
  /** ISO 1=Mon..7=Sun. Absent leaves days counting from the start date. */
  daysOfWeek?: number[];
  notes?: string;
}

/** How many days of the plan the preview shows before folding the rest away. */
const PREVIEW_ROWS = 6;

/** Enough of a library to pick from; the search narrows it. */
const PROGRAM_LIMIT = 100;

/** Below this a list reads at a glance and a search field is only clutter. */
const SEARCH_FROM = 8;

/**
 * Assign a program to a client.
 *
 * Opened from either end: from a program it picks the client, from a client
 * it picks the program — the rest of the sheet is the same either way.
 *
 * The payload is only client, start date and an optional note — nothing
 * invented. The screen's real work is the preview: given a start date, which
 * day lands on which real date. A plan whose "Day 1" falls on a Saturday is
 * a mistake worth catching here rather than in a message three days later.
 */
/** ISO 1=Mon..7=Sun, which is what the API takes; labels in the UI locale. */
const WEEKDAYS: readonly { iso: number; label: string }[] = weekdayNames('short').map((label, i) => ({
  iso: i + 1,
  label,
}));

@Component({
  selector: 'mh-assign-sheet',
  imports: [
    IonBadge,
    IonButton,
    IonChip,
    HexAvatar,
    IonDatetime,
    IonDatetimeButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonSearchbar,
    IonTextarea,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './assign-sheet.html',
  styleUrl: './assign-sheet.scss',
})
export class AssignSheet {
  readonly open = model(false);
  /** Opened from a program: it is fixed and the sheet picks the client. */
  readonly program = input<Program | null>(null);
  /** Opened from a client: they are fixed and the sheet picks the program. */
  readonly client = input<InstructorClient | null>(null);

  readonly assign = output<AssignRequest>();

  private readonly _clientService = inject(ClientService);
  private readonly _programService = inject(ProgramService);
  private readonly _translateService = inject(TranslateService);

  /** True when opened from a client, so the program is the open question. */
  readonly picksProgram = computed(() => !!this.client() && !this.program());

  readonly programs = signal<Program[]>([]);
  readonly programsLoading = signal(false);
  readonly programQuery = signal('');
  /**
   * Your own programs first, as the library opens: a coach assigns their own
   * work far more often than a starter, and ten starters ahead of it made the
   * right one hard to find. MotionHive is the other pill.
   */
  readonly programOrigin = signal<ProgramOrigin>(ProgramOrigins.Mine);
  /** The chosen program with its days, fetched on pick for the preview. */
  readonly chosenProgram = signal<Program | null>(null);
  readonly chosenLoading = signal(false);

  /** Whichever end is fixed or chosen — what every computed below reads. */
  private readonly _program = computed(() => this.program() ?? this.chosenProgram());

  readonly showProgramSearch = computed(() => this.programs().length >= SEARCH_FROM);

  /** Only worth a choice when the library holds both kinds. */
  readonly showProgramOrigins = computed(() => {
    const rows = this.programs();
    return rows.some((row) => this.isStarter(row)) && rows.some((row) => !this.isStarter(row));
  });

  readonly programOriginCounts = computed(() => {
    const rows = this.programs();
    const starters = rows.filter((row) => this.isStarter(row)).length;
    return { mine: rows.length - starters, starters };
  });

  originCount(origin: ProgramOrigin): number {
    const counts = this.programOriginCounts();
    return origin === ProgramOrigins.Starters ? counts.starters : counts.mine;
  }

  readonly programOriginPills: readonly { value: ProgramOrigin; label: string }[] = [
    { value: ProgramOrigins.Mine, label: 'programs.library.origin.mine' },
    { value: ProgramOrigins.Starters, label: 'programs.library.origin.starters' },
  ];

  readonly visiblePrograms = computed(() => {
    const query = this.programQuery().trim().toLocaleLowerCase(appLocale());
    const origin = this.showProgramOrigins() ? this.programOrigin() : ProgramOrigins.All;
    const rows = this.programs().filter((row) =>
      origin === ProgramOrigins.Mine
        ? !this.isStarter(row)
        : origin === ProgramOrigins.Starters
          ? this.isStarter(row)
          : true,
    );
    if (!query) return rows;
    return rows.filter((row) => row.name.toLocaleLowerCase(appLocale()).includes(query));
  });

  readonly clients = signal<InstructorClient[]>([]);
  readonly loading = signal(false);
  readonly clientId = signal<string | null>(null);
  readonly startDate = signal(todayIso());
  readonly notes = signal('');

  readonly canAssign = computed(
    () =>
      !!this._targetClientId() &&
      !!this._program() &&
      !this.chosenLoading() &&
      !!this.startDate() &&
      this.daysValid(),
  );

  /** The fixed client when opened from one, else the one picked in the list. */
  private readonly _targetClientId = computed(() => this.client()?.clientId ?? this.clientId());

  /**
   * The weekdays the program's training days land on, ISO 1=Mon..7=Sun.
   * Empty leaves them counting forward from the start date.
   */
  readonly chosenDays = signal<number[]>([]);

  readonly weekdayOptions = WEEKDAYS;

  /** The program's own day slots, 0=Mon..6=Sun, in order. */
  readonly programDays = computed(() => {
    const workouts = this._program()?.workouts ?? [];
    return [...new Set(workouts.map((w) => w.dayIndex))].sort((a, b) => a - b);
  });

  readonly canChooseDays = computed(() => this.programDays().length > 0);

  readonly daysRemaining = computed(
    () => this.programDays().length - this.chosenDays().length,
  );

  /** Nothing chosen is valid; a partial choice is not — the API refuses it. */
  readonly daysValid = computed(
    () => this.chosenDays().length === 0 || this.daysRemaining() === 0,
  );

  readonly dayHint = computed(() => {
    if (this.chosenDays().length === 0) {
      return this._translateService.instant('programs.assign.dayHint.unchosen', {
        count: this.programDays().length,
      });
    }
    if (this.daysRemaining() > 0) {
      return this._translateService.instant('programs.assign.dayHint.remaining', {
        count: this.daysRemaining(),
      });
    }
    return this._translateService.instant('programs.assign.dayHint.done');
  });

  /** Program day slot -> chosen weekday, once the picks are complete. */
  private readonly _dayMap = computed<Map<number, number> | null>(() => {
    if (!this.daysValid() || !this.chosenDays().length) return null;
    const days = this.programDays();
    const chosen = [...this.chosenDays()].sort((a, b) => a - b);
    return new Map(days.map((d, i) => [d, chosen[i] - 1]));
  });

  toggleDay(iso: number): void {
    this.chosenDays.update((days) =>
      days.includes(iso)
        ? days.filter((d) => d !== iso)
        : [...days, iso].sort((a, b) => a - b),
    );
  }

  isDayOn(iso: number): boolean {
    return this.chosenDays().includes(iso);
  }

  /**
   * Every day of the plan against a real date, in the order they happen.
   *
   * Sorted by date rather than by position: remapping days onto other
   * weekdays can reorder them within a week, and a preview that still read
   * top-to-bottom by slot would disagree with the calendar it is predicting.
   */
  readonly preview = computed<PreviewRow[]>(() => {
    const program = this._program();
    const start = this.startDate();
    if (!program || !start) return [];

    const workouts = program.workouts ?? [];
    const dayMap = this._dayMap();
    // Mirrors the server: picked weekdays never put a session before the
    // start date — when one would, the whole plan counts from a week later.
    const from = dayMap
      ? weekdayScheduleStart(
          start,
          workouts
            .filter((workout) => workout.weekIndex === 0)
            .map((workout) => dayMap.get(workout.dayIndex) ?? workout.dayIndex),
        )
      : start;

    return [...workouts]
      .map((workout: ProgramWorkout) => {
        // Mirrors the server: with a mapping, week 0 is anchored on the
        // Monday of the week it counts from and the slot names a weekday.
        const dayIndex = dayMap?.get(workout.dayIndex) ?? workout.dayIndex;
        const date = dayMap
          ? scheduledDateFromMonday(from, workout.weekIndex, dayIndex)
          : scheduledDateFor(start, workout.weekIndex, workout.dayIndex);
        return { workout, date };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      // The date shown is the one sorted on. It used to be recomputed by
      // counting forward, so picking weekdays never moved a single date.
      .map(({ workout, date }) => ({
        name: workout.name,
        week: weekLabel(workout.weekIndex),
        date: date.toLocaleDateString(appLocale(), {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
      }));
  });

  readonly previewHead = computed(() => this.preview().slice(0, PREVIEW_ROWS));

  readonly previewMore = computed(() => Math.max(0, this.preview().length - PREVIEW_ROWS));

  constructor() {
    // Load the roster when the sheet opens rather than on construction: the
    // sheet is in the page's template from the start and most visits to the
    // screen never open it.
    effect(() => {
      if (!this.open()) return;
      if (this.picksProgram()) this._loadPrograms();
      else this._loadClients();
    });
  }

  /**
   * Yours first, then MotionHive's starters, as the library lists them.
   * Archived plans are retired on purpose and stay out of the choice.
   */
  private _loadPrograms(): void {
    if (this.programs().length || this.programsLoading()) return;
    this.programsLoading.set(true);
    this._programService
      .list({ limit: PROGRAM_LIMIT })
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((page) => {
        this.programsLoading.set(false);
        this.programs.set(
          (page?.items ?? []).filter((row) => row.status !== ProgramStatus.Archived),
        );
      });
  }

  /** The list rows carry no days, and the preview needs them: fetch the one picked. */
  chooseProgram(row: Program): void {
    this.chosenProgram.set(row);
    this.chosenDays.set([]);
    this.chosenLoading.set(true);
    this._programService
      .get(row.id)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((full) => {
        this.chosenLoading.set(false);
        // A newer pick may have landed while this was in flight.
        if (full && this.chosenProgram()?.id === row.id) this.chosenProgram.set(full);
      });
  }

  /** Back to the list, for a coach who picked the wrong one. */
  changeProgram(): void {
    this.chosenProgram.set(null);
    this.chosenDays.set([]);
  }

  programMeta(row: Program): string {
    return programMeta(row);
  }

  isStarter(row: Program): boolean {
    return row.source === ProgramSource.System;
  }

  isDraft(row: Program): boolean {
    return row.status === ProgramStatus.Draft;
  }

  private _loadClients(): void {
    if (this.clients().length || this.loading()) return;
    this.loading.set(true);
    this._clientService
      .getClients()
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((page) => {
        this.loading.set(false);
        const rows = Array.isArray(page) ? page : (page?.items ?? []);
        // Only an active relationship can be given work.
        this.clients.set(
          rows.filter((row: InstructorClient) => row.status === InstructorClientStatuses.Active),
        );
      });
  }

  name(row: InstructorClient): string {
    return displayName(
      row.client ?? null,
      this._translateService.instant('programs.common.clientFallback'),
    );
  }

  tone(row: InstructorClient): string {
    return avatarToneFor(row.clientId);
  }

  /** The picker hands back an ISO instant; a start date is the calendar day of it. */
  onStartChange(value: string | string[] | null | undefined): void {
    const iso = Array.isArray(value) ? value[0] : value;
    if (iso) this.startDate.set(iso.slice(0, 10));
  }

  submit(): void {
    const clientId = this._targetClientId();
    const chosen = this.picksProgram() ? this.chosenProgram() : null;
    if (!clientId || (this.picksProgram() && !chosen)) return;
    this.assign.emit({
      // Present only when this sheet chose it, so a program page's own id is
      // never shadowed by an empty one.
      ...(chosen ? { programId: chosen.id } : {}),
      clientId,
      startDate: this.startDate(),
      daysOfWeek: this.chosenDays().length ? this.chosenDays() : undefined,
      notes: this.notes().trim() || undefined,
    });
    this.reset();
    this.open.set(false);
  }

  reset(): void {
    this.chosenDays.set([]);
    this.clientId.set(null);
    this.chosenProgram.set(null);
    this.programQuery.set('');
    this.programOrigin.set(ProgramOrigins.Mine);
    this.startDate.set(todayIso());
    this.notes.set('');
  }
}
