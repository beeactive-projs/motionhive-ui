import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
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
import { EMPTY, Observable, of } from 'rxjs';
import { catchError, expand, map, reduce, take } from 'rxjs/operators';

import {
  ClientDirections,
  ClientService,
  InstructorClient,
  InstructorClientStatuses,
  Program,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramService,
  ProgramSource,
  ProgramStatus,
  ProgramWorkout,
  appLocale,
  clientDisplayName,
  displayName,
  isSentInvite,
  weekdayNames,
} from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { DatetimeLocaleDirective } from '../../../../_shared/directives/datetime-locale.directive';
import { SearchbarLabelDirective } from '../../../../_shared/directives/searchbar-label.directive';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { ClientTabs, EMAIL_ONLY_TILE } from '../../../clients/clients.config';
import { clientPath, coachStackOf } from '../../../clients/client-paths';
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
import {
  PreviewDay,
  firstWeekOf,
  lastDayLabel,
  lastDayOf,
  otherPlanNote,
  runningPlansOf,
} from './assign.config';

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

/** Enough of one client's plans to find the ones running (one coach's, one client). */
const OTHER_PLANS_LIMIT = 100;

/** Enough of a library to pick from; the search narrows it. */
const PROGRAM_LIMIT = 100;

/** Below this a list reads at a glance and a search field is only clutter. */
const SEARCH_FROM = 8;

/** The API's page ceiling; the sheet reads page after page until it has them all. */
const CLIENT_PAGE_SIZE = 100;

/** A guard on the page loop, far past any real roster (1,000 clients). */
const MAX_CLIENT_PAGES = 10;

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
    DatetimeLocaleDirective,
    IonDatetimeButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonSearchbar,
    IonTextarea,
    SearchbarLabelDirective,
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

  /**
   * The caller's request in flight. The sheet stays open with a spinner on
   * Assign until the caller closes it on success; on failure it stays open
   * with everything still filled in, so trying again is one tap.
   */
  readonly saving = input(false);

  readonly assign = output<AssignRequest>();

  /** Set by Assign, until the request it sent has settled. */
  private readonly _sent = signal(false);

  private readonly _clientService = inject(ClientService);
  private readonly _programService = inject(ProgramService);
  private readonly _programAssignmentService = inject(ProgramAssignmentService);
  private readonly _translateService = inject(TranslateService);
  private readonly _router = inject(Router);
  private readonly _sheet = viewChild(SheetShell);

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
  /**
   * The people this coach invited who have not accepted yet: listed greyed,
   * never picked, since only an active client can be given work. An
   * invitation sent to an address with no account shows that address.
   */
  readonly invitees = signal<InstructorClient[]>([]);
  readonly clientQuery = signal('');
  readonly showClientSearch = computed(
    () => this.clients().length + this.invitees().length >= SEARCH_FROM,
  );
  /** The active clients, narrowed by the name typed. */
  readonly visibleClients = computed(() => {
    const query = this.clientQuery().trim().toLocaleLowerCase(appLocale());
    const rows = this.clients();
    if (!query) {
      return rows;
    }
    return rows.filter((row) => this.name(row).toLocaleLowerCase(appLocale()).includes(query));
  });
  /** The invitations still waiting, narrowed by the same search. */
  readonly visibleInvitees = computed(() => {
    const query = this.clientQuery().trim().toLocaleLowerCase(appLocale());
    const rows = this.invitees();
    if (!query) {
      return rows;
    }
    return rows.filter((row) =>
      this.inviteeName(row).toLocaleLowerCase(appLocale()).includes(query),
    );
  });
  readonly emailTile = EMAIL_ONLY_TILE;

  /**
   * The client's other plans from this coach that are running or waiting:
   * they would have both at once, which the sheet says before Assign.
   */
  readonly otherPlans = signal<ProgramAssignment[]>([]);
  private _otherPlansSeq = 0;
  readonly loading = signal(false);
  readonly clientId = signal<string | null>(null);
  readonly startDate = signal(todayIso());
  /** Today, the earliest start the picker offers. */
  readonly minStartDate = todayIso();
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

  /** The client being given the plan, for the lines that name them. */
  private readonly _targetClient = computed<InstructorClient | null>(() => {
    const fixed = this.client();
    if (fixed) {
      return fixed;
    }
    const id = this.clientId();
    if (!id) {
      return null;
    }
    const picked = this.clients().find((row) => row.clientId === id);
    if (!picked) {
      return null;
    }
    return picked;
  });

  /** "Elena": the first name, else the whole name. */
  readonly targetFirstName = computed(() => {
    const target = this._targetClient();
    if (!target) {
      return null;
    }
    const first = target.client?.firstName?.trim();
    if (first) {
      return first;
    }
    return this.name(target);
  });

  /** "Assign to Elena" once someone is picked; "Assign" before. */
  readonly saveLabel = computed(() => {
    const name = this.targetFirstName();
    if (name) {
      return this._translateService.instant('programs.assign.assignTo', { name });
    }
    return this._translateService.instant('programs.assign.assign');
  });

  /** "Elena already follows Return to running (week 3 of 6)…" */
  readonly otherPlanNote = computed(() => {
    const name = this.targetFirstName();
    if (!name) {
      return null;
    }
    return otherPlanNote(name, this.otherPlans(), new Date());
  });

  readonly seePlanLabel = computed(() =>
    this._translateService.instant('programs.assign.seePlan', {
      name: this.targetFirstName(),
    }),
  );

  readonly noteLabel = computed(
    () =>
      this._translateService.instant('programs.assign.noteForClient') +
      ' ' +
      this._translateService.instant('form.hint.optional'),
  );

  /** "2 of 3 picked", beside the weekdays once any is picked. */
  readonly daysPicked = computed(() => {
    if (!this.chosenDays().length) {
      return '';
    }
    return this._translateService.instant('programs.assign.daysPicked', {
      picked: this.chosenDays().length,
      total: this.programDays().length,
    });
  });

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
  private readonly _previewDays = computed<PreviewDay[]>(() => {
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
        return { name: workout.name, weekIndex: workout.weekIndex, date };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  });

  /**
   * The first week's days against their dates (design Assign): a plan whose
   * Day 1 lands on a Saturday is caught here, not in chat on Wednesday.
   */
  readonly firstWeek = computed<PreviewRow[]>(() =>
    firstWeekOf(this._previewDays()).map((day) => ({
      name: day.name,
      week: weekLabel(day.weekIndex),
      date: day.date.toLocaleDateString(appLocale(), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    })),
  );

  /** "Last day: Fri, 15 Jan 2027", when the plan has days. */
  readonly lastDay = computed(() => {
    const last = lastDayOf(this._previewDays());
    if (!last) {
      return null;
    }
    return this._translateService.instant('programs.assign.lastDay', {
      date: lastDayLabel(last),
    });
  });

  constructor() {
    // Load the roster when the sheet opens rather than on construction: the
    // sheet is in the page's template from the start and most visits to the
    // screen never open it.
    // The loaders read the lists they fill; untracked, so filling one (an
    // empty roster too) does not run this again and fetch it forever.
    effect(() => {
      if (!this.open()) return;
      const picksProgram = this.picksProgram();
      untracked(() => {
        if (picksProgram) {
          this._loadPrograms();
        } else {
          this._loadClients();
          this._loadInvitees();
        }
      });
    });
    // Who is being given the plan decides the other-plan warning.
    effect(() => {
      const clientId = this._targetClientId();
      if (!this.open() || !clientId) {
        untracked(() => this.otherPlans.set([]));
        return;
      }
      untracked(() => this._loadOtherPlans(clientId));
    });
    // Cleared once a sent request has settled with the sheet closed, which
    // is a success. Cancel on its own keeps the half-filled form.
    effect(() => {
      const open = this.open();
      if (this.saving() || !untracked(() => this._sent())) return;
      this._sent.set(false);
      if (!open) this.reset();
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

  /**
   * Every active client, page after page: one default page used to stop at
   * the 20 newest rows of any status, so a coach could not find an older
   * client here at all.
   */
  private _loadClients(): void {
    if (this.clients().length || this.loading()) {
      return;
    }
    this.loading.set(true);
    this._activeClientsFrom(1)
      .pipe(
        expand((result) => {
          if (result.done || result.page >= MAX_CLIENT_PAGES) {
            return EMPTY;
          }
          return this._activeClientsFrom(result.page + 1);
        }),
        reduce((all: InstructorClient[], result) => all.concat(result.rows), []),
        catchError(() => of<InstructorClient[]>([])),
      )
      .subscribe((rows) => {
        this.loading.set(false);
        // Only an active relationship can be given work; the status filter
        // already asks for that, and this keeps an old API honest.
        this.clients.set(rows.filter((row) => row.status === InstructorClientStatuses.Active));
      });
  }

  /**
   * The invitations this coach sent that wait on an answer, for the greyed
   * rows. One page: a coach with more than a hundred unanswered invitations
   * has the Clients tab for them.
   */
  private _loadInvitees(): void {
    if (this.invitees().length) {
      return;
    }
    this._clientService
      .getClients(
        {
          status: InstructorClientStatuses.Pending,
          direction: ClientDirections.Outgoing,
          limit: CLIENT_PAGE_SIZE,
        },
        { silent: true },
      )
      .pipe(
        take(1),
        catchError(() => of(null)),
      )
      .subscribe((response) => {
        if (!response) {
          return;
        }
        // The direction already asks for sent invitations; this keeps an
        // older API that ignores it from listing incoming requests here.
        let rows: InstructorClient[] = [];
        if (response.items) {
          rows = response.items;
        }
        this.invitees.set(rows.filter((row) => isSentInvite(row)));
      });
  }

  /** The client's running plans from this coach, newest answer wins. */
  private _loadOtherPlans(clientId: string): void {
    const seq = ++this._otherPlansSeq;
    this._programAssignmentService
      .listForInstructor({ clientId, limit: OTHER_PLANS_LIMIT }, { silent: true })
      .pipe(
        take(1),
        catchError(() => of(null)),
      )
      .subscribe((page) => {
        if (seq !== this._otherPlansSeq) {
          return;
        }
        if (!page) {
          this.otherPlans.set([]);
          return;
        }
        this.otherPlans.set(runningPlansOf(page.items));
      });
  }

  private _activeClientsFrom(
    page: number,
  ): Observable<{ rows: InstructorClient[]; page: number; done: boolean }> {
    return this._clientService
      .getClients(
        { status: InstructorClientStatuses.Active, page, limit: CLIENT_PAGE_SIZE },
        { silent: true },
      )
      .pipe(
        take(1),
        map((response) => {
          const rows = response.items ?? [];
          const total = response.total ?? rows.length;
          const done = rows.length === 0 || page * CLIENT_PAGE_SIZE >= total;
          return { rows, page, done };
        }),
      );
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

  /** An invitee's name: their account's, the one the coach gave, else the address. */
  inviteeName(row: InstructorClient): string {
    return clientDisplayName(
      row,
      this._translateService.instant('programs.common.clientFallback'),
    );
  }

  /** An invitation to an address with no account yet: the mail tile. */
  isEmailOnly(row: InstructorClient): boolean {
    return !row.client;
  }

  /**
   * The other plan, on the client's page in this stack (its Training tab
   * lists their plans). The sheet closes first, or it would stay on top of
   * the next page.
   */
  async seeOtherPlan(): Promise<void> {
    const clientId = this._targetClientId();
    if (!clientId) {
      return;
    }
    await this._sheet()?.close();
    void this._router.navigate(clientPath(coachStackOf(this._router.url), clientId), {
      queryParams: { tab: ClientTabs.Training },
    });
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
    this._sent.set(true);
  }

  reset(): void {
    this.chosenDays.set([]);
    this.clientId.set(null);
    this.otherPlans.set([]);
    this.chosenProgram.set(null);
    this.programQuery.set('');
    this.programOrigin.set(ProgramOrigins.Mine);
    this.startDate.set(todayIso());
    this.clientQuery.set('');
    this.notes.set('');
  }
}
