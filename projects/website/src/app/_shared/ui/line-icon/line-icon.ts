import { Component, input } from '@angular/core';

export type LineIconName =
  | 'calendar'
  | 'program'
  | 'dumbbell'
  | 'card'
  | 'people'
  | 'globe'
  | 'moon'
  | 'close'
  | 'chevron-down';

/**
 * Stroke icons from the marketing design system (24px grid, 1.8 stroke,
 * `currentColor`). Plain template SVG, so they render in the prerendered HTML
 * too. Size with `width` / `height` (or `font-size`, default 1em).
 */
@Component({
  selector: 'mh-line-icon',
  templateUrl: './line-icon.html',
  styleUrl: './line-icon.scss',
  host: { 'aria-hidden': 'true' },
})
export class LineIcon {
  readonly name = input.required<LineIconName>();
}
