import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { PostWorkout } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { workoutSummaryLine } from '../../../../_shared/utils/workout-summary';
import { groupLinks } from '../../../../_shared/utils/stack-paths';

/**
 * A finished workout shared into a group, as its safe summary: no note, no
 * weights, no photo. A link to the workout on the author's profile only
 * when it is Public there; otherwise the profile would not show it, and
 * the card is not a way round that.
 */
@Component({
  selector: 'mh-post-workout',
  imports: [HexAvatar, IonIcon, NgTemplateOutlet, TranslatePipe],
  templateUrl: './post-workout.html',
  styleUrl: './post-workout.scss',
})
export class PostWorkoutCard {
  private readonly _router = inject(Router);

  readonly workout = input.required<PostWorkout>();
  /** The author's handle; without one there is no profile to open. */
  readonly handle = input<string | null | undefined>(null);

  readonly summary = computed(() => workoutSummaryLine(this.workout()));
  readonly linked = computed(() => this.workout().onProfile && !!this.handle());

  open(): void {
    const handle = this.handle();
    if (this.linked() && handle) {
      void this._router.navigate(
        groupLinks(this._router.url).person(handle, 'workout', this.workout().id),
      );
    }
  }
}
