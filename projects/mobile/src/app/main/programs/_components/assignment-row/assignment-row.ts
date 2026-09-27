import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonButton, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';

import { ProgramAssignment, ProgramAssignmentStatus, displayName } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { assignmentChip, assignmentSubline, assignmentTone } from '../../programs.config';

/**
 * One client on a program: their avatar and name, a chip for any state that
 * is not the ordinary one, and the line that says where they are in it.
 *
 * The spine is keyed to the assignment's state — honey waiting, emerald
 * under way, muted paused, teal finished, red cancelled — and the one verb
 * the state allows sits at the end of the row.
 */
@Component({
  selector: 'mh-assignment-row',
  imports: [HexAvatar, IonBadge, IonButton, IonItem, IonLabel, IonNote],
  templateUrl: './assignment-row.html',
  styleUrl: './assignment-row.scss',
})
export class AssignmentRow {
  readonly assignment = input.required<ProgramAssignment>();
  /** True while this row's status change is in flight. */
  readonly busy = input(false);

  readonly pause = output<void>();
  readonly resume = output<void>();

  readonly name = computed(() => displayName(this.assignment().client ?? null, 'Client'));

  readonly avatarTone = computed(() => avatarToneFor(this.assignment().clientId));

  readonly tone = computed(() => assignmentTone(this.assignment().status));

  readonly chip = computed(() => assignmentChip(this.assignment().status));

  readonly subline = computed(() => assignmentSubline(this.assignment()));

  readonly canPause = computed(
    () => this.assignment().status === ProgramAssignmentStatus.Active,
  );

  readonly canResume = computed(
    () => this.assignment().status === ProgramAssignmentStatus.Paused,
  );
}
