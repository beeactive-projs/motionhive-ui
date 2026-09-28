import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import {
  DiscoverFilters,
  DiscoverGroup,
  GroupService,
  InstructorSearchResult,
  JoinPolicies,
  ProfileService,
  Hex,
  HexTone,
  PublicSessionInstance,
  SessionLocationKind,
  SessionsDiscoverStore,
  SessionType,
  showApiError,
} from 'core';
import { SessionCard } from '../../_shared/components/session-card/session-card';

type DiscoverTab = 'coaches' | 'sessions' | 'groups';

const TONES: HexTone[] = ['amber', 'teal', 'navySolid', 'coral'];

/** Coach refine chip. `value` is matched against the (free-text, English)
 *  specializations, so it stays untranslated; `labelKey` is what's shown. */
interface CoachChip {
  value: string;
  labelKey: string;
}

/** Session refine chip — `filters` is what the chip applies to the store. */
interface SessionChip {
  id: string;
  labelKey: string;
  filters: Pick<DiscoverFilters, 'type' | 'locationKind'>;
}

const ALL_CHIP = 'all';

const COACH_CHIPS: CoachChip[] = [
  { value: ALL_CHIP, labelKey: 'common.all' },
  { value: 'Strength', labelKey: 'discover.coaches.chips.strength' },
  { value: 'Mobility', labelKey: 'discover.coaches.chips.mobility' },
  { value: 'Boxing', labelKey: 'discover.coaches.chips.boxing' },
  { value: 'Yoga', labelKey: 'discover.coaches.chips.yoga' },
  { value: 'HIIT', labelKey: 'discover.coaches.chips.hiit' },
  { value: 'Pilates', labelKey: 'discover.coaches.chips.pilates' },
];

const SESSION_CHIPS: SessionChip[] = [
  {
    id: ALL_CHIP,
    labelKey: 'common.all',
    filters: { type: undefined, locationKind: undefined },
  },
  {
    id: 'online',
    labelKey: 'enum.sessionLocationKind.ONLINE',
    filters: { locationKind: SessionLocationKind.Online, type: undefined },
  },
  {
    id: 'inPerson',
    labelKey: 'enum.sessionLocationKind.IN_PERSON',
    filters: { locationKind: SessionLocationKind.InPerson, type: undefined },
  },
  {
    id: 'group',
    labelKey: 'enum.sessionType.GROUP',
    filters: { type: SessionType.Group, locationKind: undefined },
  },
  {
    id: 'private',
    labelKey: 'enum.sessionType.PRIVATE',
    filters: { type: SessionType.Private, locationKind: undefined },
  },
];

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
  imports: [FormsModule, Toast, Hex, SessionCard, TranslatePipe],
  providers: [MessageService, SessionsDiscoverStore],
  templateUrl: './discover.html',
  styleUrl: './discover.scss',
})
export class Discover implements OnInit {
  private readonly _profileService = inject(ProfileService);
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);

  protected readonly sessionsStore = inject(SessionsDiscoverStore);

  readonly tab = signal<DiscoverTab>('coaches');
  readonly query = signal('');

  // Per-tab refine chips.
  readonly coachChip = signal(ALL_CHIP);
  readonly sessionChip = signal(ALL_CHIP);
  readonly coachChips = COACH_CHIPS;
  readonly sessionChips = SESSION_CHIPS;

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
    if (chip === ALL_CHIP) return list;
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
        showApiError(
          this._messageService,
          this._translateService.instant('discover.toast.loadCoachesFailed'),
          '',
          err,
        );
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
    return (
      [c.city, c.country].filter(Boolean).join(', ') ||
      this._translateService.instant('discover.coaches.online')
    );
  }

  coachExperience(c: InstructorSearchResult): string {
    const count = c.yearsOfExperience ?? 0;
    return count > 0
      ? this._translateService.instant('discover.coaches.experience', { count })
      : this._translateService.instant('discover.coaches.newCoach');
  }

  toneFor(i: number): HexTone {
    return TONES[i % TONES.length];
  }

  viewCoach(c: InstructorSearchResult): void {
    if (c.handle) void this._router.navigate(['/@' + c.handle]);
  }

  // ── Sessions ─────────────────────────────────────────────────────
  onSessionChip(chip: SessionChip): void {
    this.sessionChip.set(chip.id);
    this.sessionsStore.setFilters(chip.filters);
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
          showApiError(
            this._messageService,
            this._translateService.instant('discover.toast.loadGroupsFailed'),
            '',
            err,
          );
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
            summary: this._translateService.instant('discover.toast.joined.summary'),
            detail: this._translateService.instant('discover.toast.joined.detail', {
              name: g.name,
            }),
          });
        } else {
          this.groups.update((list) =>
            list.map((x) =>
              x.id === g.id ? { ...x, myJoinRequestStatus: 'PENDING' } : x,
            ),
          );
          this._messageService.add({
            severity: 'info',
            summary: this._translateService.instant('toast.summary.requestSent'),
            detail: this._translateService.instant('discover.toast.requestSent.detail'),
          });
        }
      },
      error: (err) => {
        this.setGroupBusy(g.id, false);
        showApiError(
          this._messageService,
          this._translateService.instant('discover.toast.joinFailed'),
          '',
          err,
        );
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
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('toast.summary.requestCancelled'),
        });
      },
      error: (err) => {
        this.setGroupBusy(g.id, false);
        showApiError(
          this._messageService,
          this._translateService.instant('discover.toast.cancelFailed'),
          '',
          err,
        );
      },
    });
  }

  viewGroup(g: DiscoverGroup): void {
    void this._router.navigate(['/groups/preview', g.id]);
  }
}
