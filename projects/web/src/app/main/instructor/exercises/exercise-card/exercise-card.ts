import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { Exercise, ExerciseLevel, ExerciseSource, ExerciseVisibility, TagSeverity } from 'core';

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

  readonly levelLabel = computed<{
    text: string;
    icon: string;
    severity: TagSeverity;
    class?: string;
  }>(() => {
    switch (this.exercise().level) {
      case ExerciseLevel.Beginner:
        return {
          text: 'Beginner',
          icon: 'pi pi-angle-down',
          severity: TagSeverity.Success,
          class: 'bg-green-200 text-green-800',
        };
      case ExerciseLevel.Intermediate:
        return {
          text: 'Intermediate',
          icon: 'pi pi-equals',
          severity: TagSeverity.Warn,
          class: 'bg-yellow-200 text-yellow-800',
        };
      default:
        return {
          text: 'Advanced',
          icon: 'pi pi-angle-double-up',
          severity: TagSeverity.Danger,
          class: 'bg-red-200 text-red-800',
        };
    }
  });

  onClick(): void {
    this.select.emit(this.exercise());
  }
}
