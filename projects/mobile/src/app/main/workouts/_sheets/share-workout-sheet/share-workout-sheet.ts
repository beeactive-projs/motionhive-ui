import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { WorkoutLog, WorkoutLogService, appLocale } from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { ThemeService } from '../../../../_shared/services/theme.service';
import {
  CAPTION_MAX_LENGTH,
  ShareCardOptions,
  oneLine,
  shareCardContent,
} from '../../_services/share-card';
import { ShareCardService } from '../../_services/share-card.service';

/** Message ideas offered as one tap; the person's own note comes first when there is one. */
const SUGGESTIONS = ['workouts.share.suggestions.done', 'workouts.share.suggestions.hive'];

/**
 * Share a finished workout as a story card: a live preview, what to show
 * on it, one line of message, then the phone's own share sheet.
 *
 * The private note is never put on the card by itself. "From your note" is
 * a chip the person taps; the field starts with the message they used last
 * time, or empty.
 */
@Component({
  selector: 'mh-share-workout-sheet',
  imports: [IonButton, IonInput, IonSpinner, SheetShell, TranslatePipe],
  templateUrl: './share-workout-sheet.html',
  styleUrl: './share-workout-sheet.scss',
})
export class ShareWorkoutSheet {
  private readonly _shareCardService = inject(ShareCardService);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _themeService = inject(ThemeService);

  readonly open = model(false);
  readonly log = input.required<WorkoutLog>();
  /** What the person wrote privately, offered as a chip and nothing more. */
  readonly note = input('');
  /** The message as saved, so the screen that opened this stays in step. */
  readonly captionSaved = output<string | null>();

  readonly captionMaxLength = CAPTION_MAX_LENGTH;
  readonly suggestions = SUGGESTIONS;

  readonly showKg = signal(true);
  readonly showRecord = signal(true);
  readonly showCoach = signal(false);
  readonly caption = signal('');
  readonly preview = signal<string | null>(null);
  readonly sharing = signal(false);

  readonly hasRecord = computed(() => (this.log().personalRecords?.length ?? 0) > 0);
  readonly hasCoach = computed(() => !!this.log().summary?.coachName);
  readonly noteLine = computed(() => oneLine(this.note()).slice(0, CAPTION_MAX_LENGTH));

  private readonly _options = computed<ShareCardOptions>(() => ({
    showKg: this.showKg(),
    showRecord: this.showRecord(),
    showCoach: this.showCoach(),
    caption: this.caption(),
  }));

  constructor() {
    // Each opening starts from what was last shared, not from the last edit.
    effect(() => {
      if (!this.open()) return;
      const log = untracked(this.log);
      this.caption.set(log.shareCaption ?? '');
    });
    // The preview redraws as the choices change, the same card that is sent.
    // Draws can finish out of order; only the latest one is shown.
    effect(() => {
      if (!this.open()) return;
      const options = this._options();
      const log = this.log();
      const draw = ++this._draws;
      void this._draw(log, options).then((url) => {
        if (draw === this._draws) this.preview.set(url);
      });
    });
  }

  private _draws = 0;

  toggleKg(): void {
    this.showKg.update((on) => !on);
  }

  toggleRecord(): void {
    this.showRecord.update((on) => !on);
  }

  toggleCoach(): void {
    this.showCoach.update((on) => !on);
  }

  useSuggestion(key: string): void {
    this.caption.set(this._translateService.instant(key));
  }

  useNote(): void {
    this.caption.set(this.noteLine());
  }

  /**
   * Keeps the message with the workout first, so sharing again reuses it,
   * then hands the card to the phone. A message that failed to save still
   * goes out on the card: the share is what the person asked for.
   */
  async share(): Promise<void> {
    if (this.sharing()) return;
    const log = this.log();
    this.sharing.set(true);
    try {
      const caption = oneLine(this.caption());
      if (caption !== (log.shareCaption ?? '')) {
        try {
          await firstValueFrom(this._workoutLogService.complete(log.id, { shareCaption: caption }));
          this.captionSaved.emit(caption || null);
        } catch {
          // Kept on the card regardless; saving it is a convenience.
        }
      }
      const image = await this._draw(log, this._options());
      const outcome = await this._shareCardService.share(image, log.name);
      if (outcome === 'shared') this.open.set(false);
    } catch (err) {
      void this._feedbackService.error(err, this._translateService.instant('workouts.share.toast.failed'));
    } finally {
      this.sharing.set(false);
    }
  }

  private _draw(log: WorkoutLog, options: ShareCardOptions): Promise<string> {
    const content = shareCardContent(
      log,
      options,
      (key, params) => this._translateService.instant(key, params),
      appLocale(),
    );
    return this._shareCardService.render(content, this._themeService.isDark());
  }
}
