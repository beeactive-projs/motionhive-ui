import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import {
  AuthStore,
  BlogCategories,
  BlogPost,
  BlogService,
  ClientService,
  Hex,
  HexTone,
  InstructorSearchResult,
  MyInstructor,
  ProfileService,
  SessionService,
  WorkoutLog,
  WorkoutLogService,
  type BlogCategory,
  type MyProfile,
} from 'core';
import { InviteFriendDialog } from './_dialogs/invite-friend-dialog/invite-friend-dialog';
import { SuggestInstructorDialog } from './_dialogs/suggest-instructor-dialog/suggest-instructor-dialog';

interface StartStep {
  id: 'profile' | 'session' | 'coach';
  title: string;
  sub: string;
  done: boolean;
  /** Only shown when relevant — e.g. "Create your first session" hides for non-instructors. */
  show: boolean;
  /** Route to land on when the user taps the step. */
  go: () => void;
}

interface CoachRow {
  name: string;
  tag: string;
  initials: string;
  avatarUrl: string | null;
  tone: HexTone;
  go: () => void;
}

const BLOG_LIMIT = 3;
const COACHES_OWN_LIMIT = 2;
const COACHES_SUGGESTED_LIMIT = 3;
const COACH_TONES: HexTone[] = ['amber', 'teal', 'navySolid', 'coral'];
/** Blog articles live on the public marketing site, not in-app. */
const MARKETING_BLOG_URL = 'https://www.motionhive.fit/blog';
/**
 * Category accent keys — these drive the `[data-tone]` CSS on the journal
 * chips/placeholders (home.scss), NOT the hex component. Kept independent of
 * `HexTone` so the two can evolve separately.
 */
type CategoryTone = 'honey' | 'teal' | 'navy' | 'coral';
const CATEGORY_TONES: Record<BlogCategory, CategoryTone> = {
  [BlogCategories.Guide]: 'honey',
  [BlogCategories.Nutrition]: 'teal',
  [BlogCategories.Science]: 'navy',
  [BlogCategories.Wellness]: 'coral',
};

/**
 * Cold-start home (editorial layout, light-first).
 *
 * Built from the Claude Design "Refined Home" handoff with one
 * difference: it's a SINGLE component that handles both the cold and
 * warm states without a hard switch. As real data lands, panels swap
 * in-place — your-coaches replaces some-of-our-coaches, the steps
 * panel hides when everything is checked, a resume tile surfaces
 * above the hero if you have an in-progress workout.
 *
 * Explicit anti-patterns from the design brief (chat10):
 *   - No "Founding member" pill, no founder's-note framing.
 *   - No buzz feed faking social proof.
 *   - No "joined N days ago" stamps on coach rows (a stagnant list
 *     reads worse than a curated one).
 *
 * Everything renders from real endpoints — there's no placeholder
 * data hard-coded into the component.
 */
@Component({
  selector: 'mh-home',
  standalone: true,
  imports: [
    ButtonModule,
    SkeletonModule,
    Hex,
    InviteFriendDialog,
    SuggestInstructorDialog,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit {
  private readonly _auth = inject(AuthStore);
  private readonly _profileSvc = inject(ProfileService);
  private readonly _clientSvc = inject(ClientService);
  private readonly _blogSvc = inject(BlogService);
  private readonly _sessionSvc = inject(SessionService);
  private readonly _workoutLogSvc = inject(WorkoutLogService);
  private readonly _router = inject(Router);

  // ── Source signals ────────────────────────────────────────────────

  readonly user = computed(() => this._auth.user());
  readonly firstName = computed(() => this.user()?.firstName?.trim() || 'there');

  private readonly _profile = signal<MyProfile | null>(null);
  private readonly _resume = signal<WorkoutLog | null>(null);
  private readonly _myCoaches = signal<MyInstructor[]>([]);
  private readonly _suggestedCoaches = signal<InstructorSearchResult[]>([]);
  private readonly _posts = signal<BlogPost[]>([]);
  private readonly _instructorTemplatesTotal = signal(0);

  readonly postsLoading = signal(true);
  readonly coachesLoading = signal(true);

  // ── Derived state ─────────────────────────────────────────────────

  /** True once the caller is a registered instructor (profile exists, or any sessions on the books). */
  readonly isInstructor = computed(
    () =>
      !!this._profile()?.instructorProfile ||
      this._profile()?.roles?.includes('INSTRUCTOR') === true ||
      this._instructorTemplatesTotal() > 0,
  );

  readonly hasResume = computed(() => !!this._resume());
  readonly resume = computed(() => this._resume());

  /** Real coaches the user already trains with, mapped to display rows. */
  readonly myCoachRows = computed<CoachRow[]>(() =>
    this._myCoaches()
      .slice(0, COACHES_OWN_LIMIT)
      .map((mi, i) => this._coachFromMine(mi, i)),
  );

  /**
   * Discovery rows — only computed when the user has no coaches of
   * their own. Capped at 3 + the design's "more joining soon" note.
   */
  readonly suggestedCoachRows = computed<CoachRow[]>(() =>
    this._suggestedCoaches()
      .slice(0, COACHES_SUGGESTED_LIMIT)
      .map((s, i) => this._coachFromSuggested(s, i)),
  );

  readonly hasOwnCoaches = computed(() => this._myCoaches().length > 0);

  /** Top 3 published posts, ready for the reading-list rows. */
  readonly posts = computed(() => this._posts().slice(0, BLOG_LIMIT));

  readonly steps = computed<StartStep[]>(() => {
    const account = this._profile()?.account;
    const profileDone = !!account?.avatarUrl && !!account?.handle;
    const sessionDone = this._instructorTemplatesTotal() > 0;
    const coachDone = this._myCoaches().length > 0;

    const all: StartStep[] = [
      {
        id: 'profile',
        title: 'Finish your profile',
        sub: 'So coaches and clients know who you are.',
        done: profileDone,
        show: true,
        go: () => this._router.navigate(['/profile']),
      },
      {
        id: 'session',
        title: 'Create your first session',
        sub: 'Online or in person, group or 1-on-1.',
        done: sessionDone,
        show: this.isInstructor(),
        go: () => this._router.navigate(['/coaching/sessions']),
      },
      {
        id: 'coach',
        title: 'Find a coach for yourself',
        sub: 'Book time with someone you rate.',
        done: coachDone,
        show: true,
        go: () =>
          this._router.navigate(['/discover'], {
            queryParams: { tab: 'coaches' },
          }),
      },
    ];
    return all.filter((s) => s.show);
  });

  /** Hide the panel entirely when every relevant step is checked. */
  readonly showStepsPanel = computed(() => this.steps().some((s) => !s.done));

  // ── Dialog state ─────────────────────────────────────────────────

  protected readonly inviteOpen = signal(false);
  protected readonly suggestOpen = signal(false);

  // ── Lifecycle ────────────────────────────────────────────────────

  ngOnInit(): void {
    this._loadProfile();
    this._loadResume();
    this._loadCoaches();
    this._loadPosts();
    // listTemplates fires inside _loadProfile() once we know the
    // caller is an instructor — calling it for a plain USER returns
    // 403, which a global error interceptor surfaces as a toast.
  }

  // ── Actions ──────────────────────────────────────────────────────

  resumeWorkout(): void {
    const r = this.resume();
    if (!r) return;
    this._router.navigate(['/user/workout-log', r.id]);
  }

  openPost(p: BlogPost): void {
    window.open(`${MARKETING_BLOG_URL}/${p.slug}`, '_blank', 'noopener');
  }

  goToBlog(): void {
    window.open(MARKETING_BLOG_URL, '_blank', 'noopener');
  }

  goToMyCoaches(): void {
    this._router.navigate(['/coaching/clients']);
  }

  goToDiscoverCoaches(): void {
    this._router.navigate(['/discover'], { queryParams: { tab: 'coaches' } });
  }

  categoryTone(cat: BlogCategory): CategoryTone {
    return CATEGORY_TONES[cat] ?? 'honey';
  }

  // ── Loaders ──────────────────────────────────────────────────────

  private _loadProfile(): void {
    this._profileSvc.getMyProfile().subscribe({
      next: (p) => {
        this._profile.set(p);
        // Only the instructor surface exposes /sessions/templates —
        // a non-instructor call returns 403 (and the global error
        // interceptor toasts it). Gate strictly on the actual
        // instructor profile existing, not on derived isInstructor().
        if (p?.instructorProfile) {
          this._loadInstructorTemplatesCount();
        }
      },
      error: () => this._profile.set(null),
    });
  }

  private _loadResume(): void {
    this._workoutLogSvc.getInProgress().subscribe({
      next: (log) => this._resume.set(log),
      error: () => this._resume.set(null),
    });
  }

  private _loadCoaches(): void {
    this.coachesLoading.set(true);
    this._clientSvc.getMyInstructors().subscribe({
      next: (rows) => {
        this._myCoaches.set(rows ?? []);
        if ((rows?.length ?? 0) === 0) {
          this._profileSvc.discoverInstructors().subscribe({
            next: (sr) => {
              this._suggestedCoaches.set(sr ?? []);
              this.coachesLoading.set(false);
            },
            error: () => {
              this._suggestedCoaches.set([]);
              this.coachesLoading.set(false);
            },
          });
        } else {
          this.coachesLoading.set(false);
        }
      },
      error: () => {
        this._myCoaches.set([]);
        this.coachesLoading.set(false);
      },
    });
  }

  private _loadPosts(): void {
    this.postsLoading.set(true);
    this._blogSvc.getPosts({ page: 1, limit: BLOG_LIMIT }).subscribe({
      next: (res) => {
        this._posts.set(res.items ?? []);
        this.postsLoading.set(false);
      },
      error: () => {
        this._posts.set([]);
        this.postsLoading.set(false);
      },
    });
  }

  private _loadInstructorTemplatesCount(): void {
    this._sessionSvc.listTemplates({ page: 1, limit: 1 }).subscribe({
      next: (res) => this._instructorTemplatesTotal.set(res.total ?? 0),
      error: () => this._instructorTemplatesTotal.set(0),
    });
  }

  // ── Mappers ──────────────────────────────────────────────────────

  private _coachFromMine(mi: MyInstructor, i: number): CoachRow {
    const u = mi.instructor;
    const name = `${u.firstName} ${u.lastName}`.trim() || 'Coach';
    const initials = ((u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '')).toUpperCase() || 'C';
    const tag =
      mi.instructorProfile?.specializations?.slice(0, 2).join(' · ') || 'Coach';
    return {
      name,
      tag,
      initials,
      avatarUrl: u.avatarUrl ?? null,
      tone: COACH_TONES[i % COACH_TONES.length],
      go: () => this._gotoPublicProfile(u.handle),
    };
  }

  private _coachFromSuggested(s: InstructorSearchResult, i: number): CoachRow {
    const name = `${s.firstName} ${s.lastName}`.trim() || s.displayName || 'Coach';
    const initials = ((s.firstName?.[0] ?? '') + (s.lastName?.[0] ?? '')).toUpperCase() || 'C';
    const tag =
      s.specializations?.slice(0, 2).join(' · ') ||
      (s.city ? s.city : 'Open to new clients');
    return {
      name,
      tag,
      initials,
      avatarUrl: s.avatarUrl ?? null,
      tone: COACH_TONES[i % COACH_TONES.length],
      go: () => this._gotoPublicProfile(s.handle),
    };
  }

  /** Public instructor profiles live at `/@<handle>` (UrlMatcher). Falls
   *  back to discover when the user hasn't claimed a handle yet. */
  private _gotoPublicProfile(handle: string | null): void {
    if (handle && handle.trim()) {
      this._router.navigateByUrl(`/@${handle.trim()}`);
    } else {
      this._router.navigate(['/discover'], { queryParams: { tab: 'coaches' } });
    }
  }
}
