import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonIcon, IonItem, IonLabel } from '@ionic/angular/standalone';

import { Program, dayDividerLabel, localDayKey } from 'core';

import { programMeta, programTone } from '../../programs.config';

/**
 * One row of the library — a program or a routine, told apart by its spine
 * rather than by being in a different list. A draft dims, because a draft is
 * the one state you cannot assign from.
 */
@Component({
  selector: 'mh-program-row',
  imports: [IonBadge, IonIcon, IonItem, IonLabel],
  templateUrl: './program-row.html',
  styleUrl: './program-row.scss',
})
export class ProgramRow {
  readonly program = input.required<Program>();
  /** Clients currently on it. Null while unknown, which is not the same as 0. */
  readonly clientCount = input<number | null>(null);

  readonly select = output<void>();

  readonly tone = computed(() => programTone(this.program()));

  readonly meta = computed(() => programMeta(this.program()));

  readonly isDraft = computed(() => this.program().status === 'DRAFT');

  readonly isRoutine = computed(() => this.program().isSingleWorkout);

  /**
   * The right-hand block: who is on it for a coach, or when it was last
   * touched. A count of zero is worth saying — "nobody is on this yet" is
   * information; an unknown count is not, so it stays silent.
   */
  readonly trailing = computed(() => {
    const count = this.clientCount();
    if (count !== null) {
      return count === 0 ? 'No clients' : `${count} ${count === 1 ? 'client' : 'clients'}`;
    }
    const at = this.program().updatedAt;
    return at ? dayDividerLabel(localDayKey(new Date(at))) : '';
  });
}
