import { Component, computed, effect, input, model, output, signal, untracked } from '@angular/core';
import {
  InfiniteScrollCustomEvent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { checkmark } from 'ionicons/icons';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';

export interface ChoiceOption {
  value: string;
  /** Already translated. */
  label: string;
  /** One line under the label saying what picking it means. Already translated. */
  hint?: string;
}

/** Rows drawn per page of a long list; scrolling draws the next page, as the exercise picker does. */
export const CHOICE_PAGE_SIZE = 40;

/** Case and accents fold away, so "sao" finds "São Paulo". */
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * The options `query` matches. With nothing typed, `pinned` (the current
 * choice) moves to the top: in a list of 400 time zones it is otherwise a
 * long scroll away from the one row you came to check.
 */
export function matchChoices(
  options: readonly ChoiceOption[],
  query: string,
  pinned: string | null,
): ChoiceOption[] {
  const term = foldForSearch(query.trim());
  if (term) return options.filter((option) => foldForSearch(option.label).includes(term));
  const current = options.find((option) => option.value === pinned);
  return current ? [current, ...options.filter((option) => option !== current)] : [...options];
}

/**
 * Pick one value from a list: appearance, language, time zone, who sees a
 * detail. A tap applies and closes, the way a phone's own settings do, so
 * there is no Save.
 *
 * Give it a `searchPlaceholder` and it grows a search field and draws the
 * list in pages; without one it is a short list in its original order.
 */
@Component({
  selector: 'mh-choice-sheet',
  imports: [
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './choice-sheet.html',
  styleUrl: './choice-sheet.scss',
})
export class ChoiceSheet {
  readonly open = model(false);
  readonly title = input.required<string>();
  readonly options = input.required<readonly ChoiceOption[]>();
  readonly selected = input<string | null>(null);
  /** Translated. Set it for a list long enough to need a search field. */
  readonly searchPlaceholder = input('');
  /** Translated line under the list: what the choice changes. */
  readonly footnote = input('');

  /** Only fires for a value other than the current one. */
  readonly picked = output<string>();

  readonly query = signal('');
  private readonly _shown = signal(CHOICE_PAGE_SIZE);

  readonly searchable = computed(() => this.searchPlaceholder() !== '');
  readonly matches = computed(() =>
    matchChoices(this.options(), this.query(), this.searchable() ? this.selected() : null),
  );
  readonly rows = computed(() => this.matches().slice(0, this._shown()));
  readonly hasMore = computed(() => this.rows().length < this.matches().length);
  readonly breakpoints = computed(() => (this.searchable() ? [0, 0.9] : [0, 0.5]));
  readonly initialBreakpoint = computed(() => (this.searchable() ? 0.9 : 0.5));

  constructor() {
    addIcons({ checkmark });

    // Every opening starts at the top with an empty search.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.query.set('');
        this._shown.set(CHOICE_PAGE_SIZE);
      });
    });
  }

  onQuery(value: string): void {
    this.query.set(value);
    this._shown.set(CHOICE_PAGE_SIZE);
  }

  loadMore(event: InfiniteScrollCustomEvent): void {
    this._shown.update((shown) => shown + CHOICE_PAGE_SIZE);
    void event.target.complete();
  }

  pick(value: string): void {
    this.open.set(false);
    if (value !== this.selected()) this.picked.emit(value);
  }
}
