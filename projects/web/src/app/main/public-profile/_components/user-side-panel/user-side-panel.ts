import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Card } from 'primeng/card';
import { Button } from 'primeng/button';
import { countryNameFromCode } from 'core';
import type { PublicUserProfile, ViewerMode } from 'core';
import { ViewerMode as ViewerModes } from 'core';

/**
 * Side rail for the user-mode public profile.
 *
 * Kept distinct from `ProfileSideRail` because the instructor rail owns
 * a pricing card driven by `PublicProfileStore.offerings`, which has no
 * meaning for a user-mode profile. Shared visuals (card layout, label
 * styles) live in the SCSS; sharing the component would force every
 * field into an optional input and add branching everywhere.
 *
 * Shown on `≥lg`; below that, content is inlined into the long-scroll
 * layout. There's no mobile sticky CTA bar for user-mode yet — no
 * follow/message backend wired, and the design's pulse pill is
 * deferred until the "looking for training partners" signal exists.
 */
@Component({
  selector: 'mh-user-side-panel',
  imports: [DatePipe, Card, Button],
  templateUrl: './user-side-panel.html',
  styleUrl: './user-side-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserSidePanel {
  readonly profile = input.required<PublicUserProfile>();
  readonly viewerMode = input.required<ViewerMode>();

  readonly share = output<void>();
  readonly message = output<void>();

  protected readonly Modes = ViewerModes;

  readonly isOwner = computed(() => this.viewerMode() === ViewerModes.Owner);

  readonly locationLabel = computed(() => {
    const p = this.profile();
    return [p.city, countryNameFromCode(p.countryCode)].filter(Boolean).join(', ');
  });
}
