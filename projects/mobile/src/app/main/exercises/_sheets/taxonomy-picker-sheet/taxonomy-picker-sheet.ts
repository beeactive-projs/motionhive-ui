import { Component, computed, effect, input, model, output, signal } from '@angular/core';
import {
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
} from '@ionic/angular/standalone';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { SearchbarAutofocusDirective } from '../../../../_shared/directives/searchbar-autofocus.directive';
import { toggleValue } from '../../../../_shared/utils/list.utils';
import { TaxonomyOption, selectionCounter } from '../../exercises.config';

/**
 * Pick rows out of a taxonomy — the primary/secondary/stabilizer muscles and
 * the equipment list all go through here.
 *
 * One sheet for four pickers because the differences are a title, a cap and
 * a list: four near-identical components would drift, and the muscle cap is
 * the only real behaviour in any of them.
 *
 * The cap is enforced by making the unpicked rows inert once it is reached,
 * not by refusing a tap with an error. Three primary muscles is a modelling
 * limit, not a mistake the coach made, and a row that visibly cannot be
 * pressed says so before the tap rather than after it.
 */
@Component({
  selector: 'mh-taxonomy-picker-sheet',
  imports: [
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    SearchbarAutofocusDirective,
    SheetShell,
  ],
  templateUrl: './taxonomy-picker-sheet.html',
  styleUrl: './taxonomy-picker-sheet.scss',
})
export class TaxonomyPickerSheet {
  readonly open = model(false);
  readonly title = input.required<string>();
  readonly options = input.required<readonly TaxonomyOption[]>();
  readonly selectedIds = input<readonly string[]>([]);
  /** Null for the uncapped lists (secondary, stabilizers, equipment). */
  readonly max = input<number | null>(null);
  readonly searchPlaceholder = input('Search');
  /** Shown under the search field — why the cap exists, where there is one. */
  readonly hint = input('');

  readonly picked = output<string[]>();

  readonly draft = signal<string[]>([]);
  readonly query = signal('');

  readonly counter = computed(() => selectionCounter(this.draft().length, this.max()));

  readonly atCap = computed(() => {
    const max = this.max();
    return max !== null && this.draft().length >= max;
  });

  readonly visibleOptions = computed(() => {
    const term = this.query().trim().toLowerCase();
    const options = this.options();
    if (!term) return options;
    return options.filter((option) => option.label.toLowerCase().includes(term));
  });

  readonly isEmpty = computed(() => this.visibleOptions().length === 0);

  constructor() {
    // Seed on open so a dismissed edit is discarded, not carried forward.
    effect(() => {
      if (!this.open()) return;
      this.draft.set([...this.selectedIds()]);
      this.query.set('');
    });
  }

  isOn(id: string): boolean {
    return this.draft().includes(id);
  }

  /** At the cap, only the rows already picked stay live — so you can swap one out. */
  isDisabled(id: string): boolean {
    return this.atCap() && !this.isOn(id);
  }

  toggle(id: string): void {
    if (this.isDisabled(id)) return;
    this.draft.update((ids) => toggleValue(ids, id));
  }

  onQuery(value: string): void {
    this.query.set(value);
  }

  done(): void {
    this.picked.emit([...this.draft()]);
    this.open.set(false);
  }
}
