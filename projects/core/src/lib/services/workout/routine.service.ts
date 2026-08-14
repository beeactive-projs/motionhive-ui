import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import type {
  CreateRoutinePayload,
  RoutineSet,
  ListRoutinesQuery,
  PaginatedRoutines,
  ProgramExerciseWire,
  ProgramWire,
  RoutineSource,
  Routine,
  RoutineExercise,
  UpdateRoutinePayload,
} from '../../models/workout/routine.model';
import type { WorkoutLog } from '../../models/workout/log.model';

const BASE = '/programs';

/** The API returns DECIMAL columns as strings; the UI wants numbers. */
function toNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Collapse a prescribed exercise into the flat shape the routine editor
 * uses. A routine authored here writes N identical sets, so the first set
 * carries the targets and the count is the set total. A routine that
 * later gains real per-set variation will need the editor to grow rows
 * rather than this adapter to get cleverer.
 */
function toRoutineExercise(pe: ProgramExerciseWire): RoutineExercise {
  const wire = pe.sets ?? [];
  const first = wire[0];
  const sets: RoutineSet[] = wire.map((s) => ({
    setType: s.setType,
    targetRepsMin: s.targetRepsMin,
    targetRepsMax: s.targetRepsMax,
    targetWeightKg: toNumber(s.targetWeightKg),
    targetDurationSeconds: s.targetDurationSeconds ?? null,
    restAfterSeconds: s.restAfterSeconds,
  }));
  // If every set matches the first, the flat summary is lossless and the
  // simple editor can stay. Otherwise a flat save would flatten real
  // programming, so the editor has to show the rows.
  const hasVariedSets = sets.some(
    (s) =>
      s.setType !== sets[0].setType ||
      s.targetRepsMin !== sets[0].targetRepsMin ||
      s.targetRepsMax !== sets[0].targetRepsMax ||
      s.targetWeightKg !== sets[0].targetWeightKg ||
      s.targetDurationSeconds !== sets[0].targetDurationSeconds,
  );
  return {
    sets,
    hasVariedSets,
    id: pe.id,
    exerciseId: pe.exerciseId,
    orderIndex: pe.orderIndex,
    supersetGroupId: pe.supersetGroupId,
    notes: pe.notes,
    defaultSets: pe.sets?.length ?? 3,
    targetRepsMin: first?.targetRepsMin ?? null,
    targetRepsMax: first?.targetRepsMax ?? null,
    targetWeightKg: toNumber(first?.targetWeightKg),
    restAfterSeconds: first?.restAfterSeconds ?? null,
    exercise: pe.exercise,
  };
}

function toRoutine(p: ProgramWire): Routine {
  return {
    id: p.id,
    ownerId: p.ownerId,
    // Older responses predate the field; treat anything unstamped as
    // the user's own rather than silently badging it as ours.
    source: p.source ?? 'USER',
    name: p.name,
    notes: p.description,
    folder: p.folder,
    lastPerformedAt: p.lastPerformedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    deletedAt: p.deletedAt,
    // List responses carry a count instead of the tree; detail carries
    // the tree, so derive the count from it there.
    exerciseCount:
      p.workouts?.[0]?.exercises?.length ?? p.exerciseCount ?? 0,
    exercises: p.workouts?.[0]?.exercises?.map(toRoutineExercise),
  };
}

/**
 * Routines — a person's own saved workouts. Since the API unified plans
 * (migration 056) a routine IS a program with `isSingleWorkout: true`,
 * so this service talks to `/programs` and adapts the nested response
 * into the flat routine shape the UI thinks in. Coaches author multi-week
 * programs through the same endpoints; the two are told apart by that
 * flag, not by separate APIs.
 */
@Injectable({ providedIn: 'root' })
export class RoutineService {
  private readonly _http = inject(HttpClient);
  private readonly _base = `${environment.apiUrl}${BASE}`;
  private readonly _logsBase = `${environment.apiUrl}/workout-logs`;

  list(query: ListRoutinesQuery = {}): Observable<PaginatedRoutines> {
    let p = new HttpParams().set('isSingleWorkout', 'true');
    if (query.page !== undefined) p = p.set('page', String(query.page));
    if (query.limit !== undefined) p = p.set('limit', String(query.limit));
    if (query.library) p = p.set('library', query.library);
    return this._http
      .get<{
        items: ProgramWire[];
        total: number;
        page: number;
        pageSize: number;
      }>(this._base, { params: p })
      .pipe(map((r) => ({ ...r, items: r.items.map(toRoutine) })));
  }

  get(id: string): Observable<Routine> {
    return this._http
      .get<ProgramWire>(`${this._base}/${id}`)
      .pipe(map(toRoutine));
  }

  create(payload: CreateRoutinePayload): Observable<Routine> {
    return this._http
      .post<ProgramWire>(this._base, this._toProgramPayload(payload, true))
      .pipe(map(toRoutine));
  }

  update(id: string, payload: UpdateRoutinePayload): Observable<Routine> {
    return this._http
      .patch<ProgramWire>(
        `${this._base}/${id}`,
        this._toProgramPayload(payload, false),
      )
      .pipe(map(toRoutine));
  }

  /** Copy a routine into my library. The way a starter is customised. */
  duplicate(id: string): Observable<Routine> {
    return this._http
      .post<ProgramWire>(`${this._base}/${id}/duplicate`, {})
      .pipe(map(toRoutine));
  }

  remove(id: string, cancelScheduled = false): Observable<void> {
    return this._http.delete<void>(`${this._base}/${id}${cancelScheduled ? '?cancelScheduled=true' : ''}`);
  }

  /** Live schedules pointing at this routine, for the delete confirm. */
  scheduledCount(id: string): Observable<{ count: number }> {
    return this._http.get<{ count: number }>(
      `${this._base}/${id}/scheduled-count`,
    );
  }

  /**
   * One-tap start. Goes through the shared log-start endpoint rather
   * than a routine-specific one, so an ad-hoc start and a scheduled
   * start land in the same place.
   */
  start(id: string): Observable<WorkoutLog> {
    return this._http.post<WorkoutLog>(this._logsBase, { programId: id });
  }

  /** `notes` is the UI's word for what the API stores as `description`. */
  private _toProgramPayload(
    payload: UpdateRoutinePayload,
    isCreate: boolean,
  ): Record<string, unknown> {
    const { notes, ...rest } = payload;
    return {
      ...rest,
      ...(notes !== undefined ? { description: notes } : {}),
      ...(isCreate ? { isSingleWorkout: true } : {}),
    };
  }
}
