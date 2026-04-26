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
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CarouselModule } from 'primeng/carousel';
import {
  AuthStore,
  BlogPost,
  BlogService,
  FeedbackService,
  Group,
  GroupService,
  InstructorSearchResult,
  ProfileService,
} from 'core';
import { Hex, HexTone } from './_components/hex/hex';
import { SectionHeader } from './_components/section-header/section-header';
import { RoadmapRow } from './_components/roadmap-row/roadmap-row';
import { InstructorCard } from './_components/instructor-card/instructor-card';
import { GroupCard } from './_components/group-card/group-card';
import { ContribCard } from './_components/contrib-card/contrib-card';
import { BlogCard } from './_components/blog-card/blog-card';
import { InviteFriendDialog } from './_dialogs/invite-friend-dialog/invite-friend-dialog';
import { SuggestInstructorDialog } from './_dialogs/suggest-instructor-dialog/suggest-instructor-dialog';

interface RoadmapEntry {
  when: string;
  active: boolean;
  title: string;
  sub: string;
  status: string | null;
}

interface BuzzEntry {
  text: string;
  tone: HexTone;
}

/** Below these counts the carousel feels half-empty, so we render a
 *  "growing the hive" state instead with a real CTA. Lowered to 1 so
 *  even a single instructor / group renders the carousel — autoplay
 *  + circular still works on a one-item list. Raise back to 3/2 if
 *  the single-card experience feels weird. */
const INSTRUCTORS_CAROUSEL_MIN = 1;
const GROUPS_CAROUSEL_MIN = 1;
const BLOG_CAROUSEL_MIN = 1;

/** Cap how many entities live in each carousel — beyond this the page
 *  becomes a list, not a highlight reel. */
const CAROUSEL_MAX = 10;

/** Autoplay tick. Slow enough to read, fast enough to feel alive. */
const CAROUSEL_AUTOPLAY_MS = 4000;

/** Public marketing site — blog articles open here in a new tab. */
const MARKETING_BLOG_URL = 'https://www.motionhive.fit/blog';

@Component({
  selector: 'mh-home',
  imports: [
    ButtonModule,
    ProgressSpinnerModule,
    CarouselModule,
    Hex,
    SectionHeader,
    RoadmapRow,
    InstructorCard,
    GroupCard,
    ContribCard,
    BlogCard,
    InviteFriendDialog,
    SuggestInstructorDialog,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit {
  private readonly _authStore = inject(AuthStore);
  private readonly _profileService = inject(ProfileService);
  private readonly _groupService = inject(GroupService);
  private readonly _blogService = inject(BlogService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _router = inject(Router);

  /** Backing store for the full lists fetched from the API. */
  private readonly _allInstructors = signal<InstructorSearchResult[]>([]);
  private readonly _allGroups = signal<Group[]>([]);
  private readonly _allPosts = signal<BlogPost[]>([]);

  /** Top-10 most-recent slice the carousels actually render. */
  readonly instructors = computed(() => this._allInstructors().slice(0, CAROUSEL_MAX));
  readonly groups = computed(() => this._allGroups().slice(0, CAROUSEL_MAX));
  readonly posts = computed(() => this._allPosts().slice(0, CAROUSEL_MAX));

  readonly instructorsLoading = signal(true);
  readonly groupsLoading = signal(true);
  readonly postsLoading = signal(true);

  readonly hasInstructorsCarousel = computed(
    () => this.instructors().length >= INSTRUCTORS_CAROUSEL_MIN,
  );
  readonly hasGroupsCarousel = computed(() => this.groups().length >= GROUPS_CAROUSEL_MIN);
  readonly hasPostsCarousel = computed(() => this.posts().length >= BLOG_CAROUSEL_MIN);

  readonly user = this._authStore.user;
  readonly isInstructor = this._authStore.isInstructor;

  readonly firstName = computed(() => this.user()?.firstName?.trim() || 'there');

  protected readonly inviteOpen = signal(false);
  protected readonly suggestInstructorOpen = signal(false);

  /** Responsive carousel breakpoints, shared between instructor and group rails. */
  protected readonly carouselResponsive = [
    { breakpoint: '1280px', numVisible: 3, numScroll: 1 },
    { breakpoint: '900px', numVisible: 2, numScroll: 1 },
    { breakpoint: '560px', numVisible: 1, numScroll: 1 },
  ];

  protected readonly autoplayInterval = CAROUSEL_AUTOPLAY_MS;

  // TODO: replace with real recent-activity once the notification module
  // ships. Until then this is illustrative — the layout earns its keep
  // by showing what platform liveliness will look like.
  readonly buzz = signal<BuzzEntry[]>([
    { text: 'New instructor joined the hive', tone: 'coral' },
    { text: 'A group hit 40 members', tone: 'honey' },
    { text: 'First long run — 7 showed up', tone: 'teal' },
    { text: 'Boxing fundamentals on the calendar', tone: 'navy-soft' },
  ]);

  // TODO: roadmap copy is hardcoded. Move to a CMS/static config once
  // we want non-engineers editing it. Needs sign-off before launch.
  readonly roadmap = signal<RoadmapEntry[]>([
    {
      when: 'Now',
      active: true,
      title: 'Group chat for booked sessions',
      sub: 'See who else is going, coordinate beforehand.',
      status: 'Building now',
    },
    {
      when: 'Apr',
      active: false,
      title: 'Mobile app — iOS + Android',
      sub: 'Same product, native shell. TestFlight in 3 weeks.',
      status: null,
    },
    {
      when: 'May',
      active: false,
      title: 'Recurring sessions & class packs',
      sub: 'Buy 5, save 10%. Auto-rebook your favourites.',
      status: null,
    },
    {
      when: 'Jun',
      active: false,
      title: 'In-app payments to instructors',
      sub: 'No more bank transfers. Tip option included.',
      status: null,
    },
  ]);

  ngOnInit(): void {
    this._loadInstructors();
    this._loadGroups();
    this._loadPosts();
  }

  private _loadInstructors(): void {
    // TODO: when /profile/instructors/discover exposes `createdAt`,
    // sort by it desc so the home shows the newest coaches. Today the
    // shape doesn't carry it, so we keep API order and slice the top
    // CAROUSEL_MAX.
    this._profileService.discoverInstructors().subscribe({
      next: (list) => {
        this._allInstructors.set(list ?? []);
        this.instructorsLoading.set(false);
      },
      error: () => {
        this._allInstructors.set([]);
        this.instructorsLoading.set(false);
      },
    });
  }

  private _loadGroups(): void {
    // Instructors see the groups they run; everyone else sees the
    // groups they're in. There's no "discover public groups" endpoint
    // yet — when there is, swap this to discovery so non-members also
    // see the wider hive.
    const stream$ = this.isInstructor()
      ? this._groupService.getInstructorsGroups()
      : this._groupService.getMyGroups();

    stream$.subscribe({
      next: (list) => {
        // Newest first — Group has a real createdAt timestamp.
        const sorted = [...(list ?? [])].sort((a, b) => {
          const av = Date.parse(a.createdAt ?? '') || 0;
          const bv = Date.parse(b.createdAt ?? '') || 0;
          return bv - av;
        });
        this._allGroups.set(sorted);
        this.groupsLoading.set(false);
      },
      error: () => {
        this._allGroups.set([]);
        this.groupsLoading.set(false);
      },
    });
  }

  private _loadPosts(): void {
    // BlogService.getPosts already filters to published posts only and
    // accepts a limit. Backend orders by publishedAt desc.
    this._blogService.getPosts({ limit: CAROUSEL_MAX, page: 1 }).subscribe({
      next: (res) => {
        this._allPosts.set(res?.items ?? []);
        this.postsLoading.set(false);
      },
      error: () => {
        this._allPosts.set([]);
        this.postsLoading.set(false);
      },
    });
  }

  // --- Action handlers ------------------------------------------------------

  onInviteFriend(): void {
    this.inviteOpen.set(true);
  }

  onSuggestSomeone(): void {
    this.suggestInstructorOpen.set(true);
  }

  onShareIdea(): void {
    this._feedbackService.open();
  }

  onReadFoundersNote(): void {
    // TODO: replace with a real founders' note page when one exists.
    this._feedbackService.open();
  }

  onSuggestGroup(): void {
    // Same shape as "suggest an instructor" but for groups; for now
    // it routes through the same feedback dialog so users always have
    // a path to reach us.
    this._feedbackService.open();
  }

  onFollowInstructor(_instructor: InstructorSearchResult): void {
    // TODO: wire to follow endpoint when "follow" is a real backend feature.
  }

  onGroupAction(payload: { group: Group; joined: boolean }): void {
    if (payload.joined) {
      // Instructors run their groups under /coaching/groups; users in
      // a group don't have a dedicated detail page yet, so for now we
      // route to /coaching/groups/:id which works for instructors and
      // 404s gracefully for plain members until a user-side group
      // detail page is built.
      // TODO: wire to a public/member group detail route once it exists.
      this._router.navigate(['/coaching/groups', payload.group.id]);
    } else {
      // TODO: confirm group join policy (open vs request) before calling selfJoin.
      this._groupService.selfJoin(payload.group.id).subscribe({
        next: () => this._loadGroups(),
        error: () => {},
      });
    }
  }

  onReadPost(post: BlogPost): void {
    // Articles live on the marketing site, not in the authenticated app.
    window.open(`${MARKETING_BLOG_URL}/${post.slug}`, '_blank', 'noopener,noreferrer');
  }

  onReadAllPosts(): void {
    window.open(MARKETING_BLOG_URL, '_blank', 'noopener,noreferrer');
  }
}
