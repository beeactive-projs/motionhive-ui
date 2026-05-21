import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  HostListener,
  computed,
  input,
} from '@angular/core';

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
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="mh-tr"
      [class.mh-tr--honey]="tone() === 'honey'"
      [class.mh-tr--teal]="tone() === 'teal'"
      [class.mh-tr--navy]="tone() === 'navy'"
      [class.mh-tr--coral]="tone() === 'coral'"
      [class.mh-tr--muted]="tone() === 'muted'"
      [class.mh-tr--conflict]="conflict()"
      [class.mh-tr--static]="!interactive()"
    >
      <div class="mh-tr__time">
        <span class="mh-tr__h">{{ time() }}</span>
        @if (duration()) {
          <span class="mh-tr__d">{{ duration() }}</span>
        }
      </div>
      <div class="mh-tr__main">
        <div class="mh-tr__title">{{ title() }}</div>
        <div class="mh-tr__meta">
          <ng-content select="[meta]"></ng-content>
        </div>
      </div>
      <div class="mh-tr__trail">
        <ng-content select="[trailing]"></ng-content>
        @if (showChevron()) {
          <i class="pi pi-angle-right mh-tr__chev" aria-hidden="true"></i>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }

    .mh-tr {
      display: grid;
      grid-template-columns: 46px 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 10px;
      transition: border-color 120ms ease, background 120ms ease;
    }

    /* Tone edges — 3px colored left border, slightly tighter top-left
       and bottom-left to keep the card silhouette square. */
    .mh-tr--honey   { border-left: 3px solid var(--p-primary-500); border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
    .mh-tr--teal    { border-left: 3px solid var(--p-teal-500, #14B8A6); border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
    .mh-tr--navy    { border-left: 3px solid var(--p-blue-700, #1D4ED8); border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
    .mh-tr--coral   { border-left: 3px solid var(--p-red-500, #F97066); border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
    .mh-tr--muted   { opacity: 0.7; }

    /* Conflict ring: 2px outer halo on top of whatever tone the row has. */
    .mh-tr--conflict {
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-red-500, #F97066) 45%, transparent);
    }

    .mh-tr__time {
      text-align: center;
      flex: 0 0 auto;
      min-width: 0;
    }
    .mh-tr__h {
      display: block;
      font-family: 'Poppins', sans-serif;
      font-weight: 600;
      font-size: 13px;
      color: var(--p-text-color);
      font-variant-numeric: tabular-nums;
    }
    .mh-tr__d {
      display: block;
      margin-top: 2px;
      font-size: 9px;
      color: var(--p-text-muted-color);
    }

    .mh-tr__main { min-width: 0; }
    .mh-tr__title {
      font-size: 13px;
      font-weight: 600;
      color: var(--p-text-color);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.35;
    }
    .mh-tr__meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px;
      margin-top: 4px;
      font-size: 10px;
      color: var(--p-text-muted-color);
      min-height: 0;
    }
    /* Empty meta slot — keep the row tight, don't reserve the gap. */
    .mh-tr__meta:empty { display: none; }

    .mh-tr__trail {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--p-text-muted-color);
      flex-shrink: 0;
    }
    .mh-tr__chev { font-size: 12px; color: var(--p-text-muted-color); }

    /* Interactive states — hover ring + cursor on tap targets. */
    .mh-tr:not(.mh-tr--static):hover {
      border-color: var(--p-primary-300);
    }
    :host(.mh-tr-host--interactive) {
      cursor: pointer;
      outline: none;
    }
    :host(.mh-tr-host--interactive:focus-visible) .mh-tr {
      border-color: var(--p-primary-500);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-primary-500) 25%, transparent);
    }
    /* When a [trailing] element is projected, the auto-chevron is
       hidden via the showChevron computed signal. */
  `,
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

  /** Whether the auto-chevron renders. Hidden when chevron=false. */
  protected readonly showChevron = computed(() => this.chevron());

  @HostBinding('class.mh-tr-host--interactive')
  get _interactiveClass(): boolean { return this.interactive(); }

  @HostBinding('attr.role')
  get _role(): string | null { return this.interactive() ? 'button' : null; }

  @HostBinding('attr.tabindex')
  get _tabindex(): string | null { return this.interactive() ? '0' : null; }

  /**
   * Keyboard activation. Space and Enter trigger a synthetic click
   * on the host so consumers' `(click)` handlers fire from keyboard
   * too. This is what `<button>` would give us for free; we have to
   * wire it because the host is a `<mh-time-row>` element.
   */
  @HostListener('keydown', ['$event'])
  protected _onKey(ev: KeyboardEvent): void {
    if (!this.interactive()) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      (ev.target as HTMLElement).click();
    }
  }
}
