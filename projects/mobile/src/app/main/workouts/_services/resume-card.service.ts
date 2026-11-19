import { Service, signal } from '@angular/core';

/**
 * Whether the Workouts page is showing the resume card. The mini-bar steps
 * aside while it does (user decision, 2026-11-19): the card already says
 * what the bar would, a card apart. The page writes it; the tab shell reads
 * it only while that page is the one on screen (by its URL), because Ionic
 * keeps the page alive, card and all, behind the pages opened over it.
 */
@Service()
export class ResumeCardService {
  private readonly _shown = signal(false);

  readonly shown = this._shown.asReadonly();

  set(shown: boolean): void {
    this._shown.set(shown);
  }
}
