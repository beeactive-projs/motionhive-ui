import { Component, computed, input } from '@angular/core';

import { Hex } from '../hex/hex';

/** A check list's bullet colour. */
export type CheckListTone = 'amber' | 'teal' | 'green';

/** Bullet fill per tone. */
const HEX_BG_BY_TONE: Record<CheckListTone, string> = {
  amber: 'var(--p-primary-500, #f59e0b)',
  teal: 'var(--color-accent-500, #14b8a6)',
  green: 'var(--p-green-500, #22c55e)',
};

/**
 * Checklist with hexagon check bullets — the brand's replacement for round
 * ticks, used in hero guarantees, "what you can do" lists and the pricing
 * plan, on the marketing site and the web app's guest pages. Items come in as
 * translated strings (the website builds them with `$localize`, the web app
 * with `TranslateService.instant`), so the component holds no text.
 *
 * The bullet is the shared `mh-hex` primitive. A projected `✓` is used rather
 * than the built-in `check` icon because the icon renders browser-only (its
 * innerHTML SVG breaks the prerender DOM); the glyph is SSR-safe.
 */
@Component({
  selector: 'mh-check-list',
  imports: [Hex],
  templateUrl: './check-list.html',
  styleUrl: './check-list.scss',
})
export class CheckList {
  readonly items = input.required<string[]>();
  readonly tone = input<CheckListTone>('amber');
  /** 2 = wrap into a two-column grid on wider viewports. */
  readonly columns = input<1 | 2>(1);

  protected readonly hexBg = computed(() => HEX_BG_BY_TONE[this.tone()]);
}
