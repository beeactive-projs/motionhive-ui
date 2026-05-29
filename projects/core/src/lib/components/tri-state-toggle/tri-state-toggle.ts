import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

export interface TriStateOption<T> {
  value: T;
  label: string;
  icon?: string; // PrimeIcons class
  color?: string; // CSS color (used for the active tile background tint)
}

/**
 * `mh-tri-state-toggle` — generic 3-option segmented control with a
 * `null` slot.
 *
 * Built for attendance (Attended / No-show / Unmarked) but reusable
 * anywhere a tri-state UI is useful (e.g. invoice paid/disputed/unknown).
 *
 * Generics: `T` is the value type. `null` is always a valid state.
 */
@Component({
  selector: 'mh-tri-state-toggle',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mh-tristate" role="group">
      @for (opt of options; track opt.value) {
        <button
          type="button"
          class="mh-tristate__btn"
          [class.is-active]="value === opt.value"
          [style.borderColor]="value === opt.value ? opt.color : null"
          [style.color]="value === opt.value ? opt.color : null"
          (click)="select(opt.value)"
        >
          @if (opt.icon) {
            <i [class]="opt.icon" aria-hidden="true"></i>
          }
          <span>{{ opt.label }}</span>
        </button>
      }
      <button
        type="button"
        class="mh-tristate__btn mh-tristate__btn--null"
        [class.is-active]="value == null"
        (click)="select(null)"
        aria-label="Unmarked"
      >—</button>
    </div>
  `,
  styles: `
    .mh-tristate {
      display: inline-flex;
      gap: 4px;
      padding: 2px;
      background: var(--p-surface-100);
      border-radius: 8px;
    }
    .mh-tristate__btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      color: var(--p-text-muted-color);
      transition: all 120ms ease;

      &:hover { background: var(--p-content-background); }
      &.is-active {
        background: var(--p-content-background);
        border-width: 1px;
        border-style: solid;
      }
    }
    .mh-tristate__btn--null.is-active {
      border-color: var(--p-surface-300);
      color: var(--p-text-color);
    }
  `,
})
export class TriStateToggle<T> {
  /** Current value. `null` means "unmarked". */
  @Input() value: T | null = null;

  /** The two non-null options (the third is always the implicit "unmarked"). */
  @Input({ required: true }) options!: TriStateOption<T>[];

  @Output() valueChange = new EventEmitter<T | null>();

  protected select(next: T | null): void {
    this.value = next;
    this.valueChange.emit(next);
  }
}
