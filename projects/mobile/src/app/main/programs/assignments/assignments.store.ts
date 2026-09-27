import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  AssignProgramPayload,
  Program,
  ProgramAssignment,
  ProgramAssignmentService,
  ProgramAssignmentStatus,
  ProgramService,
} from 'core';

/** The instructor endpoint spans every program; one page covers a coach's roster. */
const PAGE_SIZE = 100;

/**
 * Who is on one program, in all five states, and the program itself — the
 * assign sheet previews the schedule, which needs the day grid.
 *
 * Status changes patch the row in place: the update payload carries no
 * eager-loaded client, so keeping the one already on screen is what stops
 * pausing someone from renaming them "Client".
 */
@Injectable()
export class AssignmentsStore {
  private readonly _programAssignmentService = inject(ProgramAssignmentService);
  private readonly _programService = inject(ProgramService);

  private readonly _program = signal<Program | null>(null);
  private readonly _rows = signal<ProgramAssignment[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal(false);
  /** The row whose status change is in flight, so its button waits. */
  private readonly _busyId = signal<string | null>(null);
  private _programId: string | null = null;
  private _seq = 0;

  readonly program = this._program.asReadonly();
  readonly rows = this._rows.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly showSkeleton = computed(() => this._loading() && !this._loaded());
  readonly showError = computed(() => this._error() && this._rows().length === 0);
  readonly isEmpty = computed(
    () => this._loaded() && !this._loading() && !this._error() && this._rows().length === 0,
  );

  /** "12-week strength block · 5 clients" — the line under the title. */
  readonly subtitle = computed(() => {
    const name = this._program()?.name;
    const n = this._rows().length;
    const clients = `${n} ${n === 1 ? 'client' : 'clients'}`;
    return name ? `${name} · ${clients}` : clients;
  });

  isBusy(id: string): boolean {
    return this._busyId() === id;
  }

  load(programId: string, done?: () => void): void {
    const seq = ++this._seq;
    this._programId = programId;
    this._loading.set(true);
    this._error.set(false);

    forkJoin({
      page: this._programAssignmentService.listForInstructor({ limit: PAGE_SIZE }),
      program: this._programService.get(programId).pipe(catchError(() => of(null))),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ page, program }) => {
          if (seq !== this._seq) {
            done?.();
            return;
          }
          // The endpoint spans every program this coach runs; this screen is
          // about one of them.
          this._rows.set(page.items.filter((row) => row.masterProgramId === programId));
          if (program) this._program.set(program);
          this._loaded.set(true);
          this._loading.set(false);
          done?.();
        },
        error: () => {
          if (seq !== this._seq) {
            done?.();
            return;
          }
          this._error.set(true);
          this._loaded.set(true);
          this._loading.set(false);
          done?.();
        },
      });
  }

  refresh(done?: () => void): void {
    if (this._programId) this.load(this._programId, done);
    else done?.();
  }

  /**
   * Re-read rather than prepend the response: the create payload carries no
   * eager-loaded client, so an optimistic row would sit there calling them
   * "Client" until the next visit.
   */
  assign(payload: Omit<AssignProgramPayload, 'programId'>, done: (error?: unknown) => void): void {
    const programId = this._programId;
    if (!programId) return;
    this._programAssignmentService
      .assign({ programId, ...payload })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.refresh();
          done();
        },
        error: (error: unknown) => done(error),
      });
  }

  setStatus(
    row: ProgramAssignment,
    status: ProgramAssignmentStatus,
    done: (error?: unknown) => void,
  ): void {
    if (this._busyId()) return;
    this._busyId.set(row.id);
    this._programAssignmentService
      .update(row.id, { status })
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this._busyId.set(null);
          this._rows.update((rows) =>
            rows.map((r) => (r.id === row.id ? { ...updated, client: r.client } : r)),
          );
          done();
        },
        error: (error: unknown) => {
          this._busyId.set(null);
          done(error);
        },
      });
  }
}
