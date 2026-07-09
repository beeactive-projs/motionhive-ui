# MotionHive — Marketing Brief

> A single source of truth for anyone (or any AI marketing agent) creating content,
> campaigns, or copy for MotionHive. It describes **what the product is, who it's for,
> what's live today, how it makes money, the brand voice, and the angles to lean on** —
> plus what *not* to claim so we never overpromise.

---

## 1. The one-liner

**MotionHive is a warm, community-first fitness platform where independent coaches run
their whole business — sessions, programs, clients, and payments — and members discover
coaches, book sessions, and train alongside a community.** Free to join. Built around
the idea of a *hive*: many people, moving together.

**Elevator pitch:** Most fitness tools are either a cold booking calendar or a faceless
marketplace. MotionHive gives independent coaches a home that feels human — their own
storefront, real sessions (online or in person), training programs, direct messaging with
clients, and built-in payments — while members get a calm place to find a coach they'd
actually train with and stay consistent.

---

## 2. Brand identity

- **Name:** MotionHive (always one word, capital M, capital H). The community is referred
  to as **"the hive."**
- **Domain:** motionhive.fit — marketing site at `www.motionhive.fit`, the app at
  `app.motionhive.fit`.
- **Metaphor:** the hive / honeycomb — community, momentum, many moving as one. Use it for
  warmth and belonging, not for "busy/buzzy hustle."
- **Visual identity:**
  - **Hexagon** is the core brand shape (avatars, icons, motifs).
  - **Palette:** honey/amber (primary, `#f59e0b`), deep navy, teal, coral accents, warm
    cream backgrounds.
  - **Light-first** design (the product is designed and shown in light mode primarily; a
    polished dark mode also exists).
  - Typography is clean and editorial (Poppins / Inter / Plus Jakarta Sans).
- **Voice & tone:** calm, encouraging, human, grounded. Not hype-y, not "crush your goals,"
  not influencer-bro. Think *"a calm place to settle in and pick up where you left off."*
  Honest about being early — we say "a growing set of sessions, a community just finding
  its feet" rather than faking scale.
- **Explicit anti-patterns** (do NOT do these): no fake social proof / buzz feeds, no
  "founding member" exclusivity gimmicks, no countdown-timer urgency, no "joined N days
  ago" vanity stamps, no aggressive growth-hacking tone.

---

## 3. Who it's for

MotionHive is **two-sided** and a single person can be both (there's a built-in
**Coach / Train** mode toggle).

### A. Coaches / Instructors (the supply side — our priority for growth)
Independent personal trainers, fitness instructors, run/strength/yoga/HIIT coaches,
nutrition-minded fitness pros. People who currently juggle DMs, spreadsheets, a separate
booking app, and a payment link.
- **Their job-to-be-done:** "Give me one place to run my coaching — take bookings, deliver
  sessions and programs, keep my clients on track, get paid, and look professional — without
  a tech headache or a big platform taking a cut."

### B. Members / Clients (the demand side)
People who want structured training and a real coach relationship — beginners who want
guidance, returners who want accountability, and enthusiasts who want programming.
- **Their job-to-be-done:** "Help me find a coach I trust, book time easily, follow a real
  plan, and actually stay consistent — in a community that doesn't feel intimidating."

---

## 4. Core value propositions

**For coaches:**
1. **Your own storefront** — a public profile at `motionhive.fit/@yourhandle` with bio,
   specialties, certifications, and venues.
2. **Run real sessions** — one-off or recurring, online or in person, group or 1-on-1, with
   bookings, waitlists, approvals, and automatic reminders.
3. **Program your clients** — build workouts and multi-week programs/routines from an
   exercise library and assign them to clients.
4. **Keep clients close** — direct messaging, client relationships, and a community of groups.
5. **Get paid, keep your earnings** — built-in payments (memberships, invoices, paid
   sessions) with **0% default platform fee**.

**For members:**
1. **Find your people** — discover coaches, sessions, and groups in one place.
2. **Book in seconds** — clear sessions with prices, locations, and times.
3. **Follow a real plan** — assigned workouts and programs, with progress tracking and a
   workout log you can pick up where you left off.
4. **Belong** — groups, community, and a calm, non-intimidating experience.
5. **Free to join.**

---

## 5. Product surfaces (what exists, where)

| Surface | URL | What it is |
|---|---|---|
| **Marketing website** | `www.motionhive.fit` | Public-facing site: landing, blog/journal, free tools (e.g. calorie calculator), waitlist/sign-up entry. |
| **Web app** | `app.motionhive.fit` | The full authenticated product for coaches and members. |
| **Mobile (PWA)** | installable from the app | The web app is mobile-optimized and installable to the home screen; key flows (messaging, sessions, booking) have dedicated mobile experiences. Not a native App Store app today. |
| **Blog / Journal** | `www.motionhive.fit/blog` | Editorial content: Guides, Nutrition, Science, Wellness. SEO + audience building. |

---

## 6. Feature inventory — what's LIVE today

Grouped by audience. Everything below is real, shipped functionality.

### Discovery & profiles
- **Unified Discover hub** — browse Coaches, Sessions, and Groups in one place, with
  filters (e.g. Strength, Mobility, Boxing, Yoga, HIIT, Pilates).
- **Global search** (⌘K) across coaches, groups, sessions, and tags.
- **Public coach profiles** at `/@handle` — storefront with bio, specialties,
  certifications, location/venues.

### Sessions (coaching delivery)
- **One-off and recurring** sessions; **online or in person**; **group or 1-on-1**.
- **Venues** — coaches define where they deliver (gym, studio, park, outdoor, client's home,
  online).
- **Booking** with prices and clear times; **overflow waitlists**; **approval-to-join** for
  sessions that need it.
- **Automatic reminders**; cancellation windows enforced fairly (terms locked in at booking).
- Mobile-optimized booking and "my sessions" views.

### Workouts, programs & exercises
- **Exercise catalog** (browsable by everyone).
- **Workouts & multi-week programs/routines** that coaches build and **assign to clients**.
- **Active workout logging** with progress tracking; resume an in-progress workout from the
  home screen.
- Client-facing "my plans / my workouts."

### Community & relationships
- **Groups** — create and join communities, member management, join links, group discovery,
  and **group posts** (a lightweight feed).
- **Client ↔ coach relationships** — coaches invite clients, or members request a coach;
  managed states and pending requests.
- **Invitations** to groups and to the platform.

### Messaging (recently redesigned, incl. mobile)
- **Direct messaging** between users, **real-time** delivery.
- **Read receipts**, mute, block, and report — with safety/moderation behind the scenes.
- Full-screen **mobile chat** experience.

### Payments (Stripe Connect)
- Coaches onboard to **Stripe Connect** and get paid directly; **multi-country** support.
- **Memberships/subscriptions**, **invoices**, and paid products.
- **Refunds** (14-day window), earnings views, dispute handling.
- **0 bps default platform fee** (configurable) — "keep what you earn."
- EU consumer-rights compliant billing.

### Engagement & retention
- **Notifications** — in-app notification center + email (e.g. new message, invoice due,
  session reminders).
- **Home / "Start here"** onboarding that guides new users through finishing their profile,
  creating their first session (coaches), and finding a coach (members).
- **Referral loops** — "Invite a friend" (share link or email) and "Suggest an instructor."
- **Blog / journal** for content marketing and SEO.

---

## 7. Key differentiators (lead with these)

1. **Coach-first, not marketplace-first.** Coaches get a real home and storefront, not just
   a listing. They keep their brand and their clients.
2. **Keep your earnings — 0% default platform fee.** A genuine, concrete edge vs platforms
   that take 15–30%.
3. **One place for the whole job:** sessions + programs + messaging + payments. Not a
   booking tool bolted to a payment link to a chat app.
4. **Online or in person, group or 1-on-1** — flexible to how coaches actually work.
5. **Warm and human, not intimidating.** The brand and UX are calm and welcoming — a
   counter-position to hardcore/clinical fitness apps.
6. **Community built in** — groups and a real hive, not a solo utility.

---

## 8. Monetization & positioning

- **Free to join** for both coaches and members.
- Coaches monetize through MotionHive's payments (sessions, memberships, invoices); MotionHive
  takes **0% by default** today.
- **Stage:** early-stage and community-building. Marketing should celebrate being early and
  curated ("a growing set of sessions, a community finding its feet") rather than claim mass
  scale. Growth is intended to be **word-of-mouth** ("the hive grows by word of mouth").

---

## 9. Story-able user journeys (great for ads, demos, emails)

1. **Coach goes pro in an afternoon:** claim your handle → set up your profile and a venue →
   create your first session → share your storefront link → take your first booking and get
   paid.
2. **Member finds their coach:** open Discover → filter by what you want (e.g. Mobility) →
   read a coach's profile → book a session → get a reminder → show up.
3. **Stay consistent:** coach assigns a 6-week program → member logs workouts → picks up
   where they left off from the home screen → messages their coach for a tweak.
4. **Grow the hive:** a happy member invites a friend, or suggests a coach they love.

---

## 10. Messaging themes & sample angles

Use these as campaign pillars (adapt voice to the calm/human tone):

- **"Run your coaching from one calm place."** (coaches; all-in-one)
- **"Keep what you earn."** (coaches; 0% fee)
- **"Your storefront, your clients, your brand."** (coaches; ownership)
- **"Find a coach you'd actually train with."** (members; trust)
- **"A plan that meets you where you are."** (members; programs + consistency)
- **"Train together."** (community / referral)
- **"Online or in person — coaching that fits how you work."** (flexibility)

Headlines should be plain and warm, not hype. Favor specifics (sessions, programs, get paid)
over adjectives.

---

## 11. CTAs / actions to drive

- **Coaches:** "Start coaching on MotionHive" / "Claim your handle" / "Create your first
  session."
- **Members:** "Find your coach" / "Discover sessions" / "Join free."
- **Both:** "Invite a friend" / "Suggest a coach."
- **Top-of-funnel (website):** free tools (calorie calculator), blog content, waitlist/sign-up.

---

## 12. SEO / content & channel notes

- **Blog pillars:** Guides, Nutrition, Science, Wellness — practical, evidence-aware, calm.
  Great for organic search and for giving coaches shareable material.
- **Free tools** on the website (e.g. calorie calculator) are useful top-of-funnel SEO assets.
- **Keyword themes:** "online personal trainer platform," "coaching business software,"
  "book a fitness coach," "group fitness sessions," "fitness coach payments / Stripe,"
  "training programs app," plus long-tail by discipline (strength, mobility, running, yoga,
  HIIT, Pilates) and by city (in-person venues).
- **Word-of-mouth & referral** is the core growth motion — design campaigns that activate
  existing coaches to bring their clients, and clients to bring friends.

---

## 13. Guardrails — do NOT claim these (not live yet / be careful)

Marketing must stay accurate. As of now, the platform does **not** have:
- **Native iOS/Android App Store apps** — it's a mobile-optimized, installable **web app
  (PWA)**. Say "works great on your phone / installable," not "download on the App Store."
- **Push or SMS notifications** — notifications are **in-app + email** today.
- **Group chat / typing indicators / online-presence** in messaging — messaging is
  **1-on-1 DMs**; groups exist as communities/feeds, not as chat rooms.
- **Live video / calling inside the app** — "online" sessions are delivered via the coach's
  meeting link, not an in-app video product.
- **Large scale / big numbers** — we're early; don't imply a huge existing user base.

When in doubt, describe the *job it does for the user* rather than a specific number or a
roadmap feature.

---

## 14. Quick facts sheet (for fast reference)

- **Product:** MotionHive — community-first fitness coaching platform.
- **Audiences:** independent fitness coaches/instructors + members/clients (dual-mode).
- **Surfaces:** marketing site (`www.motionhive.fit`), web app (`app.motionhive.fit`),
  installable PWA, blog.
- **Live features:** discovery & search, coach storefronts, sessions (online/in-person,
  group/1-on-1, recurring, waitlists, reminders, venues), workouts & programs & exercise
  library with client assignment + logging, groups & posts, direct messaging with read
  receipts/safety, payments via Stripe Connect (memberships/invoices/refunds), notifications
  (in-app + email), onboarding "Start here," referrals/invites.
- **Pricing:** free to join; **0% default platform fee** on coach earnings.
- **Brand:** the hive; hexagon; honey/navy/teal/coral; warm, calm, human, light-first.
- **Stage:** early, community-building, word-of-mouth growth.
- **Don't claim:** native apps, push/SMS, group chat, in-app video, big scale.

---

*Maintainers: keep this file updated as features ship so marketing never gets ahead of the
product. Last reflects the product state as of the current build.*
