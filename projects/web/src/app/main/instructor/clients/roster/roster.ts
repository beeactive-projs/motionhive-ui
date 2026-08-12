import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';

import {
  RosterClient,
  RosterService,
  RosterSummary,
  RosterWindow,
  showApiError,
} from 'core';

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
  standalone: true,
  imports: [
    FormsModule,
    ButtonDirective,
    Card,
    KpiCard,
    ListEmptyState,
    SelectButton,
    Skeleton,
  ],
  templateUrl: './roster.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoachRoster implements OnInit {
  private readonly _service = inject(RosterService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);

  readonly data = signal<RosterSummary | null>(null);
  readonly loading = signal(false);
  readonly window = signal<RosterWindow>('4w');

  readonly windowOptions = [
    { label: 'This week', value: '1w' as RosterWindow },
    { label: '4 weeks', value: '4w' as RosterWindow },
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
    this._service.roster(this.window()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(
          this._messageService,
          "Couldn't load your roster",
          'Please try again.',
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
        return 'Has not started';
      case 'SILENT':
        return `Quiet ${c.daysSinceLastWorkout} days`;
      case 'DROPPED':
        return 'Dropping off';
      case 'BEHIND':
        return 'Behind plan';
      default:
        return '';
    }
  }

  /** One line saying what actually happened, under the label. */
  attentionDetail(c: RosterClient): string {
    switch (c.attention) {
      case 'NEVER_STARTED':
        return 'Assigned a plan but has never logged a workout.';
      case 'SILENT':
        return c.due > 0
          ? `${c.completed} of ${c.due} sessions done in this window.`
          : 'No workouts logged recently.';
      case 'DROPPED':
        return `Down from ${c.previousAdherencePercent}% to ${c.adherencePercent}% against the previous window.`;
      case 'BEHIND':
        return `${c.completed} of ${c.due} sessions done.`;
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
      return c.activePlans === 0
        ? 'No active plan'
        : 'Nothing scheduled in this window';
    }
    return `${c.completed} of ${c.due} sessions`;
  }
}
