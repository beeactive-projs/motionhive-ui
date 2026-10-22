import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonRadio,
  IonRadioGroup,
  IonTextarea,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Program } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { ProgramDetailsChange } from '../../program-builder/program-builder.store';
import { DEFAULT_PROGRAM_WEEKS, MAX_PROGRAM_WEEKS, weeksOf } from '../../programs.config';

/** What a longer program puts in the weeks it gains. */
type NewWeeksChoice = 'repeat' | 'empty';

/**
 * A program's own fields (name, description, length), opened from Edit
 * details on the builder's ⋯. Its days stay on the builder, where they are
 * read and changed.
 *
 * Seeded on open, so a dismissed edit is discarded. It emits the change and
 * stays open until the page's save lands, so a failed save keeps the edit on
 * screen rather than losing it.
 */
@Component({
  selector: 'mh-program-details-sheet',
  imports: [
    IonButton,
    IonIcon,
    IonInput,
    IonItem,
    IonList,
    IonRadio,
    IonRadioGroup,
    IonTextarea,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './program-details-sheet.html',
  styleUrl: './program-details-sheet.scss',
})
export class ProgramDetailsSheet {
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly program = input<Program | null>(null);
  readonly saving = input(false);

  readonly save = output<ProgramDetailsChange>();

  readonly name = signal('');
  readonly description = signal('');
  /** Authored in weeks; stored as days. */
  readonly weeks = signal(DEFAULT_PROGRAM_WEEKS);
  /** The length when the sheet opened, so lengthening can be told from any other save. */
  private readonly _savedWeeks = signal(DEFAULT_PROGRAM_WEEKS);
  /** The coach's answer for the empty weeks; nothing until they pick. */
  readonly newWeeksChoice = signal<NewWeeksChoice | null>(null);
  /** Set when a save was tried without an answer, so the question says why. */
  readonly newWeeksMissing = signal(false);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const program = untracked(() => this.program());
      if (!program) return;
      const weeks = weeksOf(program) ?? DEFAULT_PROGRAM_WEEKS;
      this.name.set(program.name);
      this.description.set(program.description ?? '');
      this.weeks.set(weeks);
      this._savedWeeks.set(weeks);
      this.newWeeksChoice.set(null);
      this.newWeeksMissing.set(false);
    });
  }

  private readonly _workouts = computed(() => this.program()?.workouts ?? []);

  /**
   * Days that the length now on the stepper would delete. Shortening drops
   * the weeks that no longer fit, so the count is named before the save.
   */
  readonly doomedDays = computed(() => {
    const weeks = this.weeks();
    return this._workouts().filter((w) => w.weekIndex >= weeks).length;
  });

  /** Weeks 1…n that hold the work so far, the block a longer program repeats. */
  private readonly _builtWeeks = computed(() =>
    this._workouts().reduce((max, w) => Math.max(max, w.weekIndex + 1), 0),
  );

  /** Empty weeks after the built ones, at the length now on the stepper. */
  private readonly _emptyWeeks = computed(() =>
    this._builtWeeks() > 0 ? Math.max(0, this.weeks() - this._builtWeeks()) : 0,
  );

  /**
   * Asked only while the program is being made longer, with neither answer
   * preselected: a ticked default copied training into weeks the coach had
   * not thought about, and an unticked one left a long plan mostly empty.
   */
  readonly askNewWeeks = computed(() => this.weeks() > this._savedWeeks() && this._emptyWeeks() > 0);

  private readonly _newWeeksParams = computed(() => ({
    built: this._builtWeeks(),
    empty: this._emptyWeeks(),
    first: this._builtWeeks() + 1,
    last: this.weeks(),
  }));

  readonly newWeeksQuestion = computed(() =>
    this._translateService.instant('programs.settings.newWeeks.question', this._newWeeksParams()),
  );

  readonly repeatLabel = computed(() =>
    this._translateService.instant('programs.settings.newWeeks.copy', this._newWeeksParams()),
  );

  readonly leaveEmptyLabel = computed(() =>
    this._translateService.instant('programs.settings.newWeeks.leaveEmpty', this._newWeeksParams()),
  );

  readonly weeksLabel = computed(() =>
    this._translateService.instant('programs.settings.weeksUnit', { count: this.weeks() }),
  );

  /** Something to save: a name, and a difference from what is stored. */
  readonly canSave = computed(() => {
    const program = this.program();
    const name = this.name().trim();
    if (!program || !name || this.saving()) return false;
    return (
      name !== program.name ||
      this.description().trim() !== (program.description ?? '') ||
      this.weeks() !== this._savedWeeks()
    );
  });

  stepWeeks(delta: number): void {
    this.weeks.update((w) => Math.max(1, Math.min(MAX_PROGRAM_WEEKS, w + delta)));
  }

  chooseNewWeeks(choice: NewWeeksChoice): void {
    this.newWeeksChoice.set(choice);
    this.newWeeksMissing.set(false);
  }

  commit(): void {
    if (!this.canSave()) return;
    // Save stays tappable and points at the question instead: a disabled
    // button would not say what it is waiting for.
    if (this.askNewWeeks() && !this.newWeeksChoice()) {
      this.newWeeksMissing.set(true);
      document
        .getElementById('program-details-new-weeks')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    this.save.emit({
      name: this.name().trim(),
      description: this.description().trim(),
      weeks: this.weeks(),
      repeatNewWeeks: this.askNewWeeks() && this.newWeeksChoice() === 'repeat',
    });
  }
}
