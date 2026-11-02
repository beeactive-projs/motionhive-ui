import { Component, computed, effect, input, model, output, signal, untracked } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList, IonTextarea } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { checkmarkOutline, createOutline, trashOutline } from 'ionicons/icons';

import { ExerciseSetType, LoggedSet, enumLabel, translate } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { BadgeTone, BadgeTones, SetBadge } from '../../logger/logger-flow';

/** A type the menu offers, as drawn. */
interface TypeChoice {
  type: ExerciseSetType;
  badge: string;
  tone: BadgeTone;
  label: string;
  hint: string;
}

/** The longest note one set takes here; the API allows more, a set needs less. */
export const SET_NOTE_MAX_LENGTH = 280;

/** What the menu offers, in order. The rarer coach types show only when a set already is one. */
const OFFERED: readonly ExerciseSetType[] = [
  ExerciseSetType.Normal,
  ExerciseSetType.Warmup,
  ExerciseSetType.Dropset,
  ExerciseSetType.Failure,
  ExerciseSetType.Amrap,
];

/** The types whose menu row says what they change. */
const HINTED = new Set<ExerciseSetType>([
  ExerciseSetType.Warmup,
  ExerciseSetType.Dropset,
  ExerciseSetType.Amrap,
]);

const TONES: Partial<Record<ExerciseSetType, BadgeTone>> = {
  [ExerciseSetType.Warmup]: BadgeTones.Warmup,
  [ExerciseSetType.Dropset]: BadgeTones.Drop,
  [ExerciseSetType.Failure]: BadgeTones.Failure,
  [ExerciseSetType.Amrap]: BadgeTones.Amrap,
};

/**
 * Tap a set's badge: what kind of set it is, a note on it, or take it out.
 *
 * Picking a type applies it and closes, the common case in one tap. The note
 * opens in the same sheet with its own Save. Warm-ups say up front that they
 * don't count, so nobody wonders where their volume went.
 */
@Component({
  selector: 'mh-set-menu-sheet',
  imports: [IonIcon, IonItem, IonLabel, IonList, IonTextarea, SheetShell, TranslatePipe],
  templateUrl: './set-menu-sheet.html',
  styleUrl: './set-menu-sheet.scss',
})
export class SetMenuSheet {
  readonly open = model(false);
  readonly set = input<LoggedSet | null>(null);
  readonly badge = input<SetBadge | null>(null);

  readonly typeChange = output<ExerciseSetType>();
  readonly noteChange = output<string | null>();
  readonly remove = output<void>();

  /** The menu, or the note being written. */
  readonly writing = signal(false);
  readonly note = signal('');
  readonly noteMax = SET_NOTE_MAX_LENGTH;

  readonly current = computed(() => {
    const type = this.set()?.setType ?? ExerciseSetType.Normal;
    // A working set is a plain one as far as this menu is concerned.
    return type === ExerciseSetType.Working ? ExerciseSetType.Normal : type;
  });

  readonly choices = computed<TypeChoice[]>(() => {
    const current = this.current();
    const types = OFFERED.includes(current) ? OFFERED : [...OFFERED, current];
    return types.map((type) => ({
      type,
      badge: type === ExerciseSetType.Normal ? '1' : translate(`workouts.setBadge.${type}`),
      tone: TONES[type] ?? (type === ExerciseSetType.Normal ? BadgeTones.Plain : BadgeTones.Other),
      label: enumLabel('exerciseSetType', type),
      hint: HINTED.has(type) ? translate(`workouts.setMenu.hints.${type}`) : '',
    }));
  });

  readonly title = computed(() => this.badge()?.name ?? '');
  readonly hasNote = computed(() => !!this.set()?.notes?.trim());

  constructor() {
    addIcons({ checkmarkOutline, createOutline, trashOutline });
    // Each opening starts on the menu, with the note as the set holds it.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.writing.set(false);
        this.note.set(this.set()?.notes ?? '');
      });
    });
  }

  pick(type: ExerciseSetType): void {
    if (type !== this.current()) this.typeChange.emit(type);
    this.open.set(false);
  }

  startNote(): void {
    this.writing.set(true);
  }

  saveNote(): void {
    const text = this.note().trim();
    if (text !== (this.set()?.notes ?? '').trim()) this.noteChange.emit(text || null);
    this.open.set(false);
  }

  removeSet(): void {
    this.remove.emit();
    this.open.set(false);
  }
}
