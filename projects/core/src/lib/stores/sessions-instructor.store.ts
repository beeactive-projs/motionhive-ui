import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, of, tap } from 'rxjs';
import { SessionService } from '../services/session/session.service';
import { apiErrorMessage } from '../utils/api-error.utils';
import { DateWindowsMs } from '../constants/date-windows.const';
import type {
  ListInstancesQuery,
  ListTemplatesQuery,
  SessionInstance,
  SessionTemplate,
} from '../models/session/session.model';
import type {
  SessionAccess,
  SessionLocationKind,
  SessionType,
  TemplateTab,
} from '../models/session/session.enums';

/**
 * Instructor-side sessions store — backs the SessionsList page and the
 * SessionsCalendar page (the latter via `rangeInstances` + `loadRange`).
 */

export interface InstructorFilters {
  q?: string;
  type?: SessionType;
  access?: SessionAccess;
  locationKind?: SessionLocationKind;
  groupId?: string;
}

@Injectable({ providedIn: 'root' })
export class SessionsInstructorStore {
  private readonly _service = inject(SessionService);

  // ─── State signals ─────────────────────────────────────────────────

  private readonly _templates = signal<SessionTemplate[]>([]);
  private readonly _total = signal<number>(0);
  private readonly _nextInstancesByTemplateId = signal<
    Map<string, SessionInstance | null>
  >(new Map());
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _tab = signal<TemplateTab>('active');
  private readonly _filters = signal<InstructorFilters>({});
  private readonly _page = signal<number>(1);
  private readonly _pageSize = signal<number>(20);

  // BE `tab=cancelled` only matches templates with status=CANCELLED, so
  // one-off cancellations wouldn't appear. We fetch cancelled INSTANCES
  // separately and render them directly under the Cancelled tab.
  private readonly _cancelledInstances = signal<SessionInstance[]>([]);

  // Calendar-only state (separate from the list state so the two pages
  // don't trample each other when used in the same session).
  private readonly _rangeInstances = signal<SessionInstance[]>([]);
  private readonly _rangeLoading = signal<boolean>(false);
  private readonly _rangeError = signal<string | null>(null);
  /** Cache of last-3-loaded ranges, LRU keyed by `start.getTime()`. */
  private readonly _rangeCache = new Map<string, SessionInstance[]>();
  private static readonly RANGE_CACHE_MAX = 3;

  // ─── Public readonly signals ───────────────────────────────────────

  readonly templates = this._templates.asReadonly();
  readonly total = this._total.asReadonly();
  readonly cancelledInstances = this._cancelledInstances.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly tab = this._tab.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly page = this._page.asReadonly();
  readonly pageSize = this._pageSize.asReadonly();

  /** True when the local list has fewer items than the server reports. */
  readonly hasMore = computed(
    () => this._templates().length < this._total(),
  );
  // Calendar-only
  readonly rangeInstances = this._rangeInstances.asReadonly();
  readonly rangeLoading = this._rangeLoading.asReadonly();
  readonly rangeError = this._rangeError.asReadonly();

  /** Computed: returns the matching next instance for a template id. */
  readonly nextInstanceFor = (templateId: string): SessionInstance | null =>
    this._nextInstancesByTemplateId().get(templateId) ?? null;

  /** Computed: KPIs derived locally from templates + instances. */
  readonly kpis = computed(() => {
    const templates = this._templates();
    const sevenDaysFromNow = Date.now() + 7 * 86_400_000;
    const instances = Array.from(this._nextInstancesByTemplateId().values())
      .filter((i): i is SessionInstance => i != null);
    const thisWeek = instances.filter(
      (i) => new Date(i.startAt).getTime() < sevenDaysFromNow,
    );
    const totalSignups = instances.reduce(
      (sum, i) => sum + i.confirmedCount + i.pendingApprovalCount,
      0,
    );
    const recurring = templates.filter((t) => t.isRecurring).length;
    const needsAttention =
      instances.filter((i) => (i.conflictingInstanceIds?.length ?? 0) > 0)
        .length +
      instances.reduce((sum, i) => sum + i.pendingApprovalCount, 0);
    return {
      thisWeek: thisWeek.length,
      totalSignups,
      recurring,
      needsAttention,
    };
  });

  // ─── Mutators (called by pages) ────────────────────────────────────

  setTab(tab: TemplateTab): void {
    if (this._tab() === tab) return;
    this._tab.set(tab);
    this._page.set(1);
    this.reload();
  }

  setFilters(patch: Partial<InstructorFilters>): void {
    this._filters.set({ ...this._filters(), ...patch });
    this._page.set(1);
    this.reload();
  }

  setPage(page: number): void {
    this._page.set(page);
    this.reload();
  }

  /** Append the next page (no-op when already loading or nothing more). */
  loadMore(): void {
    if (!this.hasMore() || this._loading()) return;
    this._page.set(this._page() + 1);
    this.reload(/* append */ true);
  }

  // ─── Load ──────────────────────────────────────────────────────────

  // forkJoin templates + next-instances so `loading` flips off only after
  // BOTH complete (avoids a flash of "0 signups" cards mid-fetch).
  reload(append = false): void {
    if (this._loading()) return;
    this._loading.set(true);
    this._error.set(null);

    const templatesQuery: ListTemplatesQuery = {
      tab: this._tab(),
      ...this._filters(),
      page: this._page(),
      limit: this._pageSize(),
    };

    const now = new Date();
    const instancesQuery: ListInstancesQuery = {
      dateFrom: now.toISOString(),
      dateTo: new Date(now.getTime() + DateWindowsMs.InstructorListAhead).toISOString(),
      status: 'SCHEDULED',
      limit: 100,
    };

    // When the user is on the Cancelled tab, fetch cancelled INSTANCES
    // (last 90 days through next 30) so we can show them as cards directly.
    // Other tabs ignore this signal.
    const onCancelled = this._tab() === 'cancelled';
    const cancelledQuery: ListInstancesQuery = {
      dateFrom: new Date(now.getTime() - DateWindowsMs.CancelledLookback).toISOString(),
      dateTo: new Date(now.getTime() + DateWindowsMs.CancelledLookahead).toISOString(),
      status: 'CANCELLED',
      limit: 100,
    };

    forkJoin({
      templates: this._service.listTemplates(templatesQuery).pipe(
        catchError((err: unknown) => {
          this._error.set(apiErrorMessage(err, 'Could not load sessions'));
          return of({ items: [], total: 0, page: 1, pageSize: 20 });
        }),
      ),
      // Instances are best-effort — if they fail we still render the
      // templates list, just without next-instance summaries.
      instances: this._service.listInstances(instancesQuery).pipe(
        catchError(() => of({ items: [], total: 0, page: 1, pageSize: 100 })),
      ),
      cancelled: onCancelled
        ? this._service.listInstances(cancelledQuery).pipe(
            catchError(() => of({ items: [], total: 0, page: 1, pageSize: 100 })),
          )
        : of({ items: [], total: 0, page: 1, pageSize: 100 }),
    }).subscribe({
      next: ({ templates, instances, cancelled }) => {
        // Pagination: page 1 replaces, subsequent pages append. The
        // setTab/setFilters/setPage mutators reset `_page` to 1 so
        // filter changes ALWAYS take the replace branch even with
        // `append=true` semantically — guard on actual page here.
        this._templates.set(
          append && this._page() > 1
            ? [...this._templates(), ...templates.items]
            : templates.items,
        );
        this._total.set(templates.total);
        this._cancelledInstances.set(cancelled.items);

        // Index by template id, keeping the EARLIEST scheduled instance.
        // On append, merge into the existing map so first-page items
        // keep their next-instance references.
        const map = append
          ? new Map(this._nextInstancesByTemplateId())
          : new Map<string, SessionInstance>();
        for (const inst of instances.items) {
          const existing = map.get(inst.templateId);
          if (
            !existing ||
            new Date(inst.startAt) < new Date(existing.startAt)
          ) {
            map.set(inst.templateId, inst);
          }
        }
        this._nextInstancesByTemplateId.set(map);
      },
      complete: () => this._loading.set(false),
      // No `error` handler — both inner streams already swallow errors
      // and surface them via `this._error`.
    });
  }

  // ─── Calendar — range-based fetch ──────────────────────────────────

  /**
   * Load all instances within a date range for the calendar.
   *
   * Uses a small LRU cache keyed by `range.start.getTime()` — the user
   * navigates back and forth, we don't want to refetch every time. Cache
   * holds up to 3 ranges; oldest is evicted.
   *
   * On error, surfaces via `rangeError` and clears the visible set.
   */
  loadRange(range: { start: Date; end: Date }): void {
    if (this._rangeLoading()) return;
    // Key on BOTH bounds — week vs day on the same Monday would otherwise share an entry.
    const key = `${range.start.getTime()}-${range.end.getTime()}`;

    // Cache hit?
    const cached = this._rangeCache.get(key);
    if (cached) {
      this._rangeInstances.set(cached);
      this._rangeError.set(null);
      return;
    }

    this._rangeLoading.set(true);
    this._rangeError.set(null);
    // BE caps limit=100 — pathological weeks may overflow; accept until a paginated calendar endpoint exists.
    this._service
      .listInstances({
        dateFrom: range.start.toISOString(),
        dateTo: range.end.toISOString(),
        // Calendar is a "what's on" view — cancelled instances live on the Cancelled tab.
        status: 'SCHEDULED',
        limit: 100,
      })
      .pipe(
        tap((res) => {
          this._rangeInstances.set(res.items);
          // LRU bookkeeping
          this._rangeCache.set(key, res.items);
          while (this._rangeCache.size > SessionsInstructorStore.RANGE_CACHE_MAX) {
            const firstKey = this._rangeCache.keys().next().value;
            if (firstKey !== undefined) this._rangeCache.delete(firstKey);
          }
        }),
        catchError((err: unknown) => {
          this._rangeError.set(apiErrorMessage(err, 'Could not load sessions'));
          this._rangeInstances.set([]);
          return of(null);
        }),
      )
      .subscribe({
        complete: () => this._rangeLoading.set(false),
      });
  }

  /**
   * Optimistically prepend an instance to the current range cache so
   * the calendar shows it immediately. Caller should `loadRange` again
   * after the server confirms (the server-returned instance has the
   * real id + counters).
   */
  prependInstanceOptimistic(instance: SessionInstance): void {
    this._rangeInstances.set([instance, ...this._rangeInstances()]);
  }

  /** Drop an optimistically-added instance if the server-side failed. */
  removeInstance(instanceId: string): void {
    this._rangeInstances.set(
      this._rangeInstances().filter((i) => i.id !== instanceId),
    );
  }

}
