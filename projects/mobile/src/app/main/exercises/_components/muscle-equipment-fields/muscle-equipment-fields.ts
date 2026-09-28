import { Component, computed, inject, model, signal } from '@angular/core';
import { IonItem, IonLabel, IonList, IonNote } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ExerciseTaxonomyStore, MuscleRole } from 'core';

import { TaxonomyPickerSheet } from '../../_sheets/taxonomy-picker-sheet/taxonomy-picker-sheet';
import { MuscleEquipmentSelection } from '../../exercise-draft';
import { MAX_PRIMARY_MUSCLES, TaxonomyOption } from '../../exercises.config';

/** Which list the one picker sheet is currently editing. */
type PickerTarget = keyof MuscleEquipmentSelection;

/**
 * How the picker presents itself for one of the four lists. Title,
 * placeholder and hint are translation keys, read when the picker opens.
 */
interface PickerMeta {
  title: string;
  searchPlaceholder: string;
  /** Null for the uncapped lists — the cap is a fact about primary muscles only. */
  max: number | null;
  /** Under the search field: why the cap exists, where there is one. */
  hint: string | null;
}

const MUSCLE_PLACEHOLDER = 'exercises.muscleFields.searchMuscles';

const PICKER_META: Record<PickerTarget, PickerMeta> = {
  primaryMuscleIds: {
    title: `exercises.muscleRoles.${MuscleRole.Primary}`,
    searchPlaceholder: MUSCLE_PLACEHOLDER,
    max: MAX_PRIMARY_MUSCLES,
    hint: 'exercises.muscleFields.primaryHint',
  },
  secondaryMuscleIds: {
    title: `exercises.muscleRoles.${MuscleRole.Secondary}`,
    searchPlaceholder: MUSCLE_PLACEHOLDER,
    max: null,
    hint: null,
  },
  stabilizerMuscleIds: {
    title: `exercises.muscleRoles.${MuscleRole.Stabilizer}`,
    searchPlaceholder: MUSCLE_PLACEHOLDER,
    max: null,
    hint: null,
  },
  equipmentIds: {
    title: 'exercises.fields.equipment',
    searchPlaceholder: 'exercises.muscleFields.searchEquipment',
    max: null,
    hint: null,
  },
};

/**
 * What the exercise trains and what it needs — the block the create wizard's
 * second step and the edit page both render.
 *
 * Shared as a component rather than as a base class the two pages extend:
 * the thing they have in common is this piece of screen, and a component
 * keeps the picker sheet, the cap and the row summaries in one place
 * instead of splitting them across an inheritance seam.
 *
 * Four rows, one shape: each summarises its list and opens the same picker
 * pointed at it. Primary is first and marked required; the cap on it lives
 * in the picker, which is where you find out you have hit it.
 */
@Component({
  selector: 'mh-muscle-equipment-fields',
  imports: [IonItem, IonLabel, IonList, IonNote, TaxonomyPickerSheet, TranslatePipe],
  templateUrl: './muscle-equipment-fields.html',
  styleUrl: './muscle-equipment-fields.scss',
})
export class MuscleEquipmentFields {
  readonly selection = model.required<MuscleEquipmentSelection>();

  private readonly _exerciseTaxonomyStore = inject(ExerciseTaxonomyStore);
  private readonly _translateService = inject(TranslateService);

  readonly pickerOpen = signal(false);
  private readonly _target = signal<PickerTarget>('primaryMuscleIds');

  private readonly _muscleOptions = computed<TaxonomyOption[]>(() =>
    this._exerciseTaxonomyStore.muscles().map((muscle) => ({ value: muscle.id, label: muscle.commonName })),
  );

  private readonly _equipmentOptions = computed<TaxonomyOption[]>(() =>
    this._exerciseTaxonomyStore.equipment().map((item) => ({ value: item.id, label: item.name })),
  );

  readonly primarySummary = computed(() =>
    this._muscleSummary(this.selection().primaryMuscleIds),
  );

  readonly secondarySummary = computed(() =>
    this._muscleSummary(this.selection().secondaryMuscleIds),
  );

  readonly stabilizerSummary = computed(() =>
    this._muscleSummary(this.selection().stabilizerMuscleIds),
  );

  readonly equipmentSummary = computed(() => {
    const byId = this._exerciseTaxonomyStore.equipmentById();
    const names = this.selection().equipmentIds.map((id) => byId.get(id)?.name ?? '');
    // Stated, not implied: an exercise with no equipment is a bodyweight
    // exercise, and the server attaches that row itself.
    return (
      names.filter(Boolean).join(', ') ||
      this._translateService.instant('exercises.muscleFields.bodyweight')
    );
  });

  // ── The one picker, pointed at whichever list was tapped ──────────────────

  readonly picker = computed(() => {
    const meta = PICKER_META[this._target()];
    return {
      title: this._translateService.instant(meta.title) as string,
      searchPlaceholder: this._translateService.instant(meta.searchPlaceholder) as string,
      max: meta.max,
      hint: meta.hint ? (this._translateService.instant(meta.hint) as string) : '',
    };
  });

  readonly pickerOptions = computed(() =>
    this._target() === 'equipmentIds' ? this._equipmentOptions() : this._muscleOptions(),
  );

  readonly pickerSelected = computed(() => this.selection()[this._target()]);

  constructor() {
    this._exerciseTaxonomyStore.ensureLoaded();
  }

  openPicker(target: PickerTarget): void {
    this._target.set(target);
    this.pickerOpen.set(true);
  }

  applyPicker(ids: string[]): void {
    this.selection.update((selection) => ({ ...selection, [this._target()]: ids }));
  }

  /** "Glutes, Hamstrings" — or the placeholder that says the slot is empty. */
  private _muscleSummary(ids: readonly string[]): string {
    const byId = this._exerciseTaxonomyStore.muscleById();
    const names = ids.map((id) => byId.get(id)?.commonName ?? '').filter(Boolean);
    return names.join(', ') || this._translateService.instant('exercises.muscleFields.noneYet');
  }
}
