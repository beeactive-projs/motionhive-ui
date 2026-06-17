# MotionHive — Buttons & Tabs Standardization Audit

> **Goal:** give the platform **one consistent action language** so a user can learn
> "this colour / shape = this kind of action" and scan any screen for it. This doc is
> the data-driven current-state audit + a ready-to-paste **prompt for Claude Design**
> (§6) to turn it into a system.
>
> Scope order: **buttons first** (the bulk of actions), then **tabs / segmented
> controls**. Numbers below are from a sweep of `projects/web/src/app` (the
> authenticated app) on 2026-06-17; `projects/website` is smaller and follows the
> same primitives.

## How to read this file
- **§1–4** — what exists today (components, colours, variants, sizes, action→style).
- **§5** — the inconsistencies (the actual problem).
- **§6** — **PROMPT FOR CLAUDE DESIGN** — paste this to get a button/tab system back.
- **§7** — reference: the colour tokens that drive everything.
- **§8** — tabs / segmented controls inventory.
- **§9** — running notes: other inconsistencies spotted while sweeping (kept updated).

---

## 1. What renders an action today

| Mechanism | Where | Notes |
|---|---|---|
| **PrimeNG `p-button`** (`Button` standalone) | **136 component files** | The primary mechanism. Styled by the **`MotionHiveLara`** preset in [`core/src/styles/styles.primeng.ts`](../projects/core/src/styles/styles.primeng.ts) over the Lara theme. Radius = Lara default (~6px); `rounded` → 50rem pill. |
| **Native `<button class="…">`** | **~70 occurrences** | Bespoke per-feature buttons that **bypass `p-button`** entirely — e.g. `disc__btn`, `disc__btn--soft`, `disc__btn--primary`, `mode-switch__btn`, `search-modal__pill`, `mh-cal__view-btn`, `mh-mob-cal__view-btn`, `action-list__danger`, `search-trigger`. These cannot be themed centrally. |
| **Anchors / `routerLink` styled as buttons** | scattered | Navigation actions that look like buttons. |
| **Shared core primitives** | `core/src/lib/components/` | `sticky-cta`, `mobile-fab`, `action-list`, `tri-state-toggle` — partially standardized building blocks. |

**Colour source of truth:** [`core/src/styles/theme-colors.ts`](../projects/core/src/styles/theme-colors.ts) (palette) → `MotionHiveLara` preset. No global button `borderRadius` override, so button radius is inherited from Lara.

---

## 2. Button colour (`severity`) usage — counts

| `severity` | Count | Intended meaning | Reality on the platform |
|---|---:|---|---|
| `secondary` | **176** | neutral / lower-priority | **Catch-all.** Used for cancel, edit, neutral, "everything that isn't the primary CTA". Overloaded. |
| (none → **primary**) | many + **14 explicit** | the one main CTA | Default when no `severity`. Honey/amber. Generally OK but mixed with explicit `primary`. |
| `danger` | 50 | destructive | delete, remove, reject, log out, **and** some cancels |
| `warn` | 38 | caution / reversible-negative | reject, cancel-request, inactive — overlaps `danger` |
| `contrast` | 29 | high-contrast neutral (navy) | cancel, some primary-ish actions |
| `success` | 22 | positive confirm | approve, accept |
| `info` | 15 | informational | info badges/actions |
| `help` | 0 | — | unused |

## 3. Variants & sizes

| Variant | Count | | Size | Count |
|---|---:|---|---|---:|
| `rounded` (icon buttons) | 131 | | `size="small"` | **324** |
| `outlined` | 87 | | `size="large"` | 27 |
| `text` (`[text]` 81 + `text` 47) | **128** | | _normal (unmarked)_ | the rest |
| `fluid` | 35 | | | |
| `link` | 1 | | | |
| `raised` | 0 | | | |

> **`size="small"` (324) is the de-facto default** — overwhelmingly more common than
> normal or large. That strongly implies the base button is too big and everyone
> opts down. A standard should probably **redefine the default size** rather than
> sprinkle `small` everywhere.

---

## 4. Current action → style mapping (sampled from real labels)

This is the core evidence. The **same action is styled many different ways**:

| Action (label) | Occurrences | Styles seen in the wild |
|---|---:|---|
| **Cancel** | 42 | `text` ×23 · `contrast` ×14 · `secondary` ×10 · `danger` ×4 · `outlined` ×2 — **5 different looks** |
| **Delete** | 3 | `danger` ×2 · `outlined` · `text` |
| **Save** | 11 | `primary` · `secondary` · `text` (inconsistent) |
| **Create** | 15 | default primary (mostly consistent ✅) |
| **Edit** | 9 | `secondary` ×5 · `outlined` ×4 · `text` |
| **Reject** | 2 | `danger` · `warn` · `secondary` · `text` |
| **Decline** | 2 | `danger` · `secondary` · `outlined` · `text` |
| **Approve / Accept** | 5 | `success` · `primary` · `text` (mixed) |
| **Send** | 13 | `primary` (mostly consistent ✅) |
| **Log out** | 1 | `danger` text |

---

## 5. Inconsistencies — the problem to fix

1. **"Cancel" has no canonical style** — 5 variants across 42 uses. Same for Edit, Reject, Decline, Accept.
2. **`secondary` is overloaded** (176) — it means "not primary" rather than a specific intent, so it carries no signal.
3. **`warn` vs `danger` boundary is undefined** — destructive/negative actions split arbitrarily between them.
4. **`size="small"` is the real default** (324 vs everything else) — the base scale is wrong.
5. **~70 native buttons bypass `p-button`** — bespoke `disc__btn*`, pills, calendar view toggles, etc. drift independently and can't be re-themed centrally.
6. **`text` buttons double as links** (128) while the real `link` variant is used once — "is this a button or a link?" is ambiguous.
7. **Icon-only `rounded` buttons** (131) have no standard for size / tooltip / hit-area.
8. **No radius standard** — Lara default (~6px) vs `rounded` pills (50rem) vs custom button radii coexist with no rule for when to use which.

---

## 6. PROMPT FOR CLAUDE DESIGN

> Paste everything in this block into Claude Design.

```
You're helping standardize the ACTION SYSTEM (buttons first, then tabs) for
MotionHive — a fitness platform (instructors + clients). We want ONE consistent
visual language so users can recognise an action TYPE by its colour/shape and
scan any screen for it. Tech: Angular 21 + PrimeNG 21 (Lara preset) + Tailwind 4.

BRAND PALETTE (already in the codebase — design WITHIN these):
- Primary "Honey Amber": #F59E0B (500), hover #FB923C (400), active #D97706 (600)
- Navy (headings/contrast): #0E1B31 / #12233D / #1E3A5F
- Success (Emerald): #10B981   Info (Sky)   Warn (Amber/Orange)   Danger (Red)
- Brand accents: Coral #F97066 (community/live), Teal #14B8A6 (online/community)
- Surfaces: slate/surface neutrals. Light theme is PRIMARY; dark must also work.
The signature shape is a flat/point hexagon (used for avatars & icon badges).

WHAT EXISTS TODAY (the mess to fix):
- "Cancel" is styled 5 different ways (text / contrast / secondary / danger /
  outlined). Edit, Reject, Decline, Accept are similarly scattered.
- `secondary` severity is overused (176×) as a catch-all with no meaning.
- `warn` vs `danger` split arbitrarily for negative/destructive actions.
- `size="small"` is used 324× vs normal/large — the base size is effectively wrong.
- ~70 buttons are bespoke (bypass the component) and drift.
- `text` buttons (128×) blur the line between button and link.

DELIVERABLES — give me a concrete, buildable spec (values I can drop into a
PrimeNG preset + Tailwind), NOT just mockups:

1) ACTION TAXONOMY → STYLE. Define a small set of action classes and assign each
   ONE canonical treatment (colour, fill vs outline vs text, weight). At minimum:
   - Primary CTA (the one main action per view)
   - Secondary action (neutral, lower priority)
   - Tertiary / "quiet" action (cancel, dismiss, back)
   - Constructive/confirm (approve, accept, save)
   - Destructive (delete, remove) — and whether "reject/decline" is destructive
     or just negative, with a distinct treatment if needed
   - Navigational / link-style action
   - Icon-only action (toolbar/row actions)
   Show each on light AND dark, with hover / active / focus / disabled states.
   Give exact colours (from the palette above) and contrast notes (WCAG AA).

2) SIZE SCALE. Recommend the DEFAULT size and a small/large step (px paddings,
   font size, height, icon size). Assume most buttons want to be compact.

3) RADIUS / SHAPE. One radius rule: when is a button a soft-rect vs a pill? Give
   the radius value(s). Note where (if ever) the hexagon motif belongs on actions.

4) ICON BUTTONS. Standard size, hit-area, and when an icon-only button is allowed
   vs needs a label.

5) A ONE-PAGE "ACTION LEGEND" the team can pin up: colour swatch → action type →
   example label, so anyone can pick the right button in 2 seconds.

6) TABS / SEGMENTED CONTROLS (second priority): we currently mix PrimeNG underline
   tabs, segmented SelectButtons, and ~half a dozen bespoke chip/segmented rows
   (filter chips, a sidebar Coach/Train switch, tri-state toggles). Propose ONE
   tab pattern and ONE segmented-control pattern (with states), and a rule for
   when to use tabs vs segmented vs filter-chips.

Output: a spec doc with exact values + one HTML preview sheet showing the button
classes (all states) and the tab/segmented patterns at our sizes. Keep honey as
the primary, navy for contrast, and respect the light-first brand.
```

---

## 7. Reference — colour tokens (for Design & implementation)

From [`theme-colors.ts`](../projects/core/src/styles/theme-colors.ts):

| Role | Colour | 500 hex |
|---|---|---|
| Primary | Honey Amber | `#F59E0B` (hover `#FB923C`, active `#D97706`) |
| Success | Emerald | `#10B981` |
| Info | Sky | (sky-500) |
| Warn | Amber/Orange | (warning scale) |
| Danger | Red | (danger scale) |
| Navy (contrast) | Midnight Navy | `#12233D` |
| Coral (accent) | Coral | `#F97066` |
| Teal (accent) | Teal | `#14B8A6` |

Button preset overrides live in `styles.primeng.ts` (`button` section): per-variant
(outlined/text) per-severity colour mixes. Tabs preset: underline style, 3px bottom
border, transparent background.

---

## 8. Tabs / segmented controls inventory (second-priority scope)

Three competing paradigms are in use:

| Pattern | Component | Count | Where |
|---|---|---:|---|
| Underline tabs | PrimeNG `p-tabs` / `p-tablist` / `p-tab` | ~20 | profile tabs, group detail, invite-friend dialog, etc. |
| Segmented | PrimeNG `p-selectbutton` | 4 | a few filter/mode pickers |
| Toggle | PrimeNG `p-togglebutton` | 1 | one spot |
| **Bespoke chip/segmented rows** | native `<button>` + CSS | many | Discover (`disc__tab`, `disc__chip`), Messages `inbox-filters` chips, **sidebar `mode-switch` (Coach/Train, new)**, core `tri-state-toggle`, `week-strip`, session list/calendar view toggles, billing & safety sub-tabs, `group-tags-card` |

**Inconsistency:** the same "switch between N views" need is solved at least 3 ways
(PrimeNG tabs vs SelectButton vs hand-rolled chips). Needs one tab standard + one
segmented standard (see prompt §6.6).

---

## 9. Running notes — other inconsistencies seen while sweeping

_(Kept updated as we touch more of the app.)_

- **Avatars** were split between a circular `mh-avatar` and a hexagon `mh-hex-avatar`/raw `<img>`. Now unified: `mh-avatar` renders the brand **hexagon by default**, with `[circle]="true"` kept only for the nav account menu and the user's own profile hero. A few surfaces had photo-as-rounded-`<img>` next to hex-initials (home journal/coaches) — fixed to always hex.
- **Group badges** use a solid palette colour (gradient isn't valid as an SVG `fill`), so they look slightly flatter than the old CSS-gradient `p-avatar`. Acceptable, but note if Design wants gradient badges we'd need an SVG `<linearGradient>`.
- **Segmented-control sprawl:** the new sidebar Coach/Train `mode-switch` is *yet another* bespoke segmented control — it should fold into whatever segmented standard Design defines (don't let it become a 5th pattern).
- **Honey-on-white contrast:** primary honey (`#F59E0B`) text/!icons on white can be borderline for AA; the codebase already nudges to amber-600 for text-on-white in places. Flag for the Design pass.
- **`invite-friend` modal:** removed the decorative hexagon hero (per request) — keep an eye out for other purely-decorative hex/emoji heroes in dialogs for consistency.
- **Cancel/dismiss in dialogs:** worth a single rule — most dialogs have a footer with a primary confirm + a quiet cancel; today that cancel is inconsistent (text vs contrast vs secondary).
