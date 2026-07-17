import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Checklist with hexagon check bullets — the brand's replacement for round
 * ticks, used in hero guarantees, "what you can do" lists, and the pricing
 * plan. Items are passed as strings (caller builds them with `$localize` in
 * TS so translation stays clean). Tone colors the bullet.
 */
@Component({
  selector: 'mh-check-list',
  template: `
    <ul class="checks" [class]="'checks--' + tone()" [class.checks--cols]="columns() > 1">
      @for (item of items(); track item) {
        <li>
          <span class="mk" aria-hidden="true">✓</span>
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
}
