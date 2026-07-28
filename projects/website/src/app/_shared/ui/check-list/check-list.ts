import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Hex } from 'core';

/**
 * Checklist with hexagon check bullets — the brand's replacement for round
 * ticks, used in hero guarantees, "what you can do" lists, and the pricing
 * plan. Items are passed as strings (caller builds them with `$localize` in
 * TS so translation stays clean). `tone` colors the bullet.
 *
 * The bullet is the shared `mh-hex` primitive (not a bespoke clip-path) so
 * every hexagon on the site comes from one component. A projected `✓` is used
 * rather than the built-in `check` icon because the icon renders browser-only
 * (its innerHTML SVG breaks the prerender DOM); the glyph is SSR-safe.
 */
@Component({
  selector: 'mh-check-list',
  imports: [Hex],
  template: `
    <ul class="checks" [class.checks--cols]="columns() > 1">
      @for (item of items(); track item) {
        <li>
          <mh-hex class="mk" [size]="20" [bg]="hexBg()" fg="#ffffff" orientation="pointy">✓</mh-hex>
          <span>{{ item }}</span>
        </li>
      }
    </ul>
  `,
  styleUrl: './check-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckList {
  readonly items = input.required<string[]>();
  readonly tone = input<'amber' | 'teal' | 'green'>('amber');
  /** 2 = wrap into a two-column grid on wider viewports. */
  readonly columns = input<1 | 2>(1);

  /** Bullet fill per tone (keeps the previous colors, now on the real hex). */
  readonly hexBg = computed(() => {
    switch (this.tone()) {
      case 'teal':
        return 'var(--color-accent-500, #14b8a6)';
      case 'green':
        return 'var(--p-green-500, #22c55e)';
      default:
        return 'var(--p-primary-500, #f59e0b)';
    }
  });
}
