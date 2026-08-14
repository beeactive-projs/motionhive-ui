import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';

import {
  Routine,
  RoutineLibrary as RoutineScope,
  RoutineService,
  injectIsMobile,
  showApiError,
} from 'core';

import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';
import { SectionLabel } from '../../../../_shared/components/section-label/section-label';
import { RoutineRow } from '../_components/routine-row/routine-row';
import { RoutineFormDialog } from '../_dialogs/routine-form-dialog/routine-form-dialog';
import { ScheduleRoutineDialog } from '../_dialogs/schedule-routine-dialog/schedule-routine-dialog';

/** Routines bucketed by folder (named folders A→Z, then "No folder"). */
interface RoutineGroup {
  /** null for the catch-all "No folder" bucket. */
  folder: string | null;
  label: string;
  items: Routine[];
}

/**
 * Your routine library: saved workout shapes, plus MotionHive's starters.
 *
 * Its own lens because routines carry no date — a shelf, not a diary.
 * Underneath the week strip they read as something the calendar had
 * filtered, which it never did.
 *
 * Starters (`source: SYSTEM`) are runnable and copyable by anyone but
 * owned by nobody, so they are never editable in place; the row offers
 * "save a copy" where a routine of your own offers edit and delete.
 */
@Component({
  selector: 'mh-routine-library',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    ButtonDirective,
    Card,
    ConfirmDialog,
    IconField,
    InputIcon,
    InputTextModule,
    SelectButton,
    Skeleton,
    TooltipModule,
    ListEmptyState,
    SectionLabel,
    RoutineRow,
    RoutineFormDialog,
    ScheduleRoutineDialog,
  ],
  templateUrl: './routine-library.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutineLibrary implements OnInit {
  private readonly _routineService = inject(RoutineService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _router = inject(Router);

  protected readonly isMobile = injectIsMobile();

  readonly routines = signal<Routine[]>([]);
  readonly routinesLoading = signal(false);
  readonly routinesTotal = signal(0);
  readonly routinesPage = signal(1);
  readonly routinesPageSize = 20;
  readonly routinesHasMore = computed(
    () => this.routines().length < this.routinesTotal(),
  );

  /**
   * Which library is showing. Defaults to everything: a new account owns
   * no routines, and starting on "Mine" would greet them with an empty
   * list while the starters sat behind a filter, unseen.
   */
  readonly library = signal<RoutineScope>('all');
  readonly libraryOptions: { label: string; value: RoutineScope }[] = [
    { label: 'All', value: 'all' },
    { label: 'Mine', value: 'mine' },
    { label: 'MotionHive', value: 'system' },
  ];

  readonly routineDialogOpen = signal(false);
  readonly routineDialogTarget = signal<Routine | null>(null);
  readonly scheduleDialogOpen = signal(false);
  readonly scheduleTarget = signal<Routine | null>(null);

  /** id of the routine being started — drives the per-row spinner. */
  readonly startingRoutineId = signal<string | null>(null);

  /** Search over the loaded page (name + folder + notes). */
  readonly routineSearch = signal('');

  readonly filteredRoutines = computed(() => {
    const q = this.routineSearch().trim().toLowerCase();
    if (!q) return this.routines();
    return this.routines().filter((r) => {
      const name = r.name.toLowerCase();
      const folder = (r.folder ?? '').toLowerCase();
      const notes = (r.notes ?? '').toLowerCase();
      return name.includes(q) || folder.includes(q) || notes.includes(q);
    });
  });

  /** Grouped by folder — named folders A→Z, "No folder" last. */
  readonly routineGroups = computed<RoutineGroup[]>(() => {
    const map = new Map<string, Routine[]>();
    for (const r of this.filteredRoutines()) {
      const key = r.folder?.trim() || '';
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    const groups: RoutineGroup[] = [...map.entries()]
      .filter(([k]) => k !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([folder, items]) => ({ folder, label: folder, items }));
    const ungrouped = map.get('') ?? [];
    if (ungrouped.length) {
      groups.push({ folder: null, label: 'No folder', items: ungrouped });
    }
    return groups;
  });

  /** Show folder headers only once there is more than one bucket. */
  readonly routinesGrouped = computed(() => this.routineGroups().length > 1);

  ngOnInit(): void {
    this._loadRoutines();
  }

  // ── Filtering ────────────────────────────────────────────────────

  setLibrary(library: RoutineScope): void {
    if (library === this.library()) return;
    this.library.set(library);
    this._loadRoutines();
  }

  onRoutineSearch(value: string): void {
    this.routineSearch.set(value);
  }

  clearRoutineSearch(): void {
    this.routineSearch.set('');
  }

  loadMoreRoutines(): void {
    if (this.routinesLoading()) return;
    this._loadRoutines(true);
  }

  // ── Actions ──────────────────────────────────────────────────────

  /** See what is in it before starting it. */
  openRoutine(r: Routine): void {
    void this._router.navigate(['/user/routines', r.id]);
  }

  openCreateRoutine(): void {
    this.routineDialogTarget.set(null);
    this.routineDialogOpen.set(true);
  }

  openEditRoutine(r: Routine): void {
    // The list returns minimal exercises (ids only). Fetch the full
    // routine first so the dialog has per-exercise defaults to hydrate.
    this._routineService.get(r.id).subscribe({
      next: (full) => {
        this.routineDialogTarget.set(full);
        this.routineDialogOpen.set(true);
      },
      error: (err) =>
        showApiError(
          this._messageService,
          "Couldn't open routine",
          'Please retry.',
          err,
        ),
    });
  }

  onRoutineSaved(r: Routine): void {
    const existing = this.routines();
    const idx = existing.findIndex((x) => x.id === r.id);
    if (idx >= 0) {
      const next = existing.slice();
      next[idx] = r;
      this.routines.set(next);
    } else {
      this.routines.set([r, ...existing]);
    }
    this.routineDialogOpen.set(false);
  }

  startRoutine(r: Routine): void {
    if (this.startingRoutineId()) return;
    this.startingRoutineId.set(r.id);
    this._routineService.start(r.id).subscribe({
      next: (log) => {
        this.startingRoutineId.set(null);
        void this._router.navigate(['/user/workout-log', log.id]);
      },
      error: (err) => {
        this.startingRoutineId.set(null);
        showApiError(
          this._messageService,
          "Couldn't start routine",
          'Please retry.',
          err,
        );
      },
    });
  }

  /** Copy a starter into my library so it becomes editable. */
  duplicateRoutine(r: Routine): void {
    this._routineService.duplicate(r.id).subscribe({
      next: (copy) => {
        this._messageService.add({
          severity: 'success',
          summary: 'Saved to your routines',
          detail: `"${copy.name}" is yours to change.`,
          life: 3000,
        });
        // Show it straight away: the copy lands in "Mine", and leaving
        // the filter on "MotionHive" would look like nothing happened.
        this.library.set('all');
        this._loadRoutines();
      },
      error: (err) =>
        showApiError(
          this._messageService,
          "Couldn't save a copy",
          'Please try again.',
          err,
        ),
    });
  }

  openScheduleRoutine(r: Routine): void {
    this.scheduleTarget.set(r);
    this.scheduleDialogOpen.set(true);
  }

  /**
   * Scheduling creates a self-assignment, which shows up on the Today
   * lens rather than here. That lens reloads on entry, so there is
   * nothing to refresh in this component.
   */
  onRoutineScheduled(): void {
    this.scheduleDialogOpen.set(false);
  }

  /**
   * Ask first, because deleting a routine does not clean up after
   * itself. `program_assignment.master_program_id` is ON DELETE SET
   * NULL, so anything scheduled from this routine stays on the calendar
   * pointing at nothing unless we cancel it explicitly.
   */
  confirmDeleteRoutine(r: Routine): void {
    this._routineService.scheduledCount(r.id).subscribe({
      next: ({ count }) => this._askDelete(r, count),
      // If the count fails, still allow the delete but do not claim
      // anything about schedules we could not read.
      error: () => this._askDelete(r, 0),
    });
  }

  private _askDelete(r: Routine, scheduled: number): void {
    const sessions = scheduled === 1 ? '1 scheduled session' : `${scheduled} scheduled sessions`;
    this._confirmationService.confirm({
      header: 'Delete routine?',
      message: scheduled
        ? `"${r.name}" has ${sessions} on your calendar. Deleting the routine cancels those too. Workouts you already logged from it stay in your history.`
        : `Delete "${r.name}"? Workouts you already logged from it stay in your history.`,
      icon: 'pi pi-trash',
      acceptLabel: scheduled ? 'Delete and cancel' : 'Delete',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Keep it',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this._deleteRoutine(r, scheduled > 0),
    });
  }

  // ── Internals ────────────────────────────────────────────────────

  /**
   * Paged rather than one fixed slab. The old 100-row limit silently
   * dropped routine 101 with no count and no way to reach it.
   */
  private _loadRoutines(append = false): void {
    const page = append ? this.routinesPage() + 1 : 1;
    this.routinesLoading.set(true);
    this._routineService
      .list({ page, limit: this.routinesPageSize, library: this.library() })
      .subscribe({
        next: (res) => {
          this.routines.update((cur) =>
            append ? [...cur, ...res.items] : res.items,
          );
          this.routinesTotal.set(res.total);
          this.routinesPage.set(page);
          this.routinesLoading.set(false);
        },
        error: (err) => {
          this.routinesLoading.set(false);
          showApiError(
            this._messageService,
            "Couldn't load routines",
            'Please retry.',
            err,
          );
        },
      });
  }

  private _deleteRoutine(r: Routine, cancelScheduled = false): void {
    this._routineService.remove(r.id, cancelScheduled).subscribe({
      next: () => {
        this.routines.update((cur) => cur.filter((x) => x.id !== r.id));
        this._messageService.add({
          severity: 'success',
          summary: 'Routine deleted',
          life: 2000,
        });
      },
      error: (err) =>
        showApiError(
          this._messageService,
          "Couldn't delete routine",
          'Please retry.',
          err,
        ),
    });
  }
}
