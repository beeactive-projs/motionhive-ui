import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRouterOutlet,
  IonSearchbar,
  IonToolbar,
  NavController,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  AuthStore,
  CategoryStore,
  DiscoverGroup,
  GroupService,
  GroupsRefreshService,
  InstructorSearchResult,
  MyBookingsIndexStore,
  PublicSessionInstance,
  SelfJoinResult,
  translate,
  withCategorySpecialties,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { RowSkeleton } from '../../../_shared/components/row-skeleton/row-skeleton';
import { SearchbarAutofocusDirective } from '../../../_shared/directives/searchbar-autofocus.directive';
import { SearchbarLabelDirective } from '../../../_shared/directives/searchbar-label.directive';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { GROUP_AVATAR_TONE, avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { CoachRow } from '../_components/coach-row/coach-row';
import { DiscoverGroupRow } from '../_components/group-row/group-row';
import { SessionResultRow } from '../_components/session-result-row/session-result-row';
import {
  DISCOVER_ICONS,
  DiscoverRecent,
  DiscoverTopic,
  GroupVerb,
  RecentKinds,
  SEARCH_KIND_OPTIONS,
  SearchKind,
  SearchKinds,
  accentVariant,
  browseTopics,
  coachMatchesTopic,
  coachName,
  coachSubline,
  discoverLinks,
  discoverTitle,
  groupMatchesTopic,
  groupVerb,
  recentKey,
  sessionMatchesTopic,
  sortCoaches,
  withoutReader,
} from '../discover.config';
import { ACTIVITY_ICONS } from '../../../_shared/config/category-icons.config';
import { OnboardingStateService } from '../../../_shared/services/onboarding-state.service';
import { DiscoverPrefs } from '../discover-prefs';
import { DiscoverCoachesStore, DiscoverGroupsStore, DiscoverUpcomingStore } from '../discover.store';
import { injectDiscoverSearch } from './discover-search';

/** What the screen is showing. */
const SearchModes = {
  /** Nothing typed, no topic: Recent, Browse by activity, the privacy line. */
  Start: 'start',
  /** Something typed, too short to send. */
  Short: 'short',
  /** The server's answer to what was typed. */
  Query: 'query',
  /** A topic from Browse by activity, matched on the phone. */
  Topic: 'topic',
} as const;

type SearchMode = (typeof SearchModes)[keyof typeof SearchModes];

/**
 * Discover's search, after the canvas design (3b, 3c): the field with its
 * caret already in it and Cancel; before anything is typed, Recent and
 * Browse by activity; then coaches, groups and sessions in three labelled
 * flat lists with chips to narrow them, the matched part marked (accents
 * aside, as the server matches them) and a group's Join beside its row.
 *
 * Mounted in Discover (`/tabs/discover/search`) and in Home
 * (`/tabs/home/search`): every row opens in the stack the screen is in, so
 * back returns here, and Cancel returns to whatever opened it.
 */
@Component({
  selector: 'mh-discover-search-page',
  imports: [
    CoachRow,
    DiscoverGroupRow,
    EmptyState,
    HexAvatar,
    IonButton,
    IonButtons,
    IonCard,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    IonToolbar,
    RowSkeleton,
    SearchbarAutofocusDirective,
    SearchbarLabelDirective,
    SessionResultRow,
    TranslatePipe,
  ],
  templateUrl: './discover-search-page.html',
  styleUrl: './discover-search-page.scss',
  host: { class: 'mh-whole-words' },
  providers: [DiscoverCoachesStore, DiscoverGroupsStore, DiscoverUpcomingStore],
})
export class DiscoverSearchPage implements ViewWillEnter {
  readonly search = injectDiscoverSearch();
  private readonly _coachesStore = inject(DiscoverCoachesStore);
  private readonly _groupsStore = inject(DiscoverGroupsStore);
  private readonly _upcomingStore = inject(DiscoverUpcomingStore);
  private readonly _categoryStore = inject(CategoryStore);
  private readonly _onboarding = inject(OnboardingStateService);
  private readonly _prefs = inject(DiscoverPrefs);
  private readonly _authStore = inject(AuthStore);
  private readonly _myBookingsIndexStore = inject(MyBookingsIndexStore);
  private readonly _groupService = inject(GroupService);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _router = inject(Router);
  private readonly _navController = inject(NavController);
  private readonly _outlet = inject(IonRouterOutlet, { optional: true });

  /** Read once: the stack this screen was pushed onto never changes. */
  private readonly _links = discoverLinks(this._router.url);

  readonly Modes = SearchModes;
  readonly Kinds = SearchKinds;
  readonly RecentKinds = RecentKinds;
  readonly kindOptions = SEARCH_KIND_OPTIONS;
  /**
   * "Browse by activity": For you when the reader picked some, every
   * activity on the list, then Online (`browseTopics`). The lists behind
   * them load only once one is opened, so every activity is offered.
   */
  readonly browse = computed<DiscoverTopic[]>(() =>
    browseTopics(this._categoryStore.activities(), this._onboarding.interestIds()),
  );

  /** The topic the results are narrowed to, from a browse card. */
  readonly topic = signal<DiscoverTopic | null>(null);
  readonly kind = signal<SearchKind>(SearchKinds.All);
  /** The group whose Join is on its way. */
  readonly busyGroupId = signal<string | null>(null);
  /** Groups asked to join (approval) or joined from this screen. */
  private readonly _asked = signal<ReadonlySet<string>>(new Set());
  private readonly _joined = signal<ReadonlySet<string>>(new Set());

  constructor() {
    addIcons({ ...DISCOVER_ICONS, ...ACTIVITY_ICONS });
  }

  ionViewWillEnter(): void {
    this._myBookingsIndexStore.ensureLoaded();
    this._categoryStore.ensureLoaded();
    void this._onboarding.ensureLoaded();
  }

  // ─── Mode ───────────────────────────────────────────────────────────────

  readonly mode = computed<SearchMode>(() => {
    if (this.search.isActive()) return SearchModes.Query;
    if (this.search.query().trim()) return SearchModes.Short;
    if (this.topic()) return SearchModes.Topic;
    return SearchModes.Start;
  });

  readonly topicLabel = computed(() => this.topic()?.label ?? '');

  // ─── Results ────────────────────────────────────────────────────────────

  private readonly _readerId = computed(() => this._authStore.user()?.id ?? null);

  readonly coaches = computed<InstructorSearchResult[]>(() => {
    const me = this._readerId();
    switch (this.mode()) {
      case SearchModes.Query: {
        // Mapped as Discover's own list is (`DiscoverCoachesStore.coaches`):
        // a coach who picked categories and wrote none reads them instead.
        const byId = this._categoryStore.byId();
        return withoutReader(this.search.coaches(), me).map((coach) =>
          withCategorySpecialties(coach, byId),
        );
      }
      case SearchModes.Topic:
        return sortCoaches(
          withoutReader(this._coachesStore.coaches(), me).filter((coach) =>
            coachMatchesTopic(coach, this.topic()),
          ),
        );
      default:
        return [];
    }
  });

  readonly groups = computed<DiscoverGroup[]>(() => {
    const asked = this._asked();
    const source =
      this.mode() === SearchModes.Query
        ? this.search.groups()
        : this.mode() === SearchModes.Topic
          ? this._groupsStore.groups().filter((group) => groupMatchesTopic(group, this.topic()))
          : [];
    // A request sent from this screen shows as one, as the server will say
    // on the next search.
    return source.map((group) =>
      asked.has(group.id) ? { ...group, myJoinRequestStatus: 'PENDING' as const } : group,
    );
  });

  readonly sessions = computed<PublicSessionInstance[]>(() => {
    const me = this._readerId();
    const source =
      this.mode() === SearchModes.Query
        ? this.search.sessions()
        : this.mode() === SearchModes.Topic
          ? this._upcomingStore
              .sessions()
              .filter((instance) => sessionMatchesTopic(instance, this.topic()))
          : [];
    return source.filter((instance) => instance.instructorId !== me);
  });

  readonly counts = computed(() => {
    const coaches = this.coaches().length;
    const groups = this.groups().length;
    const sessions = this.sessions().length;
    return { coaches, groups, sessions, all: coaches + groups + sessions };
  });

  /** A chip whose list emptied (a new search) falls back to All. */
  readonly shownKind = computed<SearchKind>(() => {
    const kind = this.kind();
    if (kind === SearchKinds.All) return kind;
    return this.counts()[kind] > 0 ? kind : SearchKinds.All;
  });

  /** The chips worth offering: All, and each kind that has something. */
  readonly kindChips = computed(() =>
    this.kindOptions.filter(
      (option) => option.id === SearchKinds.All || this.counts()[option.id] > 0,
    ),
  );

  readonly showChips = computed(() => this.hasResults() && this.kindChips().length > 2);

  showKind(kind: SearchKind): boolean {
    const shown = this.shownKind();
    return shown === SearchKinds.All || shown === kind;
  }

  readonly hasResults = computed(
    () =>
      (this.mode() === SearchModes.Query || this.mode() === SearchModes.Topic) &&
      this.counts().all > 0,
  );

  readonly loading = computed(() => {
    switch (this.mode()) {
      case SearchModes.Query:
        return this.search.isSearching() && this.counts().all === 0;
      case SearchModes.Topic:
        return (
          this.counts().all === 0 &&
          (this._coachesStore.loading() ||
            this._groupsStore.loading() ||
            this._upcomingStore.loading())
        );
      default:
        return false;
    }
  });

  readonly failed = computed(() => {
    switch (this.mode()) {
      case SearchModes.Query:
        return this.search.hasError();
      case SearchModes.Topic:
        return (
          !this.loading() &&
          this._coachesStore.error() &&
          this._groupsStore.error() &&
          !this._upcomingStore.loaded()
        );
      default:
        return false;
    }
  });

  readonly empty = computed(() => {
    switch (this.mode()) {
      case SearchModes.Query:
        // The server's own empty answer, or one that held only the reader.
        return (
          this.search.isEmpty() ||
          (!this.search.isSearching() && !this.failed() && this.counts().all === 0)
        );
      case SearchModes.Topic:
        return !this.loading() && !this.failed() && this.counts().all === 0;
      default:
        return false;
    }
  });

  /** What to mark in the rows: the typed term, never a topic. */
  readonly term = computed(() => (this.mode() === SearchModes.Query ? this.search.query().trim() : ''));

  /** "forță" when "forta" was typed: the footnote says accents don't matter. */
  readonly accentVariant = computed(() => {
    const term = this.term();
    if (!term || !this.hasResults()) return null;
    return accentVariant(
      [
        ...this.coaches().flatMap((coach) => [coachName(coach), coachSubline(coach)]),
        ...this.groups().map((group) => group.name),
        ...this.sessions().map(discoverTitle),
      ],
      term,
    );
  });

  verbFor(group: DiscoverGroup): { verb: GroupVerb; label: string } | null {
    return this._joined().has(group.id) ? null : groupVerb(group);
  }

  isBooked(instance: PublicSessionInstance): boolean {
    return this._myBookingsIndexStore.hasBooking(instance.id);
  }

  // ─── Recent ─────────────────────────────────────────────────────────────

  /** Recent, ready to draw: a search with the clock tile, a coach or group
      with its own hexagon, each with what it is and where under it. */
  readonly recentRows = computed(() =>
    this._prefs.recents().map((entry) => {
      const key = recentKey(entry);
      switch (entry.kind) {
        case RecentKinds.Query:
          return {
            key,
            entry,
            title: entry.text,
            line: translate('discover.search.recentSearch'),
            icon: 'time-outline',
            imageUrl: null,
            tone: '',
          };
        case RecentKinds.Coach:
          return {
            key,
            entry,
            title: entry.name,
            line: [translate('discover.search.recentCoach'), entry.city].filter(Boolean).join(' · '),
            icon: null,
            imageUrl: entry.avatarUrl,
            tone: avatarToneFor(entry.userId),
          };
        case RecentKinds.Group:
          return {
            key,
            entry,
            title: entry.name,
            line: [translate('discover.search.recentGroup'), entry.city].filter(Boolean).join(' · '),
            icon: null,
            imageUrl: entry.logoUrl,
            tone: GROUP_AVATAR_TONE,
          };
      }
    }),
  );

  readonly hasRecents = computed(() => this.recentRows().length > 0);

  openRecent(entry: DiscoverRecent): void {
    switch (entry.kind) {
      case RecentKinds.Query:
        this.onQueryChange(entry.text);
        return;
      case RecentKinds.Coach:
        this._prefs.pushRecent(entry);
        void this._router.navigate(this._links.person(entry.handle));
        return;
      case RecentKinds.Group:
        this._prefs.pushRecent(entry);
        void this._router.navigate(this._links.groupPreview(entry.id));
        return;
    }
  }

  clearRecents(): void {
    this._prefs.clearRecents();
  }

  /** The typed search, remembered once it led somewhere. */
  private _rememberQuery(): void {
    const text = this.search.query().trim();
    if (this.search.isActive()) this._prefs.pushRecent({ kind: RecentKinds.Query, text });
  }

  // ─── Input ──────────────────────────────────────────────────────────────

  onQueryChange(value: string): void {
    // Typing leaves a topic: the field and the topic are two ways to ask.
    if (value.trim()) this.topic.set(null);
    this.search.setQuery(value);
  }

  /** The keyboard's Search key: remember the term and put the keyboard away. */
  onSubmit(event: Event): void {
    this._rememberQuery();
    (event.target as HTMLElement | null)?.blur();
  }

  openTopic(topic: DiscoverTopic): void {
    this.kind.set(SearchKinds.All);
    this.topic.set(topic);
    this._coachesStore.load();
    this._groupsStore.load();
    this._upcomingStore.load();
  }

  clearTopic(): void {
    this.topic.set(null);
  }

  setKind(kind: SearchKind): void {
    this.kind.set(kind);
  }

  clearSearch(): void {
    this.search.clear();
    this.topic.set(null);
  }

  retry(): void {
    if (this.mode() === SearchModes.Topic) {
      this._coachesStore.load({ force: true });
      this._groupsStore.load({ force: true });
      this._upcomingStore.load();
      return;
    }
    this.search.setQuery(this.search.query());
  }

  /**
   * Back to whatever opened search, the way the back chevron goes: a pop of
   * this tab's stack, not the browser's history, which a profile opened and
   * closed from here has already moved on. On a cold load, the stack's own
   * root.
   */
  cancel(): void {
    if (this._outlet?.canGoBack()) {
      this._navController.setDirection('back');
      void this._outlet.pop();
      return;
    }
    void this._navController.navigateBack(this._links.root);
  }

  // ─── Opening a result (in this stack, so back returns here) ────────────

  openCoach(coach: InstructorSearchResult): void {
    if (!coach.handle) return;
    this._rememberQuery();
    this._prefs.pushRecent({
      kind: RecentKinds.Coach,
      id: coach.id,
      userId: coach.userId,
      handle: coach.handle,
      name: coachName(coach),
      avatarUrl: coach.avatarUrl,
      city: coach.city?.trim() || null,
    });
    void this._router.navigate(this._links.person(coach.handle));
  }

  openGroup(group: DiscoverGroup): void {
    this._rememberQuery();
    this._prefs.pushRecent({
      kind: RecentKinds.Group,
      id: group.id,
      name: group.name,
      logoUrl: group.logoUrl,
      city: group.city?.trim() || null,
    });
    void this._router.navigate(
      this._joined().has(group.id) ? this._links.group(group.id) : this._links.groupPreview(group.id),
    );
  }

  openSession(instance: PublicSessionInstance): void {
    this._rememberQuery();
    void this._router.navigate(this._links.session(instance.id));
  }

  /**
   * Join, or ask to, from the row: the group preview's flow. Which of the
   * two happened is the server's answer, so the message and what follows
   * come from the response: straight into the group once in, the row saying
   * "Request pending" once asked.
   */
  joinGroup(group: DiscoverGroup): void {
    if (this.busyGroupId()) return;
    this.busyGroupId.set(group.id);
    this._rememberQuery();

    this._groupService
      .selfJoin(group.id)
      .pipe(take(1))
      .subscribe({
        next: (result: SelfJoinResult) => {
          this.busyGroupId.set(null);
          this._groupsRefresh.notify();
          if (result.status === 'JOINED') {
            this._joined.update((ids) => new Set([...ids, group.id]));
            this._prefs.pushRecent({
              kind: RecentKinds.Group,
              id: group.id,
              name: group.name,
              logoUrl: group.logoUrl,
              city: group.city?.trim() || null,
            });
            void this._feedbackService.success(translate('groups.preview.toast.joined'));
            void this._router.navigate(this._links.group(group.id));
            return;
          }
          this._asked.update((ids) => new Set([...ids, group.id]));
          void this._feedbackService.success(translate('toast.summary.requestSent'));
        },
        error: (error: unknown) => {
          this.busyGroupId.set(null);
          void this._feedbackService.error(error, translate('groups.preview.toast.joinFailed'));
        },
      });
  }
}
