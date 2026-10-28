import { Service, computed, signal } from '@angular/core';

export interface SaveRoutineRequest {
  logId: string;
  suggestedName: string;
}

/**
 * Opens the "Save as routine" sheet from anywhere, including a toast that
 * outlives the screen it came from: finishing a workout lands back on the
 * Workouts tab before the offer is taken up. The sheet itself is hosted by
 * the tabs layout, which every training screen sits inside.
 *
 * Also remembers which workouts were saved this session, so the offer is
 * not made twice for the same one. The API would happily make a duplicate.
 */
@Service()
export class SaveRoutineService {
  private readonly _request = signal<SaveRoutineRequest | null>(null);
  private readonly _saved = signal<ReadonlyMap<string, string>>(new Map());

  readonly request = this._request.asReadonly();
  readonly isOpen = computed(() => this._request() !== null);

  open(request: SaveRoutineRequest): void {
    if (this._saved().has(request.logId)) return;
    this._request.set(request);
  }

  close(): void {
    this._request.set(null);
  }

  /** The routine's name if this workout was saved as one this session. */
  savedName(logId: string): string | null {
    return this._saved().get(logId) ?? null;
  }

  markSaved(logId: string, name: string): void {
    this._saved.update((saved) => new Map(saved).set(logId, name));
  }
}
