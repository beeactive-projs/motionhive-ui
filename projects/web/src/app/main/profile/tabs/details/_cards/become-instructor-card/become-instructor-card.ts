import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { BecomeInstructor } from '../../../../../user/_dialogs/become-instructor/become-instructor';

/**
 * CTA card mounted instead of the coaching card when the user hasn't
 * activated an instructor profile yet. Owns its own
 * `mh-become-instructor` dialog instance.
 */
@Component({
  selector: 'mh-become-instructor-card',
  imports: [Card, Divider, Button, AvatarModule, BecomeInstructor],
  templateUrl: './become-instructor-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BecomeInstructorCard {
  readonly visible = signal(false);
}
