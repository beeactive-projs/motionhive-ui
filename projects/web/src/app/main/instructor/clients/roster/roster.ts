import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService, SelectItem } from 'primeng/api';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';

import {
  RosterClient,
  RosterService,
  RosterSummary,
  RosterWindow,
  showApiError,
} from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { KpiCard } from '../../../../_shared/components/kpi-card/kpi-card';
import { ListEmptyState } from '../../../../_shared/components/list-empty-state/list-empty-state';

/**
 * The coach's roster — who is on track, who is slipping.
 *
 * A section of the Clients page rather than a page of its own: the
 * roster and the client table are two lenses on the same people, so
 * they share one destination, one title, and one MessageService.
 *
 * A morning-coffee screen: scannable in about ten seconds, with the
 * next action obvious. Clients needing attention sort to the top and
 * each carries one reason, so the coach never has to work out *why*
 * someone is flagged.
 *
 * Read-only and derived. Everything here comes from what the trainee
 * surfaces already write, which is why it needed no migration.
 */
@Component({
  selector: 'mh-coach-roster',
  imports: [
    FormsModule,
    ButtonDirective,
    Card,
    HexAvatar,
    KpiCard,
    ListEmptyState,
    SelectButton,
    Skeleton,
    TranslatePipe,
  ],
  templateUrl: './roster.html',
})
export class CoachRoster implements OnInit {
  private readonly _rosterService = inject(RosterService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);

  readonly data = signal<RosterSummary | null>(null);
  readonly loading = signal(false);
  readonly window = signal<RosterWindow>('4w');

  readonly windowOptions: SelectItem<RosterWindow>[] = [
    { label: this._translateService.instant('time.bucket.thisWeek'), value: '1w' },
    { label: this._translateService.instant('count.weeks', { count: 4 }), value: '4w' },
  ];

  readonly clients = computed(() => this.data()?.clients ?? []);
  readonly needsAttention = computed(() =>
    this.clients().filter((c) => c.attention !== null),
  );
  readonly onTrack = computed(() =>
    this.clients().filter((c) => c.attention === null),
  );

  readonly isEmpty = computed(
    () => !this.loading() && this.clients().length === 0,
  );

  readonly adherenceLabel = computed(() => {
    const a = this.data()?.totals.adherencePercent;
    return a == null ? '—' : `${a}%`;
  });

  ngOnInit(): void {
    this.fetch();
  }

  setWindow(w: RosterWindow): void {
    if (w === this.window()) return;
    this.window.set(w);
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this._rosterService.roster(this.window()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('clients.toast.loadRosterFailed'),
          this._translateService.instant('common.pleaseTryAgain'),
          err,
        );
      },
    });
  }

  openClient(c: RosterClient): void {
    this._router.navigate(['/coaching/clients', c.clientId]);
  }

  messageClient(c: RosterClient, event: MouseEvent): void {
    event.stopPropagation();
    // `to`, not `with` — the inbox reads `to`, matching the public
    // profile's message button.
    this._router.navigate(['/messages'], {
      queryParams: { to: c.clientId },
    });
  }

  /** Plain language, because a coach should not decode an enum. */
  attentionLabel(c: RosterClient): string {
    switch (c.attention) {
      case 'NEVER_STARTED':
        return this._translateService.instant('clients.roster.attention.reason.neverStarted');
      case 'SILENT':
        return this._translateService.instant('clients.roster.attention.reason.silent', {
          days: c.daysSinceLastWorkout,
        });
      case 'DROPPED':
        return this._translateService.instant('clients.roster.attention.reason.dropped');
      case 'BEHIND':
        return this._translateService.instant('clients.roster.attention.reason.behind');
      default:
        return '';
    }
  }

  /** One line saying what actually happened, under the label. */
  attentionDetail(c: RosterClient): string {
    switch (c.attention) {
      case 'NEVER_STARTED':
        return this._translateService.instant('clients.roster.attention.detail.neverStarted');
      case 'SILENT':
        return c.due > 0
          ? this._translateService.instant('clients.roster.attention.detail.silent', {
              completed: c.completed,
              due: c.due,
            })
          : this._translateService.instant('clients.roster.attention.detail.silentNoDue');
      case 'DROPPED':
        return this._translateService.instant('clients.roster.attention.detail.dropped', {
          previous: c.previousAdherencePercent,
          current: c.adherencePercent,
        });
      case 'BEHIND':
        return this._translateService.instant('clients.roster.attention.detail.behind', {
          completed: c.completed,
          due: c.due,
        });
      default:
        return '';
    }
  }

  adherenceFor(c: RosterClient): string {
    return c.adherencePercent == null ? '—' : `${c.adherencePercent}%`;
  }

  /** Nothing scheduled is a fact about the plan, not about the person. */
  subtitleFor(c: RosterClient): string {
    if (c.due === 0) {
      return this._translateService.instant(
        c.activePlans === 0
          ? 'clients.roster.subtitle.noPlan'
          : 'clients.roster.subtitle.nothingScheduled',
      );
    }
    return this._translateService.instant('clients.roster.subtitle.sessions', {
      completed: c.completed,
      due: c.due,
    });
  }

  /**
   * Initials for the hex avatar. The roster returns `name` already joined
   * (first + last, falling back to handle), so derive from the words rather
   * than firstName/lastName — first and last word covers "Ana Maria Pop"
   * the way a reader would abbreviate it.
   */
  initialsFor(c: RosterClient): string {
    const words = c.name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    const first = words[0]!.charAt(0);
    const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : '';
    return (first + last).toUpperCase();
  }
}
