import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import {
  DiscoverGroup,
  GroupService,
  InstructorSearchResult,
  JoinPolicies,
  ProfileService,
  Hex,
  HexTone,
  PublicSessionInstance,
  SessionCard,
  SessionsDiscoverStore,
  showApiError,
} from 'core';

type DiscoverTab = 'coaches' | 'sessions' | 'groups';

const TONES: HexTone[] = ['amber', 'teal', 'navySolid', 'coral'];

/**
 * Discover — one hub for finding coaches, sessions and groups (Claude
 * Design "Find your people in the hive"). A shared search drives the
 * active tab; per-tab chips refine. Discovery is a *browse* surface:
 * the cards link into the existing detail pages where the real actions
 * live (coach → public profile, session → showcase/booking, group →
 * preview/join), so we don't duplicate book/join flows here.
 */
@Component({
  selector: 'mh-discover',
  imports: [FormsModule, Toast, Hex, SessionCard],
  providers: [MessageService, SessionsDiscoverStore],
  templateUrl: './discover.html',
  styleUrl: './discover.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Discover implements OnInit {
  private readonly _profileService = inject(ProfileService);
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);

  protected readonly sessionsStore = inject(SessionsDiscoverStore);

  readonly tab = signal<DiscoverTab>('coaches');
  readonly query = signal('');

  // Per-tab refine chips.
  readonly coachChip = signal('All');
  readonly sessionChip = signal('All');
  readonly coachChips = ['All', 'Strength', 'Mobility', 'Boxing', 'Yoga', 'HIIT', 'Pilates'];
  readonly sessionChips = ['All', 'Online', 'In-person', 'Group', '1-on-1'];

  readonly coaches = signal<InstructorSearchResult[]>([]);
  readonly groups = signal<DiscoverGroup[]>([]);
  readonly loadingCoaches = signal(false);
  readonly loadingGroups = signal(false);

  readonly JoinPolicies = JoinPolicies;
  /** Groups with an in-flight join/cancel request — disables their button. */
  readonly busyGroupIds = signal<Set<string>>(new Set());

  private _searchTimer?: ReturnType<typeof setTimeout>;

  /** Coaches filtered client-side by the active specialization chip. */
  readonly visibleCoaches = computed(() => {
    const chip = this.coachChip();
    const list = this.coaches();
    if (chip === 'All') return list;
    const needle = chip.toLowerCase();
    return list.filter((c) =>
      (c.specializations ?? []).some((s) => s.toLowerCase().includes(needle)),
    );
  });

  ngOnInit(): void {
    const tab = this._activatedRoute.snapshot.queryParamMap.get('tab');
    if (tab === 'coaches' || tab === 'sessions' || tab === 'groups') {
      this.tab.set(tab);
    }
    this.loadCoaches();
    this.sessionsStore.load();
    this.loadGroups();
  }

  setTab(tab: DiscoverTab): void {
    if (tab === this.tab()) return;
    this.tab.set(tab);
  }

  onSearch(value: string): void {
    this.query.set(value);
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      const q = value.trim();
      switch (this.tab()) {
        case 'coaches':
          this.loadCoaches(q);
          break;
        case 'sessions':
          this.sessionsStore.setFilters({ q: q || undefined });
          break;
        case 'groups':
          this.loadGroups(q);
          break;
      }
    }, 300);
  }

  // ── Coaches ──────────────────────────────────────────────────────
  private loadCoaches(q?: string): void {
    this.loadingCoaches.set(true);
    this._profileService.discoverInstructors(q || undefined).subscribe({
      next: (list) => {
        this.coaches.set(list);
        this.loadingCoaches.set(false);
      },
      error: (err) => {
        this.loadingCoaches.set(false);
        showApiError(this._messageService, 'Could not load coaches', '', err);
      },
    });
  }

  coachName(c: InstructorSearchResult): string {
    return c.displayName?.trim() || `${c.firstName} ${c.lastName}`.trim();
  }

  coachInitials(c: InstructorSearchResult): string {
    return `${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase();
  }

  coachLocation(c: InstructorSearchResult): string {
    return [c.city, c.country].filter(Boolean).join(', ') || 'Online';
  }

  coachExperience(c: InstructorSearchResult): string {
    const y = c.yearsOfExperience ?? 0;
    return y > 0 ? `${y} yr${y === 1 ? '' : 's'} experience` : 'New coach';
  }

  toneFor(i: number): HexTone {
    return TONES[i % TONES.length];
  }

  viewCoach(c: InstructorSearchResult): void {
    if (c.handle) void this._router.navigate(['/@' + c.handle]);
  }

  // ── Sessions ─────────────────────────────────────────────────────
  onSessionChip(chip: string): void {
    this.sessionChip.set(chip);
    switch (chip) {
      case 'Online':
        this.sessionsStore.setFilters({ locationKind: 'ONLINE', type: undefined });
        break;
      case 'In-person':
        this.sessionsStore.setFilters({ locationKind: 'IN_PERSON', type: undefined });
        break;
      case 'Group':
        this.sessionsStore.setFilters({ type: 'GROUP', locationKind: undefined });
        break;
      case '1-on-1':
        this.sessionsStore.setFilters({ type: 'PRIVATE', locationKind: undefined });
        break;
      default:
        this.sessionsStore.setFilters({ type: undefined, locationKind: undefined });
    }
  }

  openSession(instance: PublicSessionInstance): void {
    void this._router.navigate(['/user/sessions', instance.id]);
  }

  // ── Groups ───────────────────────────────────────────────────────
  private loadGroups(q?: string): void {
    this.loadingGroups.set(true);
    this._groupService
      .discoverGroups({ search: q || undefined, page: 1, limit: 24 })
      .subscribe({
        next: (res) => {
          this.groups.set(res.items);
          this.loadingGroups.set(false);
        },
        error: (err) => {
          this.loadingGroups.set(false);
          showApiError(this._messageService, 'Could not load groups', '', err);
        },
      });
  }

  groupInitials(name: string): string {
    return name.slice(0, 2).toUpperCase();
  }

  isGroupBusy(id: string): boolean {
    return this.busyGroupIds().has(id);
  }

  private setGroupBusy(id: string, busy: boolean): void {
    this.busyGroupIds.update((set) => {
      const next = new Set(set);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Open group → instant join; approval group → request to join. */
  joinOrRequest(g: DiscoverGroup): void {
    if (this.isGroupBusy(g.id)) return;
    this.setGroupBusy(g.id, true);
    this._groupService.selfJoin(g.id).subscribe({
      next: (res) => {
        this.setGroupBusy(g.id, false);
        if (res.status === 'JOINED') {
          // Now a member — it belongs in "Your groups", drop from Discover.
          this.groups.update((list) => list.filter((x) => x.id !== g.id));
          this._messageService.add({
            severity: 'success',
            summary: 'Joined',
            detail: `You're now a member of "${g.name}".`,
          });
        } else {
          this.groups.update((list) =>
            list.map((x) =>
              x.id === g.id ? { ...x, myJoinRequestStatus: 'PENDING' } : x,
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
        this.setGroupBusy(g.id, false);
        showApiError(this._messageService, 'Could not join group', '', err);
      },
    });
  }

  cancelGroupRequest(g: DiscoverGroup): void {
    if (this.isGroupBusy(g.id)) return;
    this.setGroupBusy(g.id, true);
    this._groupService.cancelMyJoinRequest(g.id).subscribe({
      next: () => {
        this.setGroupBusy(g.id, false);
        this.groups.update((list) =>
          list.map((x) =>
            x.id === g.id ? { ...x, myJoinRequestStatus: null } : x,
          ),
        );
        this._messageService.add({ severity: 'success', summary: 'Request cancelled' });
      },
      error: (err) => {
        this.setGroupBusy(g.id, false);
        showApiError(this._messageService, 'Could not cancel request', '', err);
      },
    });
  }

  viewGroup(g: DiscoverGroup): void {
    void this._router.navigate(['/groups/preview', g.id]);
  }
}
