import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Stat block — big amber number + label. Used on the homepage "free" band and
 * the pricing page. `onDark` tunes the label color for dark bands.
 */
@Component({
  selector: 'mh-stat',
  template: `
    <div class="stat" [class.stat--dark]="onDark()">
      <span class="stat__v">{{ value() }}</span>
      <span class="stat__l">{{ label() }}</span>
    </div>
  `,
  styleUrl: './stat.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stat {
  readonly value = input.required<string>();
  readonly label = input.required<string>();
  readonly onDark = input(false);
}
