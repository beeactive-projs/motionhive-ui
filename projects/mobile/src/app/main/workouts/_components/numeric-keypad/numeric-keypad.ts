import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { decimalSeparator, localizeTypedNumber } from 'core';

import {
  KeypadField,
  KeypadFields,
  clockDigitsToDisplay,
  clockDigitsToSeconds,
} from '../../workouts.config';

/** Per-field stepper increments. Weight steps by the smallest plate pair. */
const STEP: Record<KeypadField, number> = {
  [KeypadFields.Weight]: 2.5,
  [KeypadFields.Reps]: 1,
  [KeypadFields.Duration]: 15,
  [KeypadFields.Distance]: 50,
  [KeypadFields.Rpe]: 0.5,
};

const ALLOWS_DECIMAL: Record<KeypadField, boolean> = {
  [KeypadFields.Weight]: true,
  [KeypadFields.Reps]: false,
  [KeypadFields.Duration]: false,
  [KeypadFields.Distance]: false,
  [KeypadFields.Rpe]: true,
};

/**
 * The docked number pad.
 *
 * The system keyboard is wrong here for two reasons: it covers most of the
 * set grid the user is reading, and its number row is a long reach with one
 * thumb while holding a bar. This keeps entry in the bottom third and adds
 * the steppers that are how weights actually get chosen — plates come in
 * pairs, so 2.5 is one tap, not four digits.
 *
 * The keys are plain buttons on theme tokens, not `ion-button`s: a keypad is
 * a grid of same-sized targets, and Ionic's button chrome fights that at
 * every key. Done and the close chevron are ordinary actions, so they are
 * Ionic's.
 *
 * The buffer lives HERE rather than in the parent. Round-tripping every
 * keystroke through an input/output pair means each tap reads whatever the
 * parent last rendered, so four fast taps all compute from the same stale
 * value and only the last one survives. The parent seeds the buffer and hears
 * back once, on commit.
 *
 * Held as a string so a trailing decimal point survives typing ("82." on the
 * way to "82.5"); the parent parses on commit. The buffer always uses "." —
 * that is what the parent seeds and parses — and only what the pad *shows*
 * (buffer, decimal key, steppers) uses the UI locale's mark, so Romanian
 * types "82,5" exactly as the set rows display it.
 */
@Component({
  selector: 'mh-numeric-keypad',
  imports: [IonButton, IonIcon, TranslatePipe],
  templateUrl: './numeric-keypad.html',
  styleUrl: './numeric-keypad.scss',
})
export class NumericKeypad {
  private readonly _translateService = inject(TranslateService);

  readonly field = input.required<KeypadField>();
  readonly value = input('');
  /**
   * Which cell the pad is bound to. Two cells can hold the same value — two
   * empty ones, say — and a re-seed keyed on the value alone would then skip,
   * carrying the last cell's typing into the next.
   */
  readonly cell = input('');
  /** What the row above is editing, so the pad says what it is changing. */
  readonly label = input('');
  /** Offer "Next field" in place of the close chevron — the logger walks its grid. */
  readonly showNext = input(false);

  /** Emits the committed value: seconds for a clock, the typed number otherwise. */
  readonly commit = output<string>();
  readonly dismiss = output<void>();
  /** Commit this value and move to the next cell. */
  readonly next = output<string>();
  /**
   * What the cell being edited should show while typing — formatted, and
   * empty until something is typed so the cell keeps its placeholder. One
   * way only: the parent never feeds it back into `value`.
   */
  readonly preview = output<string>();

  /** The decimal key's face: "." in English, "," in Romanian. */
  readonly decimalMark = decimalSeparator();

  /** What the user has typed so far. Seeded from `value` when the cell changes. */
  readonly draft = signal('');

  /** What `commit` should carry — seconds once a clock is resolved. */
  readonly committed = computed(() => {
    if (!this.isClock()) return this.draft();
    const seconds = clockDigitsToSeconds(this.draft());
    return seconds === null ? '' : String(seconds);
  });

  readonly allowsDecimal = computed(() => ALLOWS_DECIMAL[this.field()]);

  readonly stepLabel = computed(() => {
    const step = STEP[this.field()];
    return this.isClock()
      ? this._translateService.instant('workouts.keypad.stepSeconds', { step })
      : localizeTypedNumber(String(step));
  });

  /**
   * A duration is entered as a clock, filling right to left the way every
   * timer input does: 1, 3, 0 builds 1:30. Typing "90" for a ninety-second
   * hold is arithmetic the user should not have to do.
   */
  readonly isClock = computed(() => this.field() === KeypadFields.Duration);

  /** What the pad shows back — the clock being built, or the raw number. */
  readonly display = computed(() =>
    this.isClock() ? clockDigitsToDisplay(this.draft()) : localizeTypedNumber(this.draft() || '0'),
  );

  constructor() {
    // Re-seed whenever the parent points the pad at a different cell.
    effect(() => {
      this.cell();
      this.draft.set(this.value());
    });
    effect(() => this.preview.emit(this.draft() ? this.display() : ''));
  }

  press(key: string): void {
    if (this.isClock()) {
      // Digits only, and capped at four so the clock cannot run past 99:59.
      if (key === '.') return;
      this.draft.update((current) => (current + key).replace(/^0+/, '').slice(0, 4));
      return;
    }
    // One decimal point, and never a leading run of zeros.
    if (key === '.' && this.draft().includes('.')) return;
    this.draft.update((current) => (current + key).replace(/^0+(?=\d)/, ''));
  }

  backspace(): void {
    this.draft.update((current) => current.slice(0, -1));
  }

  clear(): void {
    this.draft.set('');
  }

  step(direction: 1 | -1): void {
    const step = STEP[this.field()];

    if (this.isClock()) {
      const seconds = clockDigitsToSeconds(this.draft()) ?? 0;
      const next = Math.max(0, seconds + step * direction);
      // Back to digits so further typing continues from what is on screen.
      this.draft.set(
        `${Math.floor(next / 60)}${String(next % 60).padStart(2, '0')}`.replace(/^0+(?=\d)/, ''),
      );
      return;
    }

    const current = parseFloat(this.draft() || '0');
    const next = Math.max(0, (Number.isNaN(current) ? 0 : current) + step * direction);
    // Trim the float noise 2.5 increments produce (0.30000000000000004).
    this.draft.set(String(Math.round(next * 100) / 100));
  }
}
