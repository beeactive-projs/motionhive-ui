import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

import {
  Equipment,
  ExerciseFacets,
  ExerciseKind,
  ExerciseLevel,
  Muscle,
} from 'core';

export interface KindFilterOption {
  value: ExerciseKind;
  label: string;
}

export interface LevelFilterOption {
  value: ExerciseLevel;
  label: string;
}

/**
 * Stateless filter panel. Renders the four facet sections (kind,
 * level, primary muscle, equipment) with live counts. Used in two
 * layouts — the persistent left rail on desktop and the bottom-sheet
 * drawer on mobile — so the markup lives here and the parent decides
 * the chrome (panel vs sheet).
 *
 * Parent owns the state (the `Set`-typed signals) and reacts to the
 * toggle outputs. We don't use `model()` here because the parent
 * already coordinates other state (search, sort, ownership) on the
 * same signals — keeping the parent as the single mutator keeps the
 * effect()-driven refetch clean.
 */
@Component({
  selector: 'mh-exercise-filter-panel',
  standalone: true,
  imports: [],
  templateUrl: './exercise-filter-panel.html',
  styleUrl: './exercise-filter-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseFilterPanel {
  readonly kindOptions = input.required<KindFilterOption[]>();
  readonly levelOptions = input.required<LevelFilterOption[]>();
  readonly muscles = input.required<Muscle[]>();
  readonly equipment = input.required<Equipment[]>();
  readonly facets = input<ExerciseFacets | undefined>(undefined);

  readonly selectedKinds = input.required<Set<ExerciseKind>>();
  readonly selectedLevels = input.required<Set<ExerciseLevel>>();
  readonly selectedMuscleIds = input.required<Set<string>>();
  readonly selectedEquipmentIds = input.required<Set<string>>();

  readonly toggleKind = output<ExerciseKind>();
  readonly toggleLevel = output<ExerciseLevel>();
  readonly toggleMuscle = output<string>();
  readonly toggleEquipment = output<string>();

  readonly hasMuscles = computed(() => this.muscles().length > 0);
  readonly hasEquipment = computed(() => this.equipment().length > 0);
}
