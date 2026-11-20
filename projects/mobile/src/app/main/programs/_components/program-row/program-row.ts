import { Component, computed, inject, input, output } from '@angular/core';
import { IonBadge, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { Program, ProgramSource, ProgramStatus } from 'core';

import { ClockService } from '../../../../_shared/services/clock.service';
import { programMeta, programRowTrailing, programTone } from '../../programs.config';

/**
 * One row of the library — a program or a routine, told apart by its spine
 * and by its meta line ("Routine · 6 exercises"), rather than by being in a
 * different list. A draft dims, because a draft is the one state you cannot
 * assign from.
 */
@Component({
  selector: 'mh-program-row',
  imports: [IonBadge, IonIcon, IonItem, IonLabel, IonNote, TranslatePipe],
  templateUrl: './program-row.html',
  styleUrl: './program-row.scss',
})
export class ProgramRow {
  private readonly _clockService = inject(ClockService);

  readonly program = input.required<Program>();

  readonly select = output<void>();

  readonly tone = computed(() => programTone(this.program()));

  readonly meta = computed(() => programMeta(this.program()));

  readonly isDraft = computed(() => this.program().status === ProgramStatus.Draft);

  /**
   * MotionHive's own starter content, which appears in everyone's library.
   * Badged, with a lock, because a coach opening their programs has no other
   * way to tell a starter from something they wrote, nor that it cannot be
   * changed in place.
   */
  readonly isStarter = computed(() => this.program().source === ProgramSource.System);

  /**
   * The right-hand note: how many of your clients follow it, or for a draft
   * when it was last edited. The counts ride on the list row itself.
   */
  readonly trailing = computed(() =>
    programRowTrailing(this.program(), this._clockService.now()),
  );
}
