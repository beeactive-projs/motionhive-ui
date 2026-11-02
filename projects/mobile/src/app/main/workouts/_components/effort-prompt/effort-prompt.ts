import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { EFFORT_CHOICES } from '../../logger/logger-flow';

/**
 * "How hard?" right under a set just ticked: one tap from 6 to 10, or Skip.
 * Off by default; it shows where the person switched it on, or by itself
 * where the plan sets a target effort, which it then names. It gets out of
 * the way on its own after a few seconds or at any other tap (the logger
 * owns that timing).
 */
@Component({
  selector: 'mh-effort-prompt',
  imports: [TranslatePipe],
  templateUrl: './effort-prompt.html',
  styleUrl: './effort-prompt.scss',
})
export class EffortPrompt {
  /** The plan's target effort, if it has one. */
  readonly target = input<number | null>(null);

  readonly picked = output<number>();
  readonly skip = output<void>();

  readonly choices = EFFORT_CHOICES;
}
