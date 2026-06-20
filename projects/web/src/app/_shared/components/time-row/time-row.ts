import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * `mh-time-row` — canonical row primitive for any time-based item
 * (session card, agenda entry, calendar list, attendance row, …).
 *
 * Shape:
 *
 *  ┌──────┬───────────────────────────────┬─────┐
 *  │09:00 │ Title (2-line clamp)          │  ›  │
 *  │60min │ chip · chip · meta text        │     │
 *  └──────┴───────────────────────────────┴─────┘
 *
 * Slots:
 *   - `[meta]`     — chips + small text under the title (1 row).
 *   - `[trailing]` — optional right-side action (Check in button, etc.).
 *                    Replaces the chevron when projected.
 *
 * Inputs:
 *   - `time`     — main time label (e.g. "09:00").
 *   - `duration` — small text under time (e.g. "60min").
 *   - `title`    — title (2-line clamp via CSS).
 *   - `tone`     — left-edge color: 'honey' (in-person/group),
 *                   'teal' (online), 'navy' (1-on-1), 'coral' (conflict),
 *                   'muted' (past/cancelled), 'none' (no edge).
 *   - `conflict` — when true, adds an outer coral ring per the design.
 *   - `interactive` — when true, hover/active states + cursor-pointer.
 *                      Default true; pass false for read-only rows.
 *   - `chevron`  — show the right-side ›. Default true unless a
 *                   [trailing] slot is projected (caller's choice).
 */
@Component({
  selector: 'mh-time-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-row.html',
  styleUrl: './time-row.scss',
  host: {
    '[class.mh-tr-host--interactive]': 'interactive()',
    '[attr.role]': "interactive() ? 'button' : null",
    '[attr.tabindex]': "interactive() ? '0' : null",
    '(keydown)': 'onKey($event)',
  },
})
export class TimeRow {
  readonly time = input.required<string>();
  readonly duration = input<string>('');
  readonly title = input.required<string>();
  readonly tone = input<
    'honey' | 'teal' | 'navy' | 'coral' | 'muted' | 'none'
  >('none');
  readonly conflict = input(false);
  readonly interactive = input(true);
  /**
   * Chevron visibility. Default true. Caller-controlled: set false
   * when projecting [trailing] so they don't both render. (We can't
   * cheaply detect projected content at runtime, so this is explicit.)
   */
  readonly chevron = input(true);

  /**
   * Keyboard activation. Space and Enter trigger a synthetic click
   * on the host so consumers' `(click)` handlers fire from keyboard
   * too. This is what `<button>` would give us for free; we have to
   * wire it because the host is a `<mh-time-row>` element.
   */
  protected onKey(ev: KeyboardEvent): void {
    if (!this.interactive()) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      (ev.target as HTMLElement).click();
    }
  }
}
