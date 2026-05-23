import { Injectable, computed, inject, signal } from '@angular/core';
import {
  EMPTY as RX_EMPTY,
  Observable,
  catchError,
  expand,
  forkJoin,
  map,
  of,
  reduce,
  tap,
} from 'rxjs';
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
  /**
   * If a reload comes in while one is already in flight, we mark this
   * flag so the in-flight handler re-fires after it completes. Without
   * this, post-save reloads were getting silently swallowed when the
   * user opened+saved the create dialog faster than the initial page
   * load returned. Also prevents redundant duplicate calls — multiple
   * reload() calls collapse to at most one queued follow-up.
   */
  private _pendingReload = false;

  // BE `tab=cancelled` only matches templates with status=CANCELLED, so
  // one-off cancellations wouldn't appear. We fetch cancelled INSTANCES
  // separately and render them directly under the Cancelled tab.
  private readonly _cancelledInstances = signal<SessionInstance[]>([]);
  /** Raw server-reported total for the cancelled-instances window. */
  private readonly _cancelledTotal = signal<number>(0);

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
  readonly cancelledTotal = this._cancelledTotal.asReadonly();
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

  /**
   * All upcoming SCHEDULED instances within the visible window,
   * client-side filtered by the user's pill state, sorted ASC by
   * startAt. Used by the Upcoming list to render chronologically —
   * bypasses the templates-list pagination and the `firstStartAt
   * DESC` BE sort that put long-running fixtures on top of "what's
   * happening this week".
   *
   * The dedupe to ONE instance per template (earliest) lives in the
   * map setter — each template surfaces as a single "next" row.
   */
  readonly upcomingInstances = computed<SessionInstance[]>(() => {
    const map = this._nextInstancesByTemplateId();
    const f = this._filters();
    const out: SessionInstance[] = [];
    for (const inst of map.values()) {
      if (!inst) continue;
      if (inst.status !== 'SCHEDULED') continue;
      const tpl = inst.template;
      if (tpl) {
        if (f.type && tpl.type !== f.type) continue;
        if (f.locationKind && tpl.locationKind !== f.locationKind) continue;
      }
      if (f.q) {
        const q = f.q.toLowerCase();
        const title = (inst.titleOverride ?? tpl?.title ?? '').toLowerCase();
        if (!title.includes(q)) continue;
      }
      out.push(inst);
    }
    return out.sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
  });

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
    if (this._loading()) {
      // A request is already in flight. Mark a follow-up reload so
      // the just-saved template doesn't get swallowed. Append-mode
      // reloads (infinite scroll) intentionally skip — the next page
      // request will re-fire on its own scroll trigger.
      if (!append) this._pendingReload = true;
      return;
    }
    this._loading.set(true);
    this._error.set(null);

    const templatesQuery: ListTemplatesQuery = {
      tab: this._tab(),
      ...this._filters(),
      page: this._page(),
      limit: this._pageSize(),
    };

    const now = new Date();
    // Use start-of-today (not "now") as the dateFrom cutoff so a
    // session created at 10:15 with start=10:00 doesn't disappear
    // from the list because its single occurrence is technically in
    // the past by 15 minutes. The session card itself surfaces the
    // actual start time so the user sees the chronology either way.
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const instancesQuery: ListInstancesQuery = {
      dateFrom: startOfToday.toISOString(),
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
      // Instances paged: an instructor with 200+ scheduled sessions
      // in the visible window was losing the tail (BE caps limit=100
      // per request). Cap at 3 pages = 300 instances. Beyond that the
      // user is well past "this week's plan" and won't notice missing
      // far-future rows in the list summary.
      instances: this._loadInstancesPaged(instancesQuery, 3),
      cancelled: onCancelled
        ? this._loadInstancesPaged(cancelledQuery, 3)
        : of({ items: [] as SessionInstance[], total: 0 }),
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
        this._cancelledTotal.set(cancelled.total);

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
      complete: () => {
        this._loading.set(false);
        // Flush a queued reload if one was requested mid-flight
        // (e.g. user saved a new template before the initial load
        // settled). Reset the flag BEFORE re-calling reload so a
        // second concurrent save doesn't double-fire.
        if (this._pendingReload) {
          this._pendingReload = false;
          this.reload();
        }
      },
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

  /**
   * Fetch /sessions/instances paged until either the BE reports no
   * more pages OR we hit `maxPages` (safety cap). The BE limit caps
   * at 100 per request, so 3 pages = up to 300 instances. Enough for
   * the 14-day instructor list window — beyond that the instructor's
   * "what's next" surface stops being a useful summary.
   *
   * Returns `{items, total}` for use by callers — same shape whether
   * we hit 1 page or several.
   */
  private _loadInstancesPaged(
    base: ListInstancesQuery,
    maxPages: number,
  ): Observable<{ items: SessionInstance[]; total: number }> {
    const limit = base.limit ?? 100;
    type Page = {
      items: SessionInstance[];
      total: number;
      page: number;
      pageSize: number;
    };

    return this._service.listInstances({ ...base, page: 1, limit }).pipe(
      // expand recursively projects until the inner observable is
      // EMPTY (the rxjs terminator). That way the page-1 result + any
      // follow-up pages all flow through `reduce` exactly once.
      expand((res: Page) => {
        const fetched = (res.page ?? 1) * limit;
        const hasMore = fetched < (res.total ?? 0);
        const nextPage = (res.page ?? 1) + 1;
        if (!hasMore || nextPage > maxPages) return RX_EMPTY;
        return this._service.listInstances({
          ...base,
          page: nextPage,
          limit,
        }) as Observable<Page>;
      }),
      reduce<Page, { items: SessionInstance[]; total: number }>(
        (acc, res) => ({
          items: [...acc.items, ...res.items],
          total: res.total ?? acc.total,
        }),
        { items: [], total: 0 },
      ),
      catchError(() => of({ items: [] as SessionInstance[], total: 0 })),
    );
  }
}
