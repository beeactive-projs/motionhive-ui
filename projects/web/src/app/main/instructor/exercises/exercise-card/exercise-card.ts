import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import {
  EXERCISE_EQUIPMENT_TAG_CLASS,
  Exercise,
  ExerciseSource,
  ExerciseVisibility,
  exerciseLevelTag,
  exerciseMuscleTagClass,
  MuscleRole,
} from 'core';

/**
 * Catalog grid card. Pure presentational — emits `select` so the
 * parent can open the detail dialog.
 *
 * Design references:
 *   - Aspect ratio + thumb fallback: design S1 desktop
 *   - Top-right corner: SYSTEM badge / Private lock / Public globe
 *   - Foot: level + (system → mechanic | mine → "You" | public → author + fork count)
 *
 * Color is never the only signal — every badge pairs an icon with a
 * word per the design's accessibility callout.
 */
@Component({
  selector: 'mh-exercise-card',
  standalone: true,
  imports: [TooltipModule, TitleCasePipe, Tag, Card],
  templateUrl: './exercise-card.html',
  styleUrl: './exercise-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseCard {
  readonly exercise = input.required<Exercise>();
  /** When true, the viewer is the owner of this row — drives "Mine" label. */
  readonly isMine = input(false);

  readonly select = output<Exercise>();

  readonly primaryMuscle = computed(() => {
    const role = this.exercise().muscleRoles?.find((m) => m.role === 'PRIMARY');
    return role?.muscle?.commonName ?? null;
  });

  readonly leadEquipment = computed(() => this.exercise().equipment?.[0]?.name ?? null);

  readonly authorName = computed(() => {
    const owner = this.exercise().owner;
    if (!owner) return null;
    const parts = [owner.firstName, owner.lastName].filter(Boolean);
    return parts.join(' ').trim() || null;
  });

  readonly authorInitials = computed(() => {
    const owner = this.exercise().owner;
    if (!owner) return null;
    const f = owner.firstName?.[0] ?? '';
    const l = owner.lastName?.[0] ?? '';
    return (f + l).toUpperCase() || null;
  });

  /** Decide which corner badge to render on the thumbnail. */
  readonly cornerBadge = computed<'system' | 'mine' | 'public' | null>(() => {
    const e = this.exercise();
    if (e.source === ExerciseSource.System) return 'system';
    if (this.isMine()) return 'mine';
    if (e.visibility === ExerciseVisibility.Public) return 'public';
    return null;
  });

  /** Difficulty tag (label + ramped colour) from the shared palette. */
  readonly levelTag = computed(() => exerciseLevelTag(this.exercise().level));

  /** Shared tag-palette classes, exposed for the template. */
  readonly primaryMuscleClass = exerciseMuscleTagClass(MuscleRole.Primary);
  readonly equipmentClass = EXERCISE_EQUIPMENT_TAG_CLASS;

  onClick(): void {
    this.select.emit(this.exercise());
  }
}
