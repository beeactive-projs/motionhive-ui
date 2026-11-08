import { Component, computed, inject, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LoggedSet, SetField, SetFields } from 'core';

import {
  BadgeTones,
  SetBadge,
  SetRowMode,
  SetRowModes,
  cellValue,
  fieldText,
  setLine,
} from '../../logger/logger-flow';
import { formatMeasure } from '../../workouts.config';

/** One input field of the focus card, as drawn. */
interface FocusCell {
  field: SetField;
  text: string;
  /** The grey pre-fill, not a value: shown until confirmed or typed over. */
  prefill: boolean;
  active: boolean;
  unit: string;
}

/**
 * One set of the logger, in the three looks of direction C:
 *
 * - **Done**: one line, "62.5 kg × 8", the effort chip if rated, a check.
 *   Tapping the line opens it to edit in place; the focus and the rest timer
 *   stay where they are.
 * - **Focus**: the set you are on (or one opened to edit), as a honey card
 *   with big fields and the tick. The numbers come pre-filled in grey from
 *   the plan or from last time; a tick with them untouched saves them.
 * - **Future**: a grey line with what the set will be and what it was.
 *
 * The badge (number, or W / D / F / A for a typed set) is its own button: it
 * opens the set's menu (type, note, remove), in every look.
 *
 * Plain buttons on theme tokens rather than Ionic's: these are grid cells
 * sized for a thumb between sets, and Ionic's button chrome fights them.
 */
@Component({
  selector: 'mh-set-row',
  imports: [IonButton, IonIcon, TranslatePipe],
  templateUrl: './set-row.html',
  styleUrl: './set-row.scss',
})
export class SetRow {
  private readonly _translateService = inject(TranslateService);

  readonly set = input.required<LoggedSet>();
  readonly mode = input.required<SetRowMode>();
  readonly badge = input.required<SetBadge>();
  /** The cells this exercise records, in order. */
  readonly fields = input.required<readonly SetField[]>();
  /** What each empty field is pre-filled with. */
  readonly prefill = input<Partial<Record<SetField, number | null>>>({});
  /** "last 60 × 8", or empty. */
  readonly last = input('');
  /** Split squats and single-arm work: reps read as per side. */
  readonly unilateral = input(false);
  /** The field open in the number pad, when it belongs to this set. */
  readonly editing = input<SetField | null>(null);
  /** What the pad has built so far for that field, already formatted. */
  readonly draft = input<string | null>(null);

  readonly tick = output<void>();
  readonly edit = output<SetField>();
  readonly menu = output<void>();
  /** The line was tapped: open this set to edit in place. */
  readonly open = output<void>();

  readonly Modes = SetRowModes;

  /**
   * The label on the open card. A plain set's number goes: its name already
   * says it ("Set 2"). A typed set keeps its letter (W, D) and a superset
   * member its tag (A1), which the name doesn't carry (`short` marks those).
   */
  readonly headBadge = computed(() => {
    const badge = this.badge();
    if (badge.tone !== BadgeTones.Plain) {
      return true;
    }
    return badge.short !== undefined;
  });

  /** A finished set reads with its units: "62.5 kg × 8". */
  readonly doneLine = computed(() =>
    setLine(this.fields(), (field) => cellValue(this.set(), field), true),
  );

  /** A set ahead: its values or its pre-fill, then last time. */
  readonly futureLine = computed(() => {
    const set = this.set();
    const prefill = this.prefill();
    const line = setLine(
      this.fields(),
      (field) => cellValue(set, field) ?? prefill[field] ?? null,
      false,
    );
    // "22 × 10 · last 22 × 10" says one thing twice: keep the last time only
    // when the pre-fill differs from it.
    const last = this.last();
    const sameAsLast = !!line && last.endsWith(` ${line}`);
    return [line || '–', sameAsLast ? '' : last].filter(Boolean).join(' · ');
  });

  readonly rpe = computed(() => {
    const rpe = this.set().rpe;
    return rpe == null ? '' : formatMeasure(Number(rpe), 1);
  });

  readonly cells = computed<FocusCell[]>(() => {
    const set = this.set();
    const prefill = this.prefill();
    return this.fields().map((field) => {
      const active = this.editing() === field;
      const draft = this.draft();
      const value = cellValue(set, field);
      const shown = value ?? prefill[field] ?? null;
      return {
        field,
        active,
        prefill: value == null && !(active && draft),
        text: active && draft ? draft : shown == null ? '' : fieldText(field, shown, false),
        unit: this._unit(field),
      };
    });
  });

  private _unit(field: SetField): string {
    switch (field) {
      case SetFields.Weight:
        return this._translateService.instant('workouts.units.kgShort');
      case SetFields.Reps:
        return this._translateService.instant(
          this.unilateral() ? 'workouts.logger.columns.repsEach' : 'workouts.logger.columns.reps',
        );
      case SetFields.Distance:
        return this._translateService.instant('workouts.units.metersShort');
      case SetFields.Duration:
        return '';
    }
  }
}
