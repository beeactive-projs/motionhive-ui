import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  InfiniteScrollCustomEvent,
  IonAvatar,
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  SegmentCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, funnelOutline, peopleOutline } from 'ionicons/icons';
import { take } from 'rxjs';

import {
  ClientRequestTypes,
  ClientService,
  ClientStatusLabels,
  InstructorClient,
  InstructorClientStatus,
  InstructorClientStatuses,
  PendingClientLabels,
} from 'core';

@Component({
  selector: 'mh-clients',
  imports: [
    DatePipe,
    IonAvatar,
    IonBadge,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './clients.html',
  styleUrl: './clients.scss',
})
export class Clients implements OnInit {
  private readonly _clientService = inject(ClientService);

  readonly Statuses = InstructorClientStatuses;
  /** Segment sentinel for the unfiltered view — ion-segment needs a concrete value. */
  readonly AllFilter = 'ALL';

  private readonly _pageSize = 20;
  private _page = 1;

  readonly clients = signal<InstructorClient[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly statusFilter = signal<InstructorClientStatus | undefined>(undefined);

  readonly hasMore = computed(() => this.clients().length < this.total());

  constructor() {
    addIcons({ alertCircleOutline, funnelOutline, peopleOutline });
  }

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.fetchPage(1);
  }

  onStatusFilterChange(event: SegmentCustomEvent): void {
    const value = event.detail.value;
    this.statusFilter.set(
      value === this.AllFilter ? undefined : (value as InstructorClientStatus),
    );
    this.loadClients();
  }

  clearFilter(): void {
    this.statusFilter.set(undefined);
    this.loadClients();
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.loadError.set(false);
    this.fetchPage(1, () => event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    if (this.loading() || !this.hasMore()) {
      event.target.complete();
      return;
    }
    this.fetchPage(this._page + 1, () => event.target.complete());
  }

  private fetchPage(page: number, done?: () => void): void {
    this._clientService
      .getClients({ status: this.statusFilter(), page, limit: this._pageSize })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.clients.update((list) =>
            page === 1 ? response.items : [...list, ...response.items],
          );
          this.total.set(response.total);
          this._page = page;
          this.loading.set(false);
          done?.();
        },
        error: () => {
          if (page === 1) this.loadError.set(true);
          this.loading.set(false);
          done?.();
        },
      });
  }

  // --- Display helpers (mirrors web clients page) ---

  clientName(client: InstructorClient): string {
    if (client.client) {
      return `${client.client.firstName} ${client.client.lastName}`;
    }
    return client.invitedEmail ?? 'This client';
  }

  clientEmail(client: InstructorClient): string {
    return client.client?.email || client.invitedEmail || '—';
  }

  clientInitials(client: InstructorClient): string {
    const user = client.client;
    if (user) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    return (client.invitedEmail?.charAt(0) ?? '?').toUpperCase();
  }

  clientStatusLabel(client: InstructorClient): string {
    if (client.status !== InstructorClientStatuses.Pending) {
      return ClientStatusLabels[client.status];
    }
    if (client.requestType === ClientRequestTypes.InstructorToClient) {
      return client.client ? PendingClientLabels.Invited : PendingClientLabels.EmailSent;
    }
    return PendingClientLabels.Request;
  }

  statusColor(status: InstructorClientStatus): 'success' | 'warning' | 'danger' {
    switch (status) {
      case InstructorClientStatuses.Active:
        return 'success';
      case InstructorClientStatuses.Archived:
        return 'danger';
      case InstructorClientStatuses.Pending:
        return 'warning';
    }
  }
}
