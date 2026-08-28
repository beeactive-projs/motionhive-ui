import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/standalone';

/**
 * The MotionHive hex mark as the tab-root header's leading action — it goes
 * home, the way a wordmark does on the web.
 *
 * The button is part of the component rather than wrapped at each call site:
 * the mark is only ever rendered in that header, and the three headers would
 * otherwise repeat the same three lines. Geometry comes from the shared
 * `ion-button.glyph` skin, so it presses as the same circle as the bell and
 * the avatar at the other end of the bar.
 *
 * Inlined rather than loaded from `assets/`: it is the only image the shell
 * renders, and an inline SVG both avoids a request and lets the fill follow
 * the palette. Core's `mh-logo` is a web component (Tailwind + two asset
 * files) and is off-limits here, so the artwork is duplicated deliberately.
 */
@Component({
  selector: 'mh-logo',
  imports: [IonButton, RouterLink],
  templateUrl: './logo.html',
  styleUrl: './logo.scss',
})
export class Logo {}
