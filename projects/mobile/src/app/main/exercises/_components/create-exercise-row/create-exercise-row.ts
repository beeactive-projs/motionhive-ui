import { Component, input, output } from '@angular/core';
import { IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';

/**
 * "Can't find it? Create it", with the words already typed: wherever a
 * search for an exercise comes up empty of that exact name (the picker, the
 * library). A dashed card on the honey wash, not one more row of the list:
 * it is not an exercise yet, it is the way to one.
 */
@Component({
  selector: 'mh-create-exercise-row',
  imports: [HexAvatar, IonItem, IonLabel, IonList, TranslatePipe],
  template: `
    <ion-list [inset]="true" class="mh-card-list create">
      <ion-item button detail="false" (click)="create.emit()">
        <mh-hex-avatar slot="start" size="md" icon="add-outline" color="primary" aria-hidden="true" />
        <ion-label class="ion-text-wrap">
          <h2>{{ 'exercises.picker.create.title' | translate }}</h2>
          <p>{{ 'exercises.picker.create.hint' | translate: { query: query() } }}</p>
        </ion-label>
      </ion-item>
    </ion-list>
  `,
  styles: `
    :host {
      display: block;
    }

    .create {
      border: 1px dashed var(--ion-color-primary);
    }

    .create ion-item {
      --background: var(--ion-color-primary-wash);
    }

    .create ion-label p {
      color: var(--mh-color-honey-deep);
    }

    mh-hex-avatar {
      margin-inline-end: 0.875rem;
    }
  `,
})
export class CreateExerciseRow {
  /** The search as typed; quoted on the row, and the form starts from it. */
  readonly query = input.required<string>();
  readonly create = output<void>();
}
