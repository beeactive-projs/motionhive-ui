import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { IonInput, IonNote } from '@ionic/angular/standalone';
import { take } from 'rxjs';

import { SessionInstance, SessionService } from 'core';

import { SheetShell } from '../../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../../_shared/services/feedback.service';

/** The API's own bounds — `@Min(1) @Max(1000)` on `capacityOverride`. */
const MIN_CAPACITY = 1;
const MAX_CAPACITY = 1000;

/**
 * Open more spots on a single occurrence.
 *
 * Writes `capacityOverride`, so it changes this session only and leaves the
 * series template alone — which is the point: a one-off busy week should not
 * resize every future week.
 *
 * The floor is the confirmed count, mirroring a server-side guard that rejects
 * shrinking capacity below the people already in. Enforced here so the coach
 * gets a disabled button and a reason instead of a 400.
 */
@Component({
  selector: 'mh-capacity-sheet',
  imports: [IonInput, IonNote, SheetShell],
  templateUrl: './capacity-sheet.html',
  styleUrl: './capacity-sheet.scss',
})
export class CapacitySheet {
  private readonly _sessionService = inject(SessionService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly open = model(false);
  readonly instance = input<SessionInstance | null>(null);
  /**
   * Taken from the loaded roster, not `instance.confirmedCount` — approving
   * someone does not refetch the instance, so the counter goes stale and the
   * floor would be wrong exactly when it matters.
   */
  readonly confirmed = input(0);
  readonly waitlisted = input(0);

  readonly saved = output<void>();

  readonly value = signal<number | null>(null);
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.value.set(this._currentCapacity());
    });
  }

  private readonly _currentCapacity = computed(() => {
    const instance = this.instance();
    return instance?.capacityOverride ?? instance?.template?.capacity ?? null;
  });

  readonly floor = computed(() => Math.max(MIN_CAPACITY, this.confirmed()));
  readonly max = MAX_CAPACITY;

  /** Enough room for everyone waiting — the number worth suggesting. */
  readonly suggestion = computed(() => {
    const waiting = this.waitlisted();
    if (waiting === 0) return null;
    const target = this.confirmed() + waiting;
    return target > (this._currentCapacity() ?? 0) ? Math.min(target, MAX_CAPACITY) : null;
  });

  readonly error = computed(() => {
    const value = this.value();
    if (value === null) return null;
    if (value < this.floor()) {
      return `${this.confirmed()} people are already booked in.`;
    }
    if (value > MAX_CAPACITY) return `The most a session can hold is ${MAX_CAPACITY}.`;
    return null;
  });

  readonly canSave = computed(
    () =>
      this.value() !== null &&
      !this.error() &&
      this.value() !== this._currentCapacity(),
  );

  setValue(raw: string | number | null | undefined): void {
    if (raw === null || raw === undefined || raw === '') {
      this.value.set(null);
      return;
    }
    const parsed = Number(raw);
    this.value.set(Number.isFinite(parsed) ? Math.round(parsed) : null);
  }

  applySuggestion(): void {
    const suggestion = this.suggestion();
    if (suggestion !== null) this.value.set(suggestion);
  }

  save(): void {
    const instance = this.instance();
    const value = this.value();
    if (!instance || value === null || !this.canSave() || this.saving()) return;

    this.saving.set(true);
    this._sessionService
      .patchInstance(instance.id, { capacityOverride: value })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.open.set(false);
          void this._feedbackService.success('Capacity updated');
          // Raising capacity does NOT sweep the waitlist server-side, so the
          // roster has to be reloaded rather than assumed to have shifted.
          this.saved.emit();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(error, 'Could not change the capacity.');
        },
      });
  }
}
