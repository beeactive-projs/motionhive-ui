import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/**
 * One row in an action sheet — icon · label · optional danger flag.
 *
 * Consumers build `ActionItem[]` and pass it to `<mh-action-list>`.
 * The list emits `select(item)` so the parent can switch on
 * `item.id` to dispatch.
 *
 * We model rows as plain data (instead of projected `<li>` children)
 * because every consumer follows the same shape and the data form is
 * easier to compute conditionally (filter by status, gate by perm).
 */
export interface ActionItem {
  /** Stable identifier handled by the parent's `(select)` handler. */
  id: string;
  /** PrimeIcons class, e.g. `pi pi-pencil`. */
  icon: string;
  /** Human label, e.g. "Edit session". */
  label: string;
  /** Coral text + coral icon for destructive verbs. */
  danger?: boolean;
  /** Disable the row (renders muted, no click). */
  disabled?: boolean;
}

/**
 * `mh-action-list` — vertical list of buttons used inside a
 * `<mh-bottom-sheet size="small">` (action sheet pattern from frames
 * 1C / session-detail ⋮ / future calendar event sheet).
 *
 * Inputs:
 *   - `items`    — required, array of `ActionItem`.
 *
 * Output:
 *   - `select`   — emits the chosen `ActionItem` when a row is clicked.
 *                  Parent should close the sheet + dispatch.
 *
 * Visual: thin divider between rows, icon in primary tint, danger
 * rows in coral. Matches the design's frame 1C exactly.
 */
@Component({
  selector: 'mh-action-list',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="mh-al" role="list">
      @for (item of items(); track item.id) {
        <li class="mh-al__item">
          <button
            type="button"
            class="mh-al__btn"
            [class.mh-al__btn--danger]="item.danger"
            [disabled]="item.disabled"
            (click)="onSelect(item)"
          >
            <i [class]="item.icon" aria-hidden="true"></i>
            <span>{{ item.label }}</span>
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: block; }
    .mh-al { list-style: none; padding: 0; margin: 0; }
    .mh-al__item {
      border-bottom: 1px solid var(--p-content-border-color);
      &:last-child { border-bottom: none; }
    }
    .mh-al__btn {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 13px 16px;
      background: transparent;
      border: none;
      text-align: left;
      font-size: 13px;
      color: var(--p-text-color);
      cursor: pointer;
      font-family: inherit;
      transition: background 120ms ease;
    }
    .mh-al__btn:hover:not([disabled]) {
      background: color-mix(in srgb, var(--p-text-color) 4%, transparent);
    }
    .mh-al__btn[disabled] {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .mh-al__btn i {
      font-size: 14px;
      color: var(--p-primary-700);
      flex-shrink: 0;
      width: 18px;
      text-align: center;
    }
    .mh-al__btn--danger { color: var(--p-red-700); }
    .mh-al__btn--danger i { color: var(--p-red-500); }
  `,
})
export class ActionList {
  readonly items = input.required<ActionItem[]>();
  readonly select = output<ActionItem>();

  protected onSelect(item: ActionItem): void {
    if (item.disabled) return;
    this.select.emit(item);
  }
}
