import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CheckList, Hex, type HexTone } from 'core';

export interface PathOption {
  icon: string;
  tone: HexTone;
  title: string;
  points: string[];
}

/**
 * Coach or client, behind a segmented control.
 *
 * Two stacked cards made every visitor scroll through the half that was not
 * about them. One tap picks a side instead, and the panel reserves the height
 * of the longer list so switching never jumps the page under a thumb.
 */
@Component({
  selector: 'mh-path-toggle',
  imports: [CheckList, Hex],
  templateUrl: './path-toggle.html',
  styleUrl: './path-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathToggle {
  readonly paths = input.required<readonly PathOption[]>();

  /** Coach first: they are who the page is selling to. */
  readonly active = signal(0);

  readonly current = computed(() => this.paths()[this.active()] ?? this.paths()[0]);

  /** Rows in the longest side, so the panel can hold that height. */
  readonly tallest = computed(() =>
    this.paths().reduce((max, p) => Math.max(max, p.points.length), 0),
  );

  select(index: number): void {
    this.active.set(index);
  }
}
