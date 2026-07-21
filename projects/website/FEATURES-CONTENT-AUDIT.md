# Features content audit — copy vs. reality

I wrote the feature/pricing/home copy from the **design mockups**, before checking the
backend. This maps every non-obvious claim to what the code actually does, so we fix
inaccuracies and drop the fee promises we don't want to make. Review the **Decisions**
at the bottom; nothing is changed yet.

Backend checked: `beeactive-api/src/modules/*` (controllers, entities, CLAUDE.md).

---

## 0. The positioning rule (from you)

- **"Free" means: no subscription to manage your clients.** Say *free to run your
  coaching / manage clients*, not "no platform fee", "no cut", "keep 100%".
- **Do not mention commission / platform fee at all** — not to claim we take it, not to
  claim we don't. (The code *has* a per-instructor `platform_fee_bps`, default 0 but
  configurable and applied to invoices/subscriptions, so any "no fee ever" line is both a
  business promise and contradicts the system.)
- **Premium, later = extra tools beyond managing clients**, never a paywall on the core.

---

## 1. Verified ACCURATE (keep as-is)

| Feature | Claim | Reality |
|---|---|---|
| Storefront | public page at your handle, bookable | `profile` by-handle + `session` bookings ✓ |
| Sessions | recurring, capacity + auto-promote waitlist, 1:1, online + meeting link, cancellation windows, reminders | `session` module (all present per CLAUDE.md) ✓ |
| Programs | build weeks/days, reuse across clients, sets/reps/load/rest, **swap on a client's copy**, clients tick off, coach sees who trains | `program` + `program-assignment` (copy-on-assign deep clone w/ per-assignment overrides) + `workout-log` ✓ |
| Exercises | own library, **clips**, cues, tag by muscle/equipment, drop into programs, **fork** | `exercise` (mediaKind YOUTUBE/VIDEO/IMAGE, `instructions`, muscle + equipment, `:id/fork`) ✓ |
| Payments | card payments, recurring memberships, invoices, who paid, refunds | `payment` (subscriptions, invoices, 14-day refund window) ✓ |
| Community | create groups, invite link, updates the group sees, approve who joins, sessions + posts together, scales | `group` (join links, join-requests/approval) + `post` (feed) ✓ |

---

## 2. Must fix — INACCURATE / INVENTED

### 2a. Group messaging is NOT live (invented)
`conversation.entity.ts`: *"v1 only writes DIRECT. GROUP rows are accepted by the schema
but no [code writes them]."* Messaging today is **1:1 only**.
- `feat.messaging.c2` "Talk to a whole group at once" → **remove** (or move to roadmap)
- `feat.messaging.q2` "Can I message a whole group? Yes…" → **rewrite** (1:1 only)
- `feat.messaging.b1b` mentions a "group" check-in → soften to 1:1

### 2b. Roadmap says "Comments and reactions" are Coming soon — they're BUILT
`post_comment` + `post_reaction` tables and endpoints exist.
`features.rm.s3` "Comments and reactions" under **Coming soon** is wrong.
→ Move to "Available now" or drop. (Your call on whether it's *surfaced* in the app yet.)

---

## 3. Must fix — FEE / "FREE-FOREVER" PROMISES (reposition, ~24 strings)

Every line below makes the promise you want to avoid. Proposed replacements keep the
"free to coach, no subscription" wedge without touching commission.

| id | Current | Proposed |
|---|---|---|
| `home.g2` | "No platform fee" | "No subscription" |
| `home.coach.p3` | "Get paid, keep what you earn" | "Get paid for your sessions and plans" |
| `home.free.h` | "Free. Actually free." | keep (it's about the product being free) |
| `home.free.sub` | "…no cut of what you earn. You coach, you keep it." | "No subscription and no per-client pricing. Free to run your whole coaching." |
| `home.free.s2` | stat "0% / platform fee" | "0 / subscriptions" (or drop this stat, see Decisions) |
| `home.meta.description` | "…no platform fee." | "…no subscription to manage your clients." |
| `feat.storefront.c6` | "Free, with no cut of what you charge" | "Free to set up and share" |
| `feat.storefront.md` | "…no platform fee." | "…no subscription." |
| `feat.sessions.md` | "No platform fee." | "No subscription." |
| `feat.payments.one` | "Get paid, keep what you earn" | "Get paid for sessions, packages and memberships" |
| `feat.payments.h1a/b` | "…without becoming a debt collector." | keep (it's about chasing transfers, not fees) |
| `feat.payments.c6` | "Keep what you earn, with no platform fee" | "Card, invoices and memberships in one place" |
| `feat.payments.b3t/b3b` | "Your money stays yours / MotionHive takes no cut…" | **remove this whole benefit card** (replace with a payments benefit that isn't about fees, e.g. "One place for what you're owed") |
| `feat.payments.a1` (FAQ "Does MotionHive take a cut?") | "No. There is no platform fee…" | **remove the question entirely** (answering it either way breaks the rule) |
| `feat.payments.mt/md` | "…no platform fee" | "…no subscription" |
| `pricing.pf5` | "Payments, keep what you earn" | "Payments: card, invoices, memberships" |
| `pricing.pf8` | "No platform fee, ever" | "No subscription to manage clients" |
| `pricing.faq1.a` | "…no platform fee. We may add optional paid extras…" | "…no subscription. Later we may add optional premium tools *beyond* managing clients, but running your coaching stays free." |
| `pricing.faq3.a` (How do you make money?) | "…never a cut of your core coaching." | "Optional premium tools later, on top of the free core. Managing your clients stays free." |
| `pricing.faq4` (Is there a catch on payments?) | "…MotionHive takes no platform fee on top." | **remove the question** (it invites the fee topic) |
| `pricing.cmp4` row | "Keep your earnings — 100%, no platform fee / Platform cut" | **replace the row** with "Cost to manage clients — Free / Monthly subscription" (or drop it) |
| `pricing.meta.*` | "no platform fee" | "no subscription" |
| `features.meta.description` | "…no platform fee." | "…no subscription." |

---

## 4. Decisions for you

1. **"Unlimited clients" / "forever" / "no trial timer"** — true today (no client cap in
   code), but they're forever-promises. Keep as present-tense facts, or soften? I lean:
   keep "unlimited clients" (it's real), drop "ever"/"forever" absolutes.
2. **The "0% platform fee" stat** on the home free-band and the pricing comparison row are
   the two loudest fee statements. Replace with a subscription framing, or remove entirely?
3. **Roadmap accuracy** — the Coming-soon / Exploring items (mobile app, nutrition, studios,
   deeper scheduling, challenges) I took from the design's strategy doc, not your real plan.
   Give me the actual roadmap and I'll make it true. And comments/reactions need moving out
   of Coming-soon.
4. **Group messaging** — remove the claim entirely, or phrase as "1:1 today, groups coming"?
5. **Anything important we're NOT saying?** Candidates the backend supports that no page
   mentions: **client requests / roster management** (`client` module), **venues**
   (`venue`), **analytics for coaches** (`analytics`), **reviews** (`review`). Worth a
   feature or a line?
