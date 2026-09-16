import { Component, computed, effect, input, output, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

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
 * way to "82.5"); the parent parses on commit.
 */
@Component({
  selector: 'mh-numeric-keypad',
  imports: [IonButton, IonIcon],
  templateUrl: './numeric-keypad.html',
  styleUrl: './numeric-keypad.scss',
})
export class NumericKeypad {
  readonly field = input.required<KeypadField>();
  readonly value = input('');
  /** What the row above is editing, so the pad says what it is changing. */
  readonly label = input('');

  /** Emits the committed value: seconds for a clock, the typed number otherwise. */
  readonly commit = output<string>();
  readonly dismiss = output<void>();

  readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

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
    return this.isClock() ? `${step}s` : `${step}`;
  });

  /**
   * A duration is entered as a clock, filling right to left the way every
   * timer input does: 1, 3, 0 builds 1:30. Typing "90" for a ninety-second
   * hold is arithmetic the user should not have to do.
   */
  readonly isClock = computed(() => this.field() === KeypadFields.Duration);

  /** What the pad shows back — the clock being built, or the raw number. */
  readonly display = computed(() =>
    this.isClock() ? clockDigitsToDisplay(this.draft()) : this.draft() || '0',
  );

  constructor() {
    // Re-seed whenever the parent points the pad at a different cell.
    effect(() => this.draft.set(this.value()));
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
