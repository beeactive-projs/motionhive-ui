import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { IonButton, IonIcon, IonInput, IonItem, IonList } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline } from 'ionicons/icons';

import { translate } from 'core';

import { ChipNotices, addChips, canAddChip, splitChipText } from './chip-input.config';
import type { ChipAddResult, ChipNotice } from './chip-input.config';

/** The line under the chips: a translation key and its values. */
interface ChipNoticeLine {
  key: string;
  params: Record<string, string | number>;
  /** The entry has to change before it can go in (too long). */
  over: boolean;
}

/**
 * A field whose entries become chips: type a word, tap + (or the return
 * key), and it joins the chips under the field. The field clears and keeps
 * its focus, so the keyboard stays up for the next one. A pasted
 * "boxing, tennis" is two chips. Each chip is its own remove button (the
 * whole chip, as group tags have it). An entry is added once, blind to case
 * and accents; one that only repeats an `exclude` name is left out and
 * reported through `excluded`; the per entry length and the cap hold, and the
 * line under the chips says when one of them stopped an entry.
 *
 * The chips are the page's (`[(values)]`), so they outlive the field: a step
 * left and come back to still has them. With `mhKeyboardFooter` on the page,
 * the field and its chips are kept in view above the keyboard together.
 */
@Component({
  selector: 'mh-chip-input',
  imports: [IonButton, IonIcon, IonInput, IonItem, IonList, TranslatePipe],
  templateUrl: './chip-input.html',
  styleUrl: './chip-input.scss',
  // `mhKeyboardFooter` keeps the whole block (field and chips) in view.
  host: { 'data-mh-keyboard-block': '' },
})
export class ChipInput {
  private readonly _translateService = inject(TranslateService);
  private readonly _injector = inject(Injector);

  /** The chips, in the order they were added. */
  readonly values = model<string[]>([]);
  /** The field's name, shown over it. */
  readonly label = input.required<string>();
  readonly placeholder = input('');
  /** The + button's name for a screen reader. */
  readonly addLabel = input(translate('button.add'));
  /** Translation key naming one chip's remove button, with `{name}`. */
  readonly removeLabel = input('a11y.removeItem');
  /** The chips' group name for a screen reader; the field's label when not given. */
  readonly listLabel = input<string | null>(null);
  /** How many chips there may be in all. */
  readonly max = input.required<number>();
  /** The longest one entry may be. */
  readonly maxLength = input.required<number>();
  /** Names an entry may not repeat, compared blind to case and accents. */
  readonly exclude = input<readonly string[]>([]);
  /** Translation key with `{value}`, said when an entry only repeated an excluded name. */
  readonly excludedNote = input('chipInput.excluded');
  readonly autocapitalize = input('sentences');

  /** The excluded names that were typed, as `exclude` spells them: the page may pick them where they live. */
  readonly excluded = output<string[]>();

  /** What is typed and not yet a chip. */
  readonly draft = signal('');
  private readonly _lastNotice = signal<ChipNoticeLine | null>(null);
  /** Said to a screen reader: what the last tap added or removed. */
  readonly announcement = signal('');

  private readonly _field = viewChild(IonInput);
  private readonly _fieldHost = viewChild(IonInput, { read: ElementRef<HTMLElement> });
  private readonly _chips = viewChildren('chip', { read: ElementRef<HTMLElement> });
  /** The field held focus when the + or a chip was pressed. */
  private _focusAtPress = false;

  readonly canAdd = computed(() => canAddChip(this.draft(), this.values().length, this.max()));

  /** Long enough for a short pasted list; each entry is held to `maxLength` on add. */
  readonly fieldMaxLength = computed(() => this.maxLength() * 4);

  readonly chipsLabel = computed(() => {
    const name = this.listLabel();
    if (name) {
      return name;
    }
    return this.label();
  });

  /** The last add's word, or, at the cap, how to make room. */
  readonly notice = computed<ChipNoticeLine | null>(() => {
    const last = this._lastNotice();
    if (last) {
      return last;
    }
    if (this.values().length >= this.max()) {
      return { key: 'chipInput.full', params: { max: this.max() }, over: false };
    }
    return null;
  });

  constructor() {
    addIcons({ addOutline, closeOutline });
  }

  onInput(value: string | null | undefined): void {
    this.draft.set(value ?? '');
    // What it said was about the text that was there.
    this._lastNotice.set(null);
  }

  onEnter(event: Event): void {
    // Return mid composition (an IME choosing a word) is not an add.
    if ((event as KeyboardEvent).isComposing) {
      return;
    }
    event.preventDefault();
    this._focusAtPress = this._hasFocus();
    this.add();
  }

  /**
   * Keep the caret in the field: focus moves on the press, not the click, so
   * cancelling the press keeps the keyboard up while the click still acts.
   */
  keepFocus(event: Event): void {
    this._focusAtPress = this._hasFocus();
    event.preventDefault();
  }

  add(): void {
    if (!this.canAdd()) {
      return;
    }
    this._apply(
      addChips(this.values(), this.draft(), {
        max: this.max(),
        maxLength: this.maxLength(),
        exclude: this.exclude(),
      }),
    );
    // A webview that moved focus anyway gets it back while still inside the
    // tap, the only moment iOS lets a script raise the keyboard.
    if (this._focusAtPress && !this._hasFocus()) {
      void this._field()?.setFocus();
    }
  }

  /**
   * Add what is still typed, for a page about to save: true when the field is
   * empty after, false when something stays to be fixed (the line says what).
   */
  commit(): boolean {
    if (splitChipText(this.draft()).length === 0) {
      this.draft.set('');
      return true;
    }
    if (this.canAdd()) {
      this._focusAtPress = false;
      this.add();
    } else {
      this._lastNotice.set(this._line(ChipNotices.Full, []));
    }
    return this.draft() === '';
  }

  remove(value: string, index: number): void {
    const chips = this._chips();
    const chip = chips[index];
    const focusWasOnChip = !!chip && chip.nativeElement.contains(document.activeElement);
    this.values.update((list) => list.filter((entry) => entry !== value));
    this._lastNotice.set(null);
    this.announcement.set(this._translateService.instant('chipInput.removed', { value }));
    if (!focusWasOnChip) {
      return;
    }
    // A screen reader or keyboard on the chip: focus goes to the chip that
    // took its place, rather than to the top of the page.
    afterNextRender(
      () => {
        const left = this._chips();
        const next = left[Math.min(index, left.length - 1)];
        if (next) {
          next.nativeElement.focus();
        }
      },
      { injector: this._injector },
    );
  }

  private _apply(result: ChipAddResult): void {
    if (result.added.length > 0) {
      this.values.set(result.values);
      this.announcement.set(
        this._translateService.instant('chipInput.added', { value: result.added.join(', ') }),
      );
    }
    this.draft.set(result.rest);
    if (result.excluded.length > 0) {
      this.excluded.emit(result.excluded);
    }
    let values: string[] = [];
    if (result.notice === ChipNotices.Excluded) {
      values = result.excluded;
    } else if (result.notice === ChipNotices.Duplicate) {
      values = result.duplicates;
    }
    if (result.notice) {
      this._lastNotice.set(this._line(result.notice, values));
    } else {
      this._lastNotice.set(null);
    }
  }

  private _line(notice: ChipNotice, values: readonly string[]): ChipNoticeLine {
    const value = values.join(', ');
    switch (notice) {
      case ChipNotices.Full:
        return { key: 'chipInput.full', params: { max: this.max() }, over: false };
      case ChipNotices.TooLong:
        return { key: 'chipInput.tooLong', params: { max: this.maxLength() }, over: true };
      case ChipNotices.Excluded:
        return { key: this.excludedNote(), params: { value }, over: false };
      case ChipNotices.Duplicate:
        return { key: 'chipInput.duplicate', params: { value }, over: false };
    }
  }

  private _hasFocus(): boolean {
    const host = this._fieldHost();
    const active = document.activeElement;
    if (!host || !active) {
      return false;
    }
    return host.nativeElement.contains(active);
  }
}
