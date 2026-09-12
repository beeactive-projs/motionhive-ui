import { Component, model, output } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';

export type CreateChoice = 'program' | 'routine' | 'starters';

/**
 * The one place anything gets created in the library.
 *
 * Three verbs behind a single button rather than three competing controls in
 * the header: they are the same intent at different sizes, and a starter is
 * the honest third answer for someone who does not want to author at all.
 */
@Component({
  selector: 'mh-create-sheet',
  imports: [IonIcon, IonItem, IonLabel, IonList, SheetShell],
  templateUrl: './create-sheet.html',
  styleUrl: './create-sheet.scss',
})
export class CreateSheet {
  readonly open = model(false);

  readonly choose = output<CreateChoice>();

  readonly options = [
    {
      id: 'program' as const,
      label: 'New program',
      hint: 'Multi-week, several days each',
      icon: 'albums-outline',
    },
    {
      id: 'routine' as const,
      label: 'New routine',
      hint: 'One session you repeat',
      icon: 'repeat-outline',
    },
    {
      id: 'starters' as const,
      label: 'Browse starters',
      hint: "Start from one of ours",
      icon: 'flash-outline',
    },
  ];

  pick(id: CreateChoice): void {
    this.open.set(false);
    this.choose.emit(id);
  }
}
