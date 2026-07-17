# MotionHive Website Redesign — System & Plan

Branch: `website-redesign` (off `develop`). Blog is already redesigned and shipped; this
covers the **nav, home, pricing, features** and the **reusable system** underneath them.

Design source of truth (verified canonical, not scratch):
`Downloads/MotionHive (2)/` → `MotionHive - Homepage.html`, `- Pricing.html`, `- Features.html`,
`- Feature - {Storefront,Sessions,Programs,Exercises,Payments,Messaging,Community}.html`
(one byte-identical template ×7), `components/tokens.jsx` (token values), and
`motionhive-redesign/hex-core.js` + `Hexagon System.html` (the hex engine).
Everything under `header-concepts/`, most of `motionhive-redesign/*.jsx`, `home-coldstart/`,
`messaging*/`, `profile/`, etc. is **in-app** design, not the marketing site — ignore for this work.

---

## 1. Principles

1. **Build the system once, assemble pages from it.** Every page is a stack of shared section
   components. No page invents its own layout primitives.
2. **Data-driven features.** One `FEATURES` array (7 entries) drives the mega-menu, the homepage
   feature grid, the features overview, and the 7 feature pages (one template). Adding/editing a
   feature = editing data, not markup.
3. **Reuse the app's primitives.** `mh-hex` (extended) is the brand atom — every avatar, icon
   badge, checkmark bullet, logo mark, and honeycomb watermark comes from it, not hand-rolled
   clip-paths.
4. **Static + prerendered + SEO-first.** Marketing content is baked into the HTML at build (no
   client fetch), one H1/page, full meta + JSON-LD per page per locale, real 404. Every page must
   pass a Screaming Frog crawl clean (§7).
5. **Light + dark, mobile + desktop, for everything.** The design shipped light-only (except the
   blog); we generalize the blog's dark-token pattern sitewide via our existing `.dark` class.

---

## 2. Design tokens (mapped onto our existing theme)

Our theme already has: Poppins (`--font-heading`), Inter (`--font-sans`), navy/accent(teal)/coral
ramps, PrimeNG amber primary (`--p-primary-*`), surfaces, `.dark` strategy. Deltas to add:

- **Keep the current site background everywhere** (DECISION): the existing public-layout backdrop
  (honeycomb + orbs + surface tokens) stays on all pages — we do NOT introduce the design's cream.
  Marketing sections still layer white/dark card surfaces and amber-wash / dark bands on top of it.
- **JetBrains Mono** for kickers/eyebrows/meta/breadcrumbs → add `--font-mono` + load the font.
- **Semantic surface tokens** (generalize the blog's dark set sitewide):

  | token | light | dark |
  |---|---|---|
  | `--mh-bg` | current site bg (public-layout backdrop) | current dark bg |
  | `--mh-surface` | `#FFFFFF` | `#141B2B` |
  | `--mh-ink` | `#131827` (navy-900) | `#F2F5FA` |
  | `--mh-ink-soft` | `#323B50` (navy-600) | `#C7D0E0` |
  | `--mh-muted` | `#4A5368` (navy-500) | `#93A0B8` |
  | `--mh-line` | `#E6EAF2` (navy-100) | `#232C40` |
  | `--mh-nav-bg` | `rgba(251,250,247,.88)` | `rgba(12,17,30,.82)` |

  Amber (`--p-primary-500 #F59E0B` / `-600 #D97706` hover / `-700 #B45309` kicker text) and the
  navy/teal/coral/success ramps already exist — reuse, don't redefine.

- **The amber rule (load-bearing brand law):** amber is used for exactly four things — the primary
  CTA, one keyword per heading (honey underline), the trailing period on statement headings, and
  the active nav/tab. Never more than three amber accents per visual block. "Coming soon" and
  inactive states demote to muted.

- **Type scale** (Poppins headings, weight 800 for heroes): H1 hero 60/56/52/50px by page,
  H2 sections 32–44px, H3 cards 15–19px, body 15–20px, kicker 11–12px mono uppercase.
- **Spacing/shape:** content max-width `1140px`, gutter `28px`, section padding `64–84px`,
  radius scale `999 / 12 / 14–16 / 18 / 20 / 26`, universal card border `1px solid --mh-line`,
  navy-tinted shadows (never pure black), card hover = lift 3px + border→amber.

Tokens live in `core/src/styles/theme.css` (shared) + a small marketing layer; documented once,
consumed everywhere.

---

## 3. The reusable component system

### 3a. Extend `mh-hex` (don't rewrite)
Our `mh-hex` already does tones/img/label/icon/status/sheen. The design's `hex-core.js` adds a few
marketing needs — add as inputs/variants:
- **`checkmark` content** → the hex-check bullet (small hex + ✓) used in every checklist.
- **emoji glyph** feature badge (40–58px, amber/teal/navy tone) — already expressible via
  projected content; add a `badge` size preset.
- **honeycomb watermark** util (`hexHoneycombUrl()` → data-URI tile, 56×100px, stroke flips
  navy↔amber by surface) as a shared SCSS mixin/function (we already have `$honeycomb-svg-*`).

### 3b. New shared components (website `_shared/` or `core` where app-reusable)

| Component | Selector | Purpose | Reused by |
|---|---|---|---|
| Header / nav | `mh-public-header` (rebuild) | sticky nav + Features mega-menu + mobile drawer + theme toggle + lang switcher + CTA | all pages |
| Footer | `mh-public-footer` (rebuild) | dark navy 4-col footer | all pages |
| Kicker/eyebrow | `mh-kicker` | mono pill + hex bullet + label (tone) | every section header |
| Section header | `mh-section-header` | kicker + H2 (amber keyword + period) + sub | every band |
| Button | reuse `p-button` + `.btn-primary/.btn-ghost` presets | CTAs | site-wide |
| Feature card / tile | `mh-feature-card` | hexbadge + title + desc + link | home grid, overview, mega-menu, related |
| Generic card | `.mh-card` (mixin/class) | white surface, line border, hover lift→amber | ~9 uses, one visual language |
| Hex-check list | `mh-check-list` | checklist with hex-check bullets | hero guarantees, "what you can do", plan |
| Device demo | `mh-media-demo` | browser-chrome frame + **GIF/video placeholder** + play + caption | homepage, every feature hero |
| CTA band | `mh-cta-band` | dark-navy or amber-wash full-bleed closer, kicker+H2+dual CTA + honeycomb | every page (≥1) |
| Comparison table | `mh-compare-table` | MotionHive vs "typical apps" | pricing |
| FAQ accordion | `mh-faq` | native `<details>` + amber +/− | pricing, feature pages |
| Roadmap lanes | `mh-roadmap` | 3-lane kanban (now/soon/exploring) | features overview |
| Stat cards | `mh-stat` | big number + label (free story, pricing) | home, pricing |
| Proof strip | `mh-proof-strip` | row of hex-bullet pills | home |

Cross-app note: `mh-kicker`, `mh-section-header`, `mh-cta-band`, `mh-faq`, `mh-media-demo`,
`mh-stat` are generic → live in `core` so the app can reuse them. Marketing-specific composites
(`mh-feature-card`, `mh-compare-table`, `mh-roadmap`, header/footer) live in `website`.

### 3c. Features data
`website/src/app/_data/features.ts` — one array of 7: `{ slug, name, kicker, icon(emoji/hex-icon),
tone (amber|teal), oneLiner, hero{h1,intro}, capabilities[6], benefits[3], faq[3], related[3],
previewSrc (GIF/video placeholder) }`. Drives mega-menu, home grid, overview, and the single
`feature-detail` page template.

---

## 4. Page assembly

Each page = shell (header/footer) + a stack of the §3 sections. Copy is real, translated per locale.

- **Home:** hero (2-col: copy+CTAs+hex-check guarantees | animated hex cluster) → proof strip →
  two paths (coach/member) → "see it work" (device demo + 8-tile feature grid) → free story (dark
  stat band) → community (3 cards) → blog teaser (3 `mh-blog-post-card`, already built) → CTA band
  → footer.
- **Pricing:** hero → single dark `$0/forever` plan card (hex-check features) → "no catch" 4-card →
  comparison table → FAQ → CTA band. (Single free plan, **no tiers/toggle** — deliberate.)
- **Features overview:** hero → 8-card overview grid → "for members" 3 cards → roadmap lanes →
  CTA band.
- **Feature detail (×7 from one template):** breadcrumb → hero (copy + device demo) → "what you can
  do" hex-check list → "why coaches love it" 3 cards → FAQ → "explore more features" → CTA band.

---

## 5. Navigation (rebuild) — the mega-menu + GIF, designed fresh

The export's mega-menu is a plain 320px list with **no preview area**, and there's **no mobile
nav** at all. Per your ask, design fresh:

- **Desktop Features mega-menu:** two-pane dropdown. Left = the 7 feature rows (hexbadge + name +
  one-liner, amber/teal tone) as a selectable list; right = a **preview panel** that shows the
  hovered feature's **GIF/video** (muted autoplay loop, static poster fallback) + a short line +
  "See how it works →". For now the preview is a **labelled placeholder** per feature (you'll drop
  in GIFs later); the `<video>`/`<img>` swap is wired so replacing the asset is a one-line data
  change. Footer row: "View all features →".
  - Perf/SEO: lazy-load the preview asset on hover, `preload="none"`, poster image with explicit
    dimensions (no CLS). Recommend short muted `<video>` over literal GIF (the design audit says the
    same — far smaller for the same motion).
- **Nav links:** `Features ▾` · `Pricing` · `Blog` · (`Tools ▾` kept — we already have the calorie
  calculator; "For coaches" dropped until that page exists). Brand hexmark+wordmark, theme toggle
  (now sitewide, not just blog), working language switcher (we already have `mh-language-switcher`),
  primary CTA "Start coaching — free".
- **Mobile:** hamburger → full-height right drawer (reuse the pattern from the blog TOC drawer);
  Features expands to an inline accordion of the 7 rows (no hover preview on touch). Everything is
  real `<a href>` (crawlable).

---

## 6. Light + dark, mobile + desktop
- Dark via existing `.dark` class + the `--mh-*` semantic tokens (§2). Theme toggle in the nav,
  persisted (reuse the app `ThemeService`). Honeycomb watermark stroke flips navy→amber in dark.
- Mobile-first: single-column stacks, the nav drawer, device-demo scales, comparison table scrolls
  in its own container. Test at 360 / 768 / 1024 / 1280.

---

## 7. SEO system (baked in, Screaming-Frog-clean)

Extend `SeoService` + add a JSON-LD helper; wire per page:
- **Per page:** unique `<title>` (~55 chars) + meta description (140–160), self-referencing
  absolute canonical, reciprocal EN/RO hreflang + `x-default`, OG/Twitter (`summary_large_image`,
  1200×630, `og:locale` + alternate). One `<h1>`, correct heading order, descriptive links, image
  `alt` + explicit `width`/`height` + lazy (except LCP hero) + AVIF/WebP.
- **Heading rule (load-bearing):** each page's **hero hand-writes the single `<h1>`**; every
  section band uses `mh-section-header`, which emits `<h2>`. (`mh-section-header` can't
  conditionally switch tags — one `<ng-content>` can only project once — so the hero owning its
  own H1 is both the simplest and the most semantic split.) Assert it in the build: every page
  must have exactly one `<h1>`. Missing/duplicate H1 is a top Screaming Frog flag.
- **JSON-LD:** `Organization` + `WebSite` (home), `SoftwareApplication`/`Product`+`Offers`
  ($0) (home + pricing — **no fake ratings**), `BreadcrumbList` (feature pages), `BlogPosting`
  (already done). FAQ stays as readable content only — Google **retired FAQ rich results (May
  2026)**, so no FAQPage schema chase.
- **Static content:** marketing pages carry their copy in the template (no runtime fetch) so it's
  fully in the prerendered HTML. Add the new routes to the prerender + sitemap; ensure a **real
  404** (fix the SPA soft-404: unmatched routes must return HTTP 404, not 200).
- **CWV:** preload the LCP hero image (`fetchpriority=high`, AVIF/WebP), `font-display:swap` +
  preload above-the-fold fonts, explicit media dimensions everywhere, minimal per-route JS.
- **Content voice:** no AI tells — follow `docs/content/content-playbook.md` + the `content-seo`
  skill (no em dashes, no rule-of-three tics, native RO copy, one honey-underlined keyword per
  heading). Marketing copy reviewed with that gate before ship.
- **Release gate:** a "Screaming Frog pass" checklist (unique titles/desc/H1, alt text, canonical,
  hreflang reciprocity, no broken links/redirect chains, no orphans, JSON-LD validates).

---

## 8. Routing
Add under `PublicLayoutComponent`: `/pricing`, `/features`, `/features/:slug` (7). Update nav.
Prerender all (static params for the 7 feature slugs). Sitemap + hreflang updated. Keep `/blog`,
`/tools/*`, `/about`, `/legal/*`.

---

## 9. Build order (phased)
1. **Token + primitive layer:** `--mh-*` tokens + cream + JetBrains Mono; extend `mh-hex`
   (check/badge/honeycomb); `mh-kicker`, `mh-section-header`, `.mh-card`, `mh-check-list`,
   `mh-cta-band`, buttons.
2. **Shell:** rebuild header (nav + mega-menu + mobile drawer + theme toggle) + footer. Verify
   light/dark + mobile.
3. **Home** — assemble from sections. Verify + Screaming-Frog-lint.
4. **Pricing** — plan card, compare table, FAQ.
5. **Features** — data array + overview + roadmap + the feature-detail template (×7).
6. **SEO pass** — SeoService/JSON-LD, prerender routes, sitemap, 404, CWV, crawl-clean check.
7. **Content pass** — final EN + RO copy through the content-seo gate.

---

## 10. Decisions (LOCKED)
1. **Scope:** system + nav + home + pricing first; features overview + 7 feature pages in a second
   pass. Until then the mega-menu's feature rows link to `/features` (placeholder) / anchors.
2. **Mega-menu preview:** muted autoplay `<video>` loop + static poster (lazy on hover).
3. **Nav items:** Features · Pricing · Blog · Tools. "For coaches" dropped.
4. **Background:** keep the current site background everywhere — no cream (see §2).
5. **`mh-hex`:** extend the existing `core` component (add check/badge/honeycomb), no marketing fork.
