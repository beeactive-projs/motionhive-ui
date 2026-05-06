import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, take } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import {
  DiscoverGroup,
  GroupService,
  GroupsRefreshService,
  JoinPolicies,
  joinPolicyLabel,
  joinPolicySeverity,
  showApiError,
} from 'core';

@Component({
  selector: 'mh-groups-discover',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    IconField,
    InputIcon,
    SkeletonModule,
    TagModule,
    ToastModule,
    TooltipModule,
  ],
  providers: [MessageService],
  templateUrl: './groups-discover.html',
  styleUrl: './groups-discover.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupsDiscover implements OnInit {
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _groupsRefreshService = inject(GroupsRefreshService);

  readonly JoinPolicies = JoinPolicies;
  readonly joinPolicyLabel = joinPolicyLabel;
  readonly joinPolicySeverity = joinPolicySeverity;

  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  readonly results = signal<DiscoverGroup[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly currentPage = signal(1);
  readonly pageSize = 20;
  readonly hasMore = computed(() => this.results().length < this.total());

  /** Track per-group action busy state so the button can show a spinner. */
  readonly busyGroupIds = signal<Set<string>>(new Set());

  private readonly _scrollSentinel =
    viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private _observer?: IntersectionObserver;

  constructor() {
    effect(() => {
      const el = this._scrollSentinel()?.nativeElement;
      this._observer?.disconnect();
      if (!el) return;
      this._observer = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            this.hasMore() &&
            !this.loadingMore() &&
            !this.loading()
          ) {
            this.loadMore();
          }
        },
        { threshold: 0.1 },
      );
      this._observer.observe(el);
    });
    this._destroyRef.onDestroy(() => this._observer?.disconnect());
  }

  ngOnInit(): void {
    this.load();
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this.load());
  }

  load(): void {
    this.loading.set(true);
    this.currentPage.set(1);
    this._groupService
      .discoverGroups({
        search: this.searchControl.value || undefined,
        page: 1,
        limit: this.pageSize,
      })
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          this.results.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          showApiError(this._messageService, 'Could not load groups', '', err);
        },
      });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const nextPage = this.currentPage() + 1;
    this._groupService
      .discoverGroups({
        search: this.searchControl.value || undefined,
        page: nextPage,
        limit: this.pageSize,
      })
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          const seen = new Set(this.results().map((g) => g.id));
          const fresh = res.items.filter((g) => !seen.has(g.id));
          this.results.update((list) => [...list, ...fresh]);
          this.total.set(res.total);
          this.currentPage.set(nextPage);
          this.loadingMore.set(false);
        },
        error: (err) => {
          this.loadingMore.set(false);
          showApiError(
            this._messageService,
            'Could not load more groups',
            '',
            err,
          );
        },
      });
  }

  isBusy(groupId: string): boolean {
    return this.busyGroupIds().has(groupId);
  }

  private setBusy(groupId: string, busy: boolean): void {
    this.busyGroupIds.update((set) => {
      const next = new Set(set);
      if (busy) next.add(groupId);
      else next.delete(groupId);
      return next;
    });
  }

  join(group: DiscoverGroup): void {
    if (this.isBusy(group.id)) return;
    this.setBusy(group.id, true);

    this._groupService.selfJoin(group.id).subscribe({
      next: (result) => {
        this.setBusy(group.id, false);
        if (result.status === 'JOINED') {
          // Member groups don't belong in Discover — drop the card.
          this.results.update((list) => list.filter((g) => g.id !== group.id));
          this.total.update((n) => Math.max(0, n - 1));
          this._messageService.add({
            severity: 'success',
            summary: 'Joined',
            detail: `You're now a member of "${group.name}".`,
          });
          this._groupsRefreshService.notify();
        } else {
          // PENDING — flip the card to "Request pending" without removing it.
          this.results.update((list) =>
            list.map((g) =>
              g.id === group.id ? { ...g, myJoinRequestStatus: 'PENDING' } : g,
            ),
          );
          this._messageService.add({
            severity: 'info',
            summary: 'Request sent',
            detail: 'The owner will review your request to join.',
          });
        }
      },
      error: (err) => {
        this.setBusy(group.id, false);
        showApiError(this._messageService, 'Could not join group', '', err);
      },
    });
  }

  cancelRequest(group: DiscoverGroup): void {
    if (this.isBusy(group.id)) return;
    this.setBusy(group.id, true);
    this._groupService.cancelMyJoinRequest(group.id).subscribe({
      next: () => {
        this.setBusy(group.id, false);
        this.results.update((list) =>
          list.map((g) =>
            g.id === group.id ? { ...g, myJoinRequestStatus: null } : g,
          ),
        );
        this._messageService.add({
          severity: 'success',
          summary: 'Request cancelled',
          detail: '',
        });
      },
      error: (err) => {
        this.setBusy(group.id, false);
        showApiError(this._messageService, 'Could not cancel request', '', err);
      },
    });
  }

  openGroup(group: DiscoverGroup): void {
    this._router.navigate(['/groups/preview', group.id]);
  }

  descriptionExcerpt(description: string | null): string {
    if (!description) return 'No description';
    return description.length > 120
      ? description.substring(0, 120) + '...'
      : description;
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
