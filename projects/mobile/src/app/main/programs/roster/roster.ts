import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { RosterClient, RosterService, RosterSummary } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { injectOpenDirectMessage } from '../../../_shared/utils/direct-message';
import {
  PROGRAM_ICONS,
  adherenceLabel,
  attentionAction,
  attentionLabel,
  attentionTone,
} from '../programs.config';

/**
 * Who needs attention, most urgent first.
 *
 * Two behaviours here look like bugs and are not. A client with no active
 * plan never appears — there is nothing for them to be behind on. And a row
 * with nothing due shows no percentage at all rather than 0%, because
 * printing zero would accuse someone of missing work that was never set.
 */
@Component({
  selector: 'mh-roster',
  imports: [
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
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './roster.html',
  styleUrl: './roster.scss',
})
export class Roster implements ViewWillEnter {
  private readonly _rosterService = inject(RosterService);
  private readonly _router = inject(Router);
  /** Reuses the app's one way of opening a conversation, from anywhere. */
  private readonly _openDm = injectOpenDirectMessage();

  readonly summary = signal<RosterSummary | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly failed = signal(false);

  readonly skeletonRows = [1, 2, 3];

  readonly attentionLabel = attentionLabel;
  readonly attentionTone = attentionTone;
  readonly attentionAction = attentionAction;
  readonly adherenceLabel = adherenceLabel;

  /** Only the people who need something. The rest is not a to-do list. */
  readonly needsAttention = computed(() =>
    (this.summary()?.clients ?? []).filter((c) => c.attention !== null),
  );

  readonly steady = computed(() =>
    (this.summary()?.clients ?? []).filter((c) => c.attention === null),
  );

  readonly isEmpty = computed(
    () => this.loaded() && (this.summary()?.clients ?? []).length === 0,
  );

  readonly allSteady = computed(
    () => this.loaded() && !this.isEmpty() && this.needsAttention().length === 0,
  );

  constructor() {
    addIcons(PROGRAM_ICONS);
  }

  ionViewWillEnter(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this._rosterService
      .roster('4w')
      .pipe(take(1))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loaded.set(true);
          this.loading.set(false);
        },
      });
  }

  tone(row: RosterClient): string {
    return avatarToneFor(row.clientId);
  }

  /** The row's own numbers, only where they mean something. */
  subline(row: RosterClient): string {
    const parts = [adherenceLabel(row.adherencePercent)];
    if (row.daysSinceLastWorkout !== null) {
      parts.push(
        row.daysSinceLastWorkout === 0
          ? 'trained today'
          : `last trained ${row.daysSinceLastWorkout}d ago`,
      );
    }
    return parts.join(' · ');
  }

  /** Every row ends somewhere useful, not at a diagnosis. */
  act(row: RosterClient): void {
    const [firstName, ...rest] = (row.name ?? '').split(' ');
    this._openDm({ id: row.clientId, firstName, lastName: rest.join(' ') || null });
  }

  open(row: RosterClient): void {
    void this._router.navigate(['/tabs/clients', row.clientId]);
  }
}
