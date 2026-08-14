import { Component } from '@angular/core';

/**
 * The MotionHive hex mark.
 *
 * Inlined rather than loaded from `assets/`: it is the only image the shell
 * renders, and an inline SVG both avoids a request and lets the fill follow
 * the palette. Core's `mh-logo` is a web component (Tailwind + two asset
 * files) and is off-limits here, so the artwork is duplicated deliberately.
 */
@Component({
  selector: 'mh-logo',
  imports: [],
  templateUrl: './logo.html',
  styleUrl: './logo.scss',
})
export class Logo {}
