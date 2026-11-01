import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { AuthStore, localDayKey, RosterClient } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { StatTile } from '../../../_shared/components/stat-tile/stat-tile';
import { avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { HiveBoard } from '../_components/hive-board/hive-board';
import { HiveLegend, LegendItem, LegendSwatches } from '../_components/hive-board/hive-legend';
import { HomePages } from '../home-stack.config';
import {
  CLIENT_HIVE_ICONS,
  clientHiveCells,
  endingPlanOf,
  filterClients,
  ghostHiveCells,
  HIVE_RANGES,
  HiveFilter,
  HiveFilters,
  hiveTotals,
  movedCount,
  rangeFrom,
} from './client-hive.config';
import { ClientHiveStore } from './client-hive.store';
import { ClientSheet } from './client-sheet/client-sheet';

/**
 * The coach's hive, from the Home hive card: every client as a cell around
 * the coach, filled with how much of their plan they did in the range, a
 * calm coral ring on anyone quiet for a week. A tap opens the client's
 * sheet (their week, last workout, quick actions).
 *
 * In Home's stack, so back returns to Home and whatever the sheet opens
 * returns here.
 */
@Component({
  selector: 'mh-client-hive',
  imports: [
    ClientSheet,
    EmptyState,
    HiveBoard,
    HiveLegend,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonLabel,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    StatTile,
    TranslatePipe,
  ],
  templateUrl: './client-hive.html',
  styleUrl: './client-hive.scss',
  host: { class: 'mh-whole-words' },
  providers: [ClientHiveStore],
})
export class ClientHive implements OnInit, ViewWillEnter {
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);
  private readonly _authStore = inject(AuthStore);

  readonly store = inject(ClientHiveStore);

  readonly ranges = HIVE_RANGES;
  readonly Filters = HiveFilters;
  readonly filter = signal<HiveFilter>(HiveFilters.All);

  /** The client whose sheet is open (kept while it closes, so it does not blank). */
  readonly picked = signal<RosterClient | null>(null);
  readonly sheetOpen = signal(false);

  /** The first entry is the first load (`ngOnInit`). */
  private _entered = false;

  private readonly _t = (key: string, params?: Record<string, unknown>) =>
    this._translateService.instant(key, params);

  readonly legend: LegendItem[] = [
    { swatch: LegendSwatches.Honey, label: this._t('clientHive.legend.plan') },
    { swatch: LegendSwatches.Dashed, label: this._t('clientHive.legend.noPlan') },
    { swatch: LegendSwatches.Quiet, label: this._t('clientHive.legend.quiet') },
  ];

  private readonly _coach = computed(() => {
    const user = this._authStore.user();
    return {
      id: user?.id ?? '',
      name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
      avatarUrl: user?.avatarUrl ?? null,
    };
  });

  readonly attentionCount = computed(
    () => filterClients(this.store.clients(), HiveFilters.Attention).length,
  );

  /** The filter in force: with nobody needing attention the chips go, and so does it. */
  readonly activeFilter = computed(() =>
    this.attentionCount() > 0 ? this.filter() : HiveFilters.All,
  );

  readonly shown = computed(() => filterClients(this.store.clients(), this.activeFilter()));

  readonly cells = computed(() =>
    this.store.loading()
      ? ghostHiveCells()
      : clientHiveCells(this._coach(), this.shown(), {
          t: this._t,
          range: this.store.range(),
          tone: avatarToneFor,
        }),
  );

  readonly headline = computed(() => {
    const clients = this.store.clients();
    if (this.activeFilter() === HiveFilters.Attention) {
      return this._t('clientHive.headlineAttention', { count: this.shown().length });
    }
    return this._t('clientHive.headline', {
      moved: movedCount(clients, this.store.range()),
      total: clients.length,
    });
  });

  readonly boardLabel = computed(() =>
    this.store.loading() ? this._t('a11y.loading') : this._t('clientHive.board'),
  );

  readonly totals = computed(() => {
    const roster = this.store.roster();
    return roster ? hiveTotals(roster.totals, this._t) : [];
  });

  /** The picked client's active plans, and the one ending soon. */
  readonly pickedPlans = computed(() => {
    const id = this.picked()?.clientId;
    return id ? this.store.assignments().filter((plan) => plan.clientId === id) : [];
  });

  readonly pickedEnding = computed(() => {
    const id = this.picked()?.clientId;
    return id ? endingPlanOf(id, this.store.assignments(), localDayKey(new Date())) : null;
  });

  /** The open sheet's cell, ringed on the board. */
  readonly selectedKey = computed(() =>
    this.sheetOpen() ? (this.picked()?.clientId ?? null) : null,
  );

  constructor() {
    addIcons(CLIENT_HIVE_ICONS);
  }

  ngOnInit(): void {
    this.store.load();
  }

  /** Back from a chat or a client page: someone may have trained or been given a plan. */
  ionViewWillEnter(): void {
    if (this._entered) this.store.load();
    this._entered = true;
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.load(() => void event.target.complete());
  }

  retry(): void {
    this.store.load();
  }

  setRange(value: unknown): void {
    const range = rangeFrom(value);
    if (range) this.store.setRange(range);
  }

  setFilter(filter: HiveFilter): void {
    this.filter.set(filter);
  }

  pick(key: string): void {
    const client = this.store.clients().find((one) => one.clientId === key);
    if (!client) return;
    this.picked.set(client);
    this.sheetOpen.set(true);
  }

  /** The invite page in Home's stack, so back returns to Home. */
  invite(): void {
    void this._router.navigateByUrl(HomePages.Invite);
  }
}
