import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRouterOutlet,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  NavController,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { ClientCopyService, CopyOverview } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { Notice } from '../../../_shared/components/notice/notice';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { clientUrl, coachStackOf } from '../../clients/client-paths';
import { CopyBanner } from '../_components/copy-banner/copy-banner';
import { PROGRAM_ICONS, weekLabel } from '../programs.config';
import {
  CopyDayRow,
  canEditCopy,
  copyClientName,
  copyDayRow,
  copyHeader,
  copyWeeks,
  doneWeeksLine,
  openWeeks,
} from './client-copy.config';

/**
 * How long leaving waits before telling the client: longer than the day
 * editor's last set save takes to land (it waits 0.7 s, then one request).
 */
export const QUIET_DONE_DELAY_MS = 2000;

/** One open week as the page draws it. */
interface CopyWeekView {
  weekIndex: number;
  label: string;
  rows: CopyDayRow[];
}

/**
 * One client's copy of a plan (design ClientCopy, owner 2026-11-20): its
 * weeks, the done ones folded into one line, and the days still to come,
 * each opening the day editor bound to this client's copy. Changes reach
 * only this client; the program stays as it is.
 *
 * Done tells the client once about whatever changed since the last notice.
 * Leaving by back ends the editing too, so it does the same: a coach who
 * changed a day and went back must not leave the client unaware. The API
 * sends nothing when nothing changed, so a second call is harmless.
 */
@Component({
  selector: 'mh-client-copy',
  imports: [
    CopyBanner,
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    Notice,
    TranslatePipe,
  ],
  templateUrl: './client-copy.html',
  styleUrl: './client-copy.scss',
})
export class ClientCopy implements ViewWillEnter {
  private readonly _copyService = inject(ClientCopyService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _navController = inject(NavController);
  private readonly _outlet = inject(IonRouterOutlet, { optional: true });
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  /** Clients, Programs or Home: the stack the copy was opened in. */
  readonly stack = coachStackOf(this._router.url);

  readonly skeletonRows = [1, 2, 3];
  readonly overview = signal<CopyOverview | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly finishing = signal(false);

  private _assignmentId: string | null = null;
  /** Done already went out for this visit, so leaving sends nothing more. */
  private _finished = false;

  readonly showSkeleton = computed(() => this.loading() && !this.overview());
  readonly showError = computed(() => !this.loading() && !this.overview() && this.error());

  /** "Anna", the name every line uses. */
  readonly name = computed(() => {
    const fallback = this._translateService.instant('programs.common.clientFallback');
    const overview = this.overview();
    if (!overview) {
      return fallback;
    }
    return copyClientName(overview.assignment.client, fallback);
  });

  readonly header = computed(() => {
    const overview = this.overview();
    let program = '';
    if (overview) {
      program = overview.assignment.programNameSnapshot;
    }
    return copyHeader(this.name(), program);
  });

  readonly weeks = computed(() => {
    const overview = this.overview();
    if (!overview) {
      return [];
    }
    return copyWeeks(overview.days);
  });

  /** The plan stopped running: every day is read only. */
  readonly closed = computed(() => {
    const overview = this.overview();
    if (!overview) {
      return false;
    }
    return !canEditCopy(overview.assignment.status);
  });

  /** "Weeks 1 and 2 are done. You see them in Training, but can't change them." */
  readonly doneLine = computed(() => {
    if (this.closed()) {
      return '';
    }
    return doneWeeksLine(this.weeks());
  });

  readonly openWeeks = computed<CopyWeekView[]>(() => {
    if (this.closed()) {
      return [];
    }
    return openWeeks(this.weeks()).map((week) => ({
      weekIndex: week.weekIndex,
      label: weekLabel(week.weekIndex),
      rows: week.days.map((day) => copyDayRow(day)),
    }));
  });

  /** Where back lands on a cold load: the client's page. */
  readonly backUrl = computed(() => {
    const overview = this.overview();
    if (!overview) {
      return this.stack;
    }
    return clientUrl(this.stack, overview.assignment.clientId);
  });

  readonly notice = computed(() =>
    this._translateService.instant('programs.clientCopy.doneNotice', { name: this.name() }),
  );

  constructor() {
    addIcons(PROGRAM_ICONS);
    // Leaving the copy ends the editing: the client hears about what changed.
    inject(DestroyRef).onDestroy(() => {
      this._finishQuietly();
    });
  }

  // Always re-read: a day edited or moved on the next page belongs here.
  ionViewWillEnter(): void {
    const id = this._route.snapshot.paramMap.get('assignmentId');
    if (!id) {
      return;
    }
    if (id !== this._assignmentId) {
      this.overview.set(null);
    }
    this._assignmentId = id;
    this._finished = false;
    this.load();
  }

  load(): void {
    const id = this._assignmentId;
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this._copyService
      .overview(id)
      .pipe(take(1))
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  /** An upcoming day opens the editor on this client's copy of it. */
  openDay(row: CopyDayRow): void {
    const id = this._assignmentId;
    if (!id || !row.editable) {
      return;
    }
    void this._router.navigate([this.stack, 'copy', id, 'day', row.id]);
  }

  /** Done: the client is told once about the changes, then back to where this came from. */
  async done(): Promise<void> {
    const id = this._assignmentId;
    if (!id || this.finishing()) {
      return;
    }
    this.finishing.set(true);
    try {
      const result = await firstValueFrom(this._copyService.done(id));
      this._finished = true;
      if (result.notified) {
        void this._feedbackService.success(
          this._translateService.instant('programs.clientCopy.toast.notified', { name: this.name() }),
        );
      }
      this._leave();
    } catch (err: unknown) {
      void this._feedbackService.error(
        err,
        this._translateService.instant('programs.clientCopy.toast.doneFailed'),
      );
    } finally {
      this.finishing.set(false);
    }
  }

  /** Back the way the chevron goes: a pop of this stack, else the client's page. */
  private _leave(): void {
    if (this._outlet && this._outlet.canGoBack()) {
      this._navController.setDirection('back');
      void this._outlet.pop();
      return;
    }
    void this._navController.navigateBack(this.backUrl());
  }

  /**
   * Done on the way out, when the coach left without tapping it. A moment
   * later, so a set save the day editor sent on its way out lands first and
   * is in the notice. Never shows an error.
   */
  private _finishQuietly(): void {
    const id = this._assignmentId;
    if (!id || this._finished) {
      return;
    }
    this._finished = true;
    const service = this._copyService;
    setTimeout(() => {
      service
        .done(id, { silent: true })
        .pipe(take(1))
        .subscribe({ error: () => undefined });
    }, QUIET_DONE_DELAY_MS);
  }
}
