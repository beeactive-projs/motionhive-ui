import { Component, computed, inject, input, output } from '@angular/core';
import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ProgramAssignment, ProgramAssignmentStatus, displayName } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { assignmentChip, assignmentSubline, assignmentTone } from '../../programs.config';
import { canChangePlan } from '../../_sheets/end-plan-sheet/end-plan.config';
import { addIcons } from 'ionicons';
import { barbellOutline, ellipsisHorizontalOutline } from 'ionicons/icons';

/** Who the row is about: the client (on a program) or the plan (on a client). */
export const AssignmentRowSubjects = {
  Client: 'client',
  Program: 'program',
} as const;
export type AssignmentRowSubject =
  (typeof AssignmentRowSubjects)[keyof typeof AssignmentRowSubjects];

/**
 * One assignment: on a program it names the client, on a client's page it
 * names the plan. A chip for any state that is not the ordinary one, and the
 * line that says where they are in it.
 *
 * The spine is keyed to the assignment's state — honey waiting, emerald
 * under way, muted paused, teal finished, red cancelled. A paused row keeps
 * Resume as its one direct verb; any plan still open has a ⋯ that opens the
 * sheet to pause, finish or cancel it (`EndPlanSheet`), since each of those
 * tells the client and may carry a message.
 */
@Component({
  selector: 'mh-assignment-row',
  imports: [HexAvatar, IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote, TranslatePipe],
  templateUrl: './assignment-row.html',
  styleUrl: './assignment-row.scss',
})
export class AssignmentRow {
  private readonly _translateService = inject(TranslateService);

  readonly assignment = input.required<ProgramAssignment>();
  /** True while this row's status change is in flight. */
  readonly busy = input(false);
  readonly subject = input<AssignmentRowSubject>(AssignmentRowSubjects.Client);
  /** The whole row opens something; the verb at the end still only does its own job. */
  readonly tappable = input(false);

  /** The ⋯: open the sheet that pauses, finishes or cancels the plan. */
  readonly options = output<void>();
  readonly resume = output<void>();
  readonly select = output<void>();

  readonly Subjects = AssignmentRowSubjects;

  readonly name = computed(() =>
    this.subject() === AssignmentRowSubjects.Program
      ? this.assignment().programNameSnapshot
      : displayName(
          this.assignment().client ?? null,
          this._translateService.instant('programs.common.clientFallback'),
        ),
  );

  readonly avatarTone = computed(() => avatarToneFor(this.assignment().clientId));

  readonly tone = computed(() => assignmentTone(this.assignment().status));

  readonly chip = computed(() => assignmentChip(this.assignment().status));

  readonly subline = computed(() => assignmentSubline(this.assignment()));

  /** Still open, so it can be paused, finished or cancelled. */
  readonly canChange = computed(() => canChangePlan(this.assignment().status));

  /** "Options for Anna", or for the plan when the row names the plan. */
  readonly optionsLabel = computed(() =>
    this._translateService.instant('programs.endPlan.options', { name: this.name() }),
  );

  readonly canResume = computed(
    () => this.assignment().status === ProgramAssignmentStatus.Paused,
  );

  constructor() {
    // Its own glyphs: the row sits on pages that register others.
    addIcons({ barbellOutline, ellipsisHorizontalOutline });
  }

  onRowClick(): void {
    if (this.tappable()) this.select.emit();
  }
}
