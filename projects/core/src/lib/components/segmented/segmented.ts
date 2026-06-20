import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface SegmentedOption {
  value: string;
  label: string;
  /** Optional leading icon class (e.g. "pi pi-list"). */
  icon?: string;
  /** Optional trailing count badge. */
  count?: number;
}

/**
 * MotionHive segmented control — the single pill-segmented pattern from the
 * Action System (§8). Single-select, 2–4 fixed options. Use for switching the
 * *view* of the same content (list/calendar, Coach/Train), NOT for content tabs
 * (use `p-tabs`) or multi-select filters (use chips).
 *
 * `variant="honey"` is reserved for identity-level switches (the sidebar
 * Coach/Train mode); everything else uses the neutral variant.
 */
@Component({
  selector: 'mh-segmented',
  standalone: true,
  template: `
    <div class="mh-seg" [class.mh-seg--honey]="variant() === 'honey'" role="tablist" [attr.aria-label]="ariaLabel()">
      @for (opt of options(); track opt.value) {
        <button
          type="button"
          role="tab"
          class="mh-seg__btn"
          [class.is-on]="value() === opt.value"
          [attr.aria-selected]="value() === opt.value"
          (click)="select(opt.value)"
        >
          @if (opt.icon) {
            <i [class]="opt.icon"></i>
          }
          <span>{{ opt.label }}</span>
          @if (opt.count != null) {
            <span class="mh-seg__count">{{ opt.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .mh-seg {
        display: inline-flex;
        gap: 2px;
        padding: 3px;
        background: var(--p-surface-100);
        border-radius: 9px;
      }
      .mh-seg__btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: none;
        background: transparent;
        border-radius: 6px;
        padding: 5px 13px;
        font-family: inherit;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--p-text-muted-color);
        cursor: pointer;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }
      .mh-seg__btn i {
        font-size: 0.875rem;
      }
      .mh-seg__btn:hover:not(.is-on) {
        color: var(--p-text-color);
      }
      .mh-seg__btn.is-on {
        background: var(--p-surface-0);
        color: var(--p-text-color);
        box-shadow: 0 1px 2px rgba(14, 27, 49, 0.1);
      }
      .mh-seg__count {
        font-size: 0.6875rem;
        font-weight: 700;
        opacity: 0.65;
      }
      .mh-seg__btn.is-on .mh-seg__count {
        opacity: 0.8;
      }

      /* Honey variant — identity-level switch (Coach/Train) */
      .mh-seg--honey .mh-seg__btn.is-on {
        background: var(--p-primary-500);
        color: var(--color-navy-900, #0e1b31);
        box-shadow: 0 1px 2px rgba(217, 119, 6, 0.25);
      }

      /* Dark theme — the neutral track/active pill use the non-flipping
         surface scale (surface-100 / surface-0), so on dark the active pill
         would be white with white text. Flip them: a recessed translucent
         track + a raised theme surface for the active pill. The honey variant
         keeps its honey pill (already readable on dark). */
      :host-context(.dark) {
        .mh-seg {
          background: color-mix(in srgb, var(--p-text-color) 8%, transparent);
        }
        .mh-seg__btn.is-on {
          background: var(--p-surface-800, #27272a);
          color: var(--p-text-color);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
        }
        .mh-seg--honey .mh-seg__btn.is-on {
          background: var(--p-primary-500);
          color: var(--color-navy-900, #0e1b31);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Segmented {
  readonly options = input.required<SegmentedOption[]>();
  /** Two-way bindable selected value. */
  readonly value = model<string>();
  readonly variant = input<'neutral' | 'honey'>('neutral');
  readonly ariaLabel = input<string>('');

  protected select(v: string): void {
    this.value.set(v);
  }
}
