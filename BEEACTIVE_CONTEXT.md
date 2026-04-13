# BeeActive — Marketing & Content Context

> This file is intended for the Claude marketing project. It gives the AI model a full understanding of BeeActive — what it is, what it does, what's planned, the blog structure, content strategy guidelines, and technical constraints relevant to content creation.

---

## 1. What Is BeeActive?

BeeActive is a **community fitness platform** — one app for both activity leaders and participants. It removes the friction between organizing and joining fitness communities: group classes, personal training, hiking clubs, yoga sessions, martial arts dojos, running crews, or any active community.

**The core idea**: Whether you lead a community or you show up to one, BeeActive is built for you.

**The problem it solves**: Fitness community organizers are drowning in DMs, spreadsheets, and WhatsApp groups. Participants don't know where to find the right group or how to stay updated. BeeActive brings everything into one clean place.

**Tagline ideas in use**: "Move together.", "The hive is open.", "For those who lead and those who show up."

**Brand voice**: Direct, warm, community-first. Not corporate. Not hustle-culture. Human and honest — we're building this in the open, sharing what we learn along the way.

---

## 2. Who Is the Target Audience?

### Leaders (Supply side)
- Personal trainers running group or 1:1 sessions
- Yoga instructors with regular class schedules
- Running club organizers
- Martial arts coaches / dojo owners
- Hiking & outdoor group leads
- CrossFit/functional fitness coaches
- Dance class instructors

### Participants (Demand side)
- People looking to join fitness communities (not just gyms)
- Those who want group accountability without the gym contract
- People who move between activities (yoga Monday, hiking Saturday)
- Remote workers, expats, or people new to a city looking for community

---

## 3. Core Features (Planned & Live)

### LIVE ✅
- **Blog & Updates** — The BeeActive blog is live with search, category filtering, and server-side pagination. Articles cover product updates, community stories, fitness insights, and behind-the-scenes building. Available at `/blog`.
- **Feedback System** — Users can submit bug reports, suggestions, or general feedback via an in-app modal. Works for both authenticated users (sends userId) and guests (optional email). API: `POST /feedback`.
- **Waitlist** — Pre-launch signup for interested users. Collects email (required), name, role (`leader` or `participant`), and signup source. Duplicate emails are rejected. API: `POST /waitlist`, `GET /waitlist/count` (public).

### COMING SOON (Roadmap)
- **Hubs & Groups** — Community spaces for leaders to build their tribe. Members can join, follow updates, see upcoming sessions.
- **Sessions & Scheduling** — Leaders publish sessions with date, time, location, capacity. Members RSVP. Smart scheduling that avoids conflicts.
- **Profiles** — Leader and participant profiles. Leaders showcase their style, background, and upcoming sessions. Participants build their activity history.
- **Discovery** — Find groups, leaders, and sessions near you. Filter by activity type, schedule, or vibe.

### FUTURE (Not yet roadmapped)
- Payments & membership subscriptions
- In-app messaging
- Session check-ins and attendance tracking
- Performance analytics for leaders
- iOS & Android native apps

---

## 4. Brand Values

1. **Community First** — Features are built around what actually helps people connect and move together, not engagement metrics.
2. **Keep It Simple** — One problem, solved well. No feature bloat. Fitness apps are overcomplicated — BeeActive is not.
3. **Not Just Fitness** — Physical activity is the vehicle; belonging and connection are the destination.
4. **Build in the Open** — We share progress publicly. No vaporware. If something is coming, we say when and why.

---

## 5. Blog Structure & Content Model

Each blog post has these fields:

| Field | Description |
|-------|-------------|
| `title` | Article headline |
| `slug` | URL-friendly ID (e.g., `why-we-built-beeactive`) |
| `excerpt` | 1–2 sentence summary shown in the blog grid |
| `category` | Single category label (see below) |
| `coverImage` | Cloudinary-hosted image URL |
| `content` | Full HTML content |
| `authorName` | Author's full name |
| `authorInitials` | 2-letter initials shown in avatar |
| `authorRole` | Author's role (e.g., "Co-founder", "Community Lead") |
| `readTime` | Estimated minutes to read (number) |
| `tags` | Array of topic tags |
| `publishedAt` | ISO date string |

### Blog Categories (in use or planned)
- `Product` — Feature announcements, updates, changelogs
- `Community` — Stories from leaders and participants
- `Fitness` — Workout tips, movement science, training philosophy
- `Founders` — Behind-the-scenes from the team
- `Guide` — How-to content for leaders and participants
- `Insight` — Data, trends, observations about the fitness community space

---

## 6. Existing Blog Content Themes

The blog has been used to:
- Explain why BeeActive was built (origin story)
- Share what features are coming and why we're prioritizing them
- Document things we've learned building in public
- Give fitness community leaders practical content (how to grow a group, retain members, etc.)

**When suggesting new articles**, think about:
- What a fitness community leader would google at 11pm when stressed about attendance
- What someone new to a city would search when trying to find their people
- What makes BeeActive different from Facebook Groups, Mindbody, or just using Instagram DMs
- Topics that can rank on search and also genuinely help someone

---

## 7. Suggested Article Categories & Ideas

### Product / Founders
- "Why we're not building another gym app"
- "What we shipped in [month]: BeeActive changelog"
- "The 3 things we got wrong in our first version"
- "Building BeeActive in public: what that actually means"
- "Why we chose Angular over React (and what we learned)"

### Community Stories
- "From WhatsApp chaos to a real community hub: one coach's story"
- "How a yoga instructor grew her group from 8 to 80 members"
- "The hiking club that didn't need Instagram to grow"
- "What makes a fitness community stick (and what kills it)"

### Guides for Leaders
- "How to start a running club from scratch"
- "The right way to set session capacity (and why most coaches get it wrong)"
- "Retention vs. acquisition: where new community leaders should focus first"
- "How to price your group sessions without underselling yourself"
- "5 tools fitness leaders use before BeeActive (and why they switch)"

### Guides for Participants
- "How to find a fitness community that actually fits you"
- "Why group training beats solo workouts (with the research)"
- "What to expect when you join a new fitness group for the first time"
- "The best outdoor fitness communities and how they operate"

### Fitness / Insight
- "The science of social accountability in exercise"
- "Why people quit solo gym memberships (and what works instead)"
- "Community fitness vs. boutique studios: what the data says"
- "The rise of micro fitness communities (and why it matters)"

---

## 8. Content Strategy Guidelines

### Tone
- Write like a smart, honest founder — not a marketing robot
- First-person plural ("we built", "we learned") for product and founders posts
- Practical and specific — no vague wellness fluff
- Optimistic but grounded — we're building something real, not pitching a unicorn

### SEO Considerations
- Target long-tail keywords around "fitness community", "group fitness leader", "how to start a [activity type] group"
- Use real examples and specifics — this signals expertise
- Articles should be 600–1800 words for blog posts; guides can go longer
- Internal links: link back to relevant blog articles and eventually to feature pages

### Images
- Cover images are hosted on Cloudinary
- Prefer real, community-feel photography over stock (people in motion, groups, outdoors)
- Avoid cheesy gym mirror selfies and overly-posed fitness photography
- Colors should feel warm and community-oriented (BeeActive brand: Amber primary, Midnight Navy secondary, Teal accent)

### Cadence (Suggested)
- 2–4 articles per month minimum during pre-launch phase
- Mix: ~40% product/founders, ~30% guides for leaders, ~20% fitness/insight, ~10% community stories
- Publish at least one SEO-targeted article per month

---

## 9. Technical Notes for Content Creators

- Blog content is HTML (stored in the `content` field)
- The article detail page renders `content` with `[innerHTML]` — so HTML formatting works
- Supported formatting: headings (h2–h4), paragraphs, bold, italic, lists (ul/ol), blockquotes, code blocks
- Images within content should use Cloudinary URLs
- The blog is publicly accessible at `https://beeactive.io/blog` (or the current deployed URL)
- New posts are created via the admin API (not a CMS UI yet)

---

## 10. Competitive Landscape

| Tool | What It Does | Why Leaders Use It | Why They Leave |
|------|--------------|-------------------|----------------|
| Facebook Groups | Community space | Free, everyone's there | Noisy, algorithm-hostile, no scheduling |
| Mindbody | Booking & payments | Industry standard | Expensive, complex, client-facing UX is poor |
| Glofox | Studio management | Strong for studios | Not built for informal communities |
| WhatsApp | Communication | Everyone has it | Not built for organizing, no discovery |
| Instagram | Discovery & marketing | Large reach | Not built for community management |
| Meetup.com | Event discovery | Big user base | Outdated UX, paid for organizers |

**BeeActive's position**: The simple, community-first layer that sits between "just use WhatsApp" and "pay €200/month for a studio management platform". Built for the coach who has 15–50 regular members and wants to run a real community without running a business administration degree.

---

## 11. Current Blog Pagination & Search Status

**Current state**:
- All blog posts are fetched at once (no pagination on frontend)
- No search bar or filtering exists yet
- The API already returns pagination metadata (`total`, `page`, `pageSize`) but the UI doesn't use it

**Planned improvements** (see implementation analysis in section 12):
- Server-side pagination with page controls
- Client-side search/filter by title, excerpt, and tags
- Category filter tabs

---

## 12. Blog Pagination & Search — Implementation Analysis

### Option A: Server-Side Pagination (Recommended for scale)

**How it works**: The blog service sends `?page=1&pageSize=9` query params to the API. The API returns only that page's posts. The frontend shows Previous/Next (or numbered page) controls.

**Pros**: Scales to hundreds of posts, fast load times, SEO-friendly with canonical URLs
**Cons**: Requires API changes to support `page` and `pageSize` query params (backend work)

**Frontend changes needed**:
1. `BlogService.getAllPost(page, pageSize)` — add query params
2. `BlogComponent` — add `currentPage` signal, pass to service, wire up paginator
3. Template — add `<p-paginator>` (PrimeNG) below the grid

**Implementation sketch**:
```typescript
// blog.service.ts
getAllPost(page = 1, pageSize = 9): Observable<BlogPost> {
  const params = new HttpParams().set('page', page).set('pageSize', pageSize);
  return this.http.get<BlogPost>(this.base, { params });
}
```

```typescript
// blog.component.ts
readonly currentPage = signal(1);
readonly pageSize = 9;
readonly totalPosts = signal(0);

readonly posts$ = toSignal(
  toObservable(this.currentPage).pipe(
    switchMap(page => this.blogService.getAllPost(page, this.pageSize).pipe(
      tap(res => { this._loaded.set(true); this.totalPosts.set(res.total); })
    )),
    map(res => res.items)
  ),
  { initialValue: [] as BlogPostData[] }
);

onPageChange(event: PaginatorState) {
  this.currentPage.set((event.page ?? 0) + 1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

---

### Option B: Client-Side Pagination (Works with current API)

**How it works**: Fetch all posts once. Slice them into pages on the frontend.

**Pros**: No API changes needed, works today
**Cons**: Loads everything upfront (fine for < 100 posts), not SEO-paginated

**Implementation sketch**:
```typescript
readonly currentPage = signal(0); // 0-indexed for PrimeNG Paginator
readonly pageSize = 9;

readonly paginatedPosts = computed(() => {
  const start = this.currentPage() * this.pageSize;
  return this.allPosts().slice(start, start + this.pageSize);
});

readonly featuredPost = computed(() =>
  this.currentPage() === 0 ? (this.allPosts()[0] ?? null) : null
);

readonly gridPosts = computed(() =>
  this.currentPage() === 0
    ? this.paginatedPosts().slice(1)
    : this.paginatedPosts()
);
```

---

### Option C: Search Bar (Client-Side, Works Today)

A search input that filters posts by title, excerpt, and tags. No API changes needed.

**Implementation sketch**:
```typescript
readonly searchQuery = signal('');

readonly filteredPosts = computed(() => {
  const q = this.searchQuery().toLowerCase().trim();
  if (!q) return this.allPosts();
  return this.allPosts().filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.excerpt.toLowerCase().includes(q) ||
    p.tags.some(t => t.toLowerCase().includes(q)) ||
    p.category.toLowerCase().includes(q)
  );
});
```

Template:
```html
<input
  pInputText
  type="search"
  placeholder="Search articles..."
  [ngModel]="searchQuery()"
  (ngModelChange)="searchQuery.set($event)"
  aria-label="Search blog articles"
/>
```

---

### Option D: Category Filter Tabs (Client-Side, Works Today)

Filter posts by category. The `selectedCategory` signal already exists in the component but is unused.

**Implementation**:
```typescript
readonly categories = computed(() => {
  const cats = new Set(this.allPosts().map(p => p.category));
  return ['All', ...Array.from(cats)];
});

readonly filteredPosts = computed(() => {
  const cat = this.selectedCategory();
  if (cat === 'All') return this.allPosts();
  return this.allPosts().filter(p => p.category === cat);
});
```

---

### Recommended Approach

**Phase 1 (no backend changes)**:
- Add client-side search bar (Option C)
- Add category filter tabs (Option D) — the signal already exists
- Add client-side pagination (Option B) that paginates the filtered results

**Phase 2 (with backend support)**:
- Switch to server-side pagination (Option A) — better for SEO and scale

The three Phase 1 features compose cleanly: `allPosts → filtered by category & search → paginated`.

```typescript
readonly filteredPosts = computed(() => {
  let posts = this.allPosts();
  const cat = this.selectedCategory();
  const q = this.searchQuery().toLowerCase().trim();

  if (cat !== 'All') posts = posts.filter(p => p.category === cat);
  if (q) posts = posts.filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.excerpt.toLowerCase().includes(q) ||
    p.tags.some(t => t.toLowerCase().includes(q))
  );
  return posts;
});

readonly paginatedPosts = computed(() => {
  const start = this.currentPage() * this.pageSize;
  return this.filteredPosts().slice(start, start + this.pageSize);
});
```
