import { Component, computed, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

import { LoggedSet, SetField, setFieldsFor } from 'core';

/** Which cell of a set row the user is editing. */
export interface SetFieldTarget {
  setId: string;
  field: SetField;
}

/**
 * One set: what was planned, what happened, and the tick that says it did.
 *
 * The tick alone is a valid log — every number is optional — so the checkbox
 * is the largest target in the row and never gated on a value being present.
 *
 * Which cells appear is driven by the exercise's kind via `setFieldsFor`, so
 * a plank shows a duration cell and no weight field at all.
 */
@Component({
  selector: 'mh-set-row',
  imports: [IonIcon],
  templateUrl: './set-row.html',
  styleUrl: './set-row.scss',
})
export class SetRow {
  readonly set = input.required<LoggedSet>();
  readonly index = input.required<number>();
  readonly kind = input<string | null>(null);
  /** What the user did for this set number last time. */
  readonly previous = input<LoggedSet | null>(null);
  /** The cell currently open in the keypad, if it belongs to this row. */
  readonly editing = input<SetField | null>(null);

  readonly toggle = output<void>();
  readonly edit = output<SetField>();

  readonly fields = computed<SetField[]>(() => setFieldsFor(this.kind()));

  /** Only shown when it is not a plain working set. */
  readonly typeChip = computed(() => {
    const type = this.set().setType;
    if (!type || type === 'NORMAL') return '';
    return type === 'WARMUP' ? 'W' : type.charAt(0) + type.slice(1).toLowerCase();
  });

  /**
   * The prescription, when this set came from a plan.
   *
   * `resolvedWeightKg` wins over `targetWeightKg`: the backend stamps it at
   * workout start with the %1RM already worked out against the user's latest
   * one-rep max, and the locked decision is that a client sees "82.5 kg", not
   * "80% of 1RM".
   */
  readonly target = computed(() => {
    const assigned = this.set().assignedSet;
    if (!assigned) return '';

    const bits: string[] = [];

    const { targetRepsMin: min, targetRepsMax: max } = assigned;
    if (min != null && max != null && min !== max) bits.push(`${min}–${max}`);
    else if (min ?? max) bits.push(`${min ?? max}`);

    const weight = assigned.resolvedWeightKg ?? assigned.targetWeightKg;
    if (weight != null) bits.push(`${weight}kg`);

    if (assigned.targetDurationSeconds != null) {
      bits.push(`${assigned.targetDurationSeconds}s`);
    }
    if (assigned.targetDistanceMeters != null) {
      bits.push(`${assigned.targetDistanceMeters}m`);
    }

    return bits.join(' × ');
  });

  /** "60 × 8" from the same set number last time — the memory aid. */
  readonly previousLabel = computed(() => {
    const prev = this.previous();
    if (!prev) return '—';
    const bits: string[] = [];
    if (prev.weightKg != null) bits.push(`${prev.weightKg}`);
    if (prev.reps != null) bits.push(`${prev.reps}`);
    if (prev.durationSeconds != null) bits.push(`${prev.durationSeconds}s`);
    return bits.length ? bits.join(' × ') : '—';
  });

  cellValue(field: SetField): string {
    const s = this.set();
    const raw =
      field === 'weight'
        ? s.weightKg
        : field === 'reps'
          ? s.reps
          : field === 'duration'
            ? s.durationSeconds
            : s.distanceMeters;
    return raw == null ? '' : String(raw);
  }
}
