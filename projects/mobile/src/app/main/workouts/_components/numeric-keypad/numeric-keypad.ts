import { Component, computed, effect, input, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

/** What the keypad is editing — decides the step size and whether decimals make sense. */
export type KeypadField = 'weight' | 'reps' | 'duration' | 'distance' | 'rpe';

/** Per-field stepper increments. Weight steps by the smallest plate pair. */
const STEP: Record<KeypadField, number> = {
  weight: 2.5,
  reps: 1,
  duration: 15,
  distance: 50,
  rpe: 0.5,
};

const ALLOWS_DECIMAL: Record<KeypadField, boolean> = {
  weight: true,
  reps: false,
  duration: false,
  distance: false,
  rpe: true,
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
  imports: [IonIcon],
  templateUrl: './numeric-keypad.html',
  styleUrl: './numeric-keypad.scss',
})
export class NumericKeypad {
  readonly field = input.required<KeypadField>();
  readonly value = input('');
  /** What the row above is editing, so the pad says what it is changing. */
  readonly label = input('');

  readonly commit = output<string>();
  readonly dismiss = output<void>();

  readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  /** What the user has typed so far. Seeded from `value` when the cell changes. */
  readonly draft = signal('');

  readonly allowsDecimal = computed(() => ALLOWS_DECIMAL[this.field()]);

  readonly stepLabel = computed(() => `${STEP[this.field()]}`);

  constructor() {
    // Re-seed whenever the parent points the pad at a different cell.
    effect(() => this.draft.set(this.value()));
  }

  press(key: string): void {
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
    const current = parseFloat(this.draft() || '0');
    const next = Math.max(0, (Number.isNaN(current) ? 0 : current) + step * direction);
    // Trim the float noise 2.5 increments produce (0.30000000000000004).
    this.draft.set(String(Math.round(next * 100) / 100));
  }
}
