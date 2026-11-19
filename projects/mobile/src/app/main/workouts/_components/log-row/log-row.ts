import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { WorkoutLog, WorkoutLogStatus, translate } from 'core';

import { BadgeTones } from '../../../exercises/exercises.config';
import { LogSources, dateRail, logChip, logMeta, logSource, logTone } from '../../workouts.config';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, imageOutline, refreshOutline } from 'ionicons/icons';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { WorkoutPhotoStore } from '../../_services/workout-photo';

/**
 * One logged workout: a date rail on the left, the name and what the session
 * amounted to on the right, with the spine keyed to how it ended — emerald
 * done, muted skipped.
 *
 * The same row serves the trainee's own history and a coach reading a
 * client's training. Only the trainee gets Repeat: it starts a fresh
 * freestyle session carrying the same movements, and it rides the row rather
 * than hiding behind it because it is the fastest route to a second workout.
 *
 * A workout with a photo says so: the trainee's own row shows the photo as a
 * small trailing thumbnail in the app's hexagon (`mh-hex-avatar`, from a
 * small crop fetched once and cached); a coach's row, which reads photos through
 * another door with no small size, shows a photo glyph in the tags line.
 */
@Component({
  selector: 'mh-log-row',
  imports: [HexAvatar, IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonNote, TranslatePipe],
  templateUrl: './log-row.html',
  styleUrl: './log-row.scss',
})
export class LogRow {
  readonly log = input.required<WorkoutLog>();
  /** Offers the Repeat control. Off where the reader is not the one training. */
  readonly repeatable = input(false);
  /** Names the coach on assigned work. Off where the reader is the coach. */
  readonly showSource = input(false);
  /**
   * The photo as a thumbnail: only the person who trained, whose photos the
   * small crop serves. Elsewhere a glyph says there is one.
   */
  readonly photoPreview = input(false);

  private readonly _photos = inject(WorkoutPhotoStore);
  private readonly _destroyRef = inject(DestroyRef);

  readonly hasPhoto = computed(() => this.log().hasPhoto === true);
  readonly showThumb = computed(() => this.hasPhoto() && this.photoPreview());
  readonly showPhotoGlyph = computed(() => this.hasPhoto() && !this.photoPreview());
  /** The thumbnail once it has loaded; until then (or if it fails) a glyph holds the place. */
  readonly thumbUrl = signal<string | null>(null);
  /** The glyph on the hexagon only while there is no photo to show. */
  readonly thumbIcon = computed(() => {
    if (this.thumbUrl()) {
      return null;
    }
    return 'image-outline';
  });

  readonly select = output<void>();
  readonly repeat = output<void>();

  readonly tone = computed(() => logTone(this.log()));

  /** A skipped plan day is a record of a choice, with no log behind it to open. */
  readonly openable = computed(() => this.log().status !== WorkoutLogStatus.Skipped);

  readonly rail = computed(() => dateRail(this.log().startedAt));

  readonly meta = computed(() => logMeta(this.log()));

  readonly chip = computed(() => logChip(this.log()));

  /** "1 record": beating a previous best, the one thing a row celebrates. */
  readonly records = computed(() => {
    const count = this.log().prCount ?? 0;
    return count > 0
      ? { label: translate('workouts.logRow.records', { count }), tone: BadgeTones.Honey }
      : null;
  });

  readonly sourceChip = computed(() =>
    this.showSource() && logSource(this.log()) === LogSources.Coach
      ? { label: translate('workouts.logRow.coach'), tone: BadgeTones.Navy }
      : null,
  );

  constructor() {
    // Its own glyphs: the row sits on pages that register others.
    addIcons({ chevronForwardOutline, imageOutline, refreshOutline });

    effect(() => {
      if (!this.showThumb()) {
        this.thumbUrl.set(null);
        return;
      }
      const log = this.log();
      // Quiet on failure: the glyph stays, which still says there is a photo.
      this._photos
        .thumbUrl(log.id, log.photoVersion ?? null)
        .pipe(take(1), takeUntilDestroyed(this._destroyRef))
        .subscribe({ next: (url) => this.thumbUrl.set(url), error: () => undefined });
    });
  }

  onSelect(): void {
    if (this.openable()) this.select.emit();
  }

  onRepeat(event: Event): void {
    // Inside the row's own tap target; without this Repeat also opens the log.
    event.stopPropagation();
    this.repeat.emit();
  }
}
