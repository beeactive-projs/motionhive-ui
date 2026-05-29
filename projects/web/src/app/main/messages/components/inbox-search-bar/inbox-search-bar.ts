import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Pill-shaped search field at the top of the conversation list.
 *
 * v1 filters the in-memory list client-side; the parent debounces +
 * lower-cases the value and runs `includes()` on participant names.
 * Server-side search is out of scope (no BE endpoint for it).
 */
@Component({
  selector: 'mh-inbox-search-bar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <label class="mh-search">
      <i class="pi pi-search mh-search__icon" aria-hidden="true"></i>
      <input
        type="search"
        class="mh-search__input"
        placeholder="Search messages and people…"
        [ngModel]="value()"
        (ngModelChange)="valueChange.emit($event)"
        aria-label="Search messages and people"
      />
    </label>
  `,
  styles: [`
    :host {
      display: block;
      padding: 14px 16px 10px;
    }
    .mh-search {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 36px;
      padding: 0 12px;
      border-radius: 999px;
      background: #f7f1e6; // surface-100
      cursor: text;
    }
    .mh-search__icon {
      color: #94a3b8;
      font-size: 14px;
    }
    .mh-search__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: none;
      background: transparent;
      font-family: inherit;
      font-size: 13px;
      color: #0f172a;
      outline: none;
    }
    .mh-search__input::placeholder {
      color: #94a3b8;
    }

    /* ── Dark mode ─────────────────────────────────────────── */
    :host-context(.dark) .mh-search {
      background: rgba(248, 250, 252, 0.06);
    }
    :host-context(.dark) .mh-search__input {
      color: var(--p-surface-50, #f1f5f9);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxSearchBar {
  readonly value = input<string>('');
  readonly valueChange = output<string>();
}
