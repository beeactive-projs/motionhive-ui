import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonNote } from '@ionic/angular/standalone';

import { SessionInstance, formatSessionTime } from 'core';

import { instanceTone } from '../../sessions.config';

/** Pixels per hour. Tall enough that a 30-minute block is still tappable. */
const HOUR_HEIGHT = 56;

/** Hours drawn when nothing is scheduled — a plausible working day. */
const DEFAULT_FIRST_HOUR = 7;
const DEFAULT_LAST_HOUR = 20;

interface RailBlock {
  instance: SessionInstance;
  top: number;
  height: number;
  /** Overlapping sessions split the width and sit side by side. */
  widthPercent: number;
  leftPercent: number;
  hasConflict: boolean;
  tone: string;
  title: string;
  time: string;
}

/**
 * One day on an hour rail — the zoomed-in counterpart to the agenda.
 *
 * Overlaps are the point of this view: two sessions at the same time are
 * side-by-side blocks, which a flat list cannot show. The rail only spans the
 * hours that are actually in use (padded by one either side), so an evening-only
 * day does not open on eight empty morning rows.
 */
@Component({
  selector: 'mh-day-rail',
  imports: [IonBadge, IonNote],
  templateUrl: './day-rail.html',
  styleUrl: './day-rail.scss',
})
export class DayRail {
  readonly instances = input.required<SessionInstance[]>();

  readonly select = output<SessionInstance>();
  /** An empty slot was tapped — the hour it represents. */
  readonly pickHour = output<number>();

  readonly hourHeight = HOUR_HEIGHT;

  private readonly _bounds = computed(() => {
    const instances = this.instances();
    if (instances.length === 0) {
      return { first: DEFAULT_FIRST_HOUR, last: DEFAULT_LAST_HOUR };
    }
    let first = 23;
    let last = 0;
    for (const instance of instances) {
      const start = new Date(instance.startAt);
      first = Math.min(first, start.getHours());

      // Measured from the start of the day rather than read off the end time:
      // a session running to midnight has `getHours() === 0`, which would sort
      // as the earliest hour and collapse the rail to nothing.
      const dayStart = new Date(start);
      dayStart.setHours(0, 0, 0, 0);
      const endHours = (new Date(instance.endAt).getTime() - dayStart.getTime()) / 3_600_000;
      // An end exactly on the hour belongs to the hour before it.
      last = Math.max(last, Math.ceil(endHours) - 1);
    }
    return {
      first: Math.max(0, first - 1),
      last: Math.min(23, Math.max(first, last) + 1),
    };
  });

  readonly hours = computed(() => {
    const { first, last } = this._bounds();
    return Array.from({ length: last - first + 1 }, (_, i) => ({
      hour: first + i,
      label: `${String(first + i).padStart(2, '0')}:00`,
    }));
  });

  readonly blocks = computed<RailBlock[]>(() => {
    const { first } = this._bounds();
    const ordered = [...this.instances()].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );

    // Runs of overlapping sessions share the width evenly. A and C that do not
    // touch still get thirds if B overlaps both.
    const columns = new Map<string, { index: number; total: number }>();
    let run: SessionInstance[] = [];
    let runEnd = 0;

    const flush = () => {
      run.forEach((instance, index) =>
        columns.set(instance.id, { index, total: run.length }),
      );
      run = [];
    };

    for (const instance of ordered) {
      const start = new Date(instance.startAt).getTime();
      if (run.length > 0 && start >= runEnd) flush();
      run.push(instance);
      runEnd = Math.max(runEnd, new Date(instance.endAt).getTime());
    }
    flush();

    return ordered.map((instance) => {
      const start = new Date(instance.startAt);
      const end = new Date(instance.endAt);
      const startOffset = start.getHours() + start.getMinutes() / 60 - first;
      const durationHours = Math.max(
        0.5,
        (end.getTime() - start.getTime()) / 3_600_000,
      );
      const column = columns.get(instance.id) ?? { index: 0, total: 1 };
      const hasConflict = (instance.conflictingInstanceIds?.length ?? 0) > 0;
      const template = instance.template;

      return {
        instance,
        top: startOffset * HOUR_HEIGHT,
        height: durationHours * HOUR_HEIGHT - 4,
        widthPercent: 100 / column.total,
        leftPercent: (100 / column.total) * column.index,
        hasConflict,
        tone: instanceTone(instance),
        title: instance.titleOverride ?? template?.title ?? 'Session',
        time: formatSessionTime(instance.startAt),
      };
    });
  });

  readonly conflictCount = computed(() => this.blocks().filter((b) => b.hasConflict).length);

  readonly railHeight = computed(() => this.hours().length * HOUR_HEIGHT);
}
