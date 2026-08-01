# MotionHive Website — Content & Design Standards

Single source of truth for how the marketing website (`projects/website`) looks and reads,
in **EN and RO**. If the code disagrees with this doc, the doc wins (or we change the doc
first). Companion to `REDESIGN-PLAN.md` and the content playbook
(`beeactive-api/docs/content/content-playbook.md`). Canonical visual reference:
`~/Downloads/MotionHive (2)/MotionHive - *.html`.

---

## 1. Titles / headings

**Accent colour (amber, `--p-primary-color`) is reserved for the ONE hero H1 at the top of
each page.**

- Exactly **one** accented word or short phrase per page, on the **hero H1 only**.
- **Every other heading** (mid-page sections, the final CTA band, cards) is plain ink
  (navy). No amber word, no amber period.
- Enforced in CSS, not per template:
  `mh-section-header .text-brand, mh-cta-band .text-brand { color: inherit }`
  lives in `projects/website/src/styles.css`. Do **not** add `text-brand` to a non-hero
  heading expecting colour — it will be neutralised on purpose.

**The ending period ("the dot").**

- Headings may end with a period; apply it **consistently** within a page.
- The period is amber **only** when it is part of the hero H1 accent (e.g. hero
  `… comunitate.` with the period inside the accent span). Never colour a stray period
  anywhere else.

**Case & type.** Sentence case, always (never Title Case). Poppins 700–800. No em/en dashes
as punctuation.

---

## 2. Kickers / eyebrow pills (`mh-kicker`)

A small uppercase mono pill with a hex bullet.

- **Feature detail pages:** kicker **only** on the hero and the final CTA band. **Not** above
  the mid-page sections (capabilities, benefits, FAQ, related). Matches the canonical
  `MotionHive - Feature - *.html`, which has exactly two kickers per page.
- **Home & Pricing:** section kickers are allowed — the canonical Homepage/Pricing designs
  use them. The kicker carries the section label so the heading stays plain.
- **Page-hero pill** (blog, about, tools, contact): at most **one per page**, in the hero.
- **Never** a kicker above every section of a page. Rule of thumb: cover the kicker with your
  thumb; if the heading still reads fine, the kicker is clutter — drop it.
- Padding stays compact (`0.35rem 0.7rem`). Do not inflate the pill.

---

## 3. Bullets / lists

- **Blog article bodies: no bullet lists.** Prose only (content playbook Rule 2).
- **Marketing pages:** a genuine list is fine, but rendered with the styled component
  (`mh-check-list`, the pricing plan list, comparison rows), never raw `<ul>` bullets dropped
  into copy. Use for: feature capabilities ("what you can do"), the plan's included list,
  compare table.
- No rule-of-three tic; a list can be any honest length.

---

## 4. Buttons / CTAs

- Primary (amber) + ghost (outline).
- **Always a gap between buttons** in a group (min `0.75rem`, default `1rem`). Buttons never
  touch, on desktop or stacked on mobile.
- Final CTA band: buttons centred with the gap.

---

## 5. Copy

- No em/en dashes as punctuation. Sentence case headings.
- **Romanian is native, not literal-from-English** — same message, words and expressions a
  Romanian would actually use, that sound good spoken aloud. Never word-for-word.
- **FAQ section heading is short:** "Questions." / "Întrebări." Not "Frequently asked…", not a
  vague "Good to know".
- No unverifiable or absolute claims: no data-export/"leave anytime", no "launching soon"/
  waitlist framing (the app is live), no "never" pricing promises. See `MARKETING_BRIEF.md` §13.

---

## 6. Feature set

Features are **data-driven** in `_data/features.ts` — the mega-menu, the homepage grid, the
`/features` overview and the `/features/:slug` pages all read from it. Add or edit a feature
there, never in page markup.

Current set (8): **Profile, Sessions, Programs, Exercises, Payments, Messaging, Community,
Progress.** Each entry carries: `name`, `icon`, `tone` (amber/teal), `oneLiner`, hero H1
(`h1Lead` + `h1Accent`), `intro`, `capabilities`, `benefits`, `faq`, `related`, `metaTitle`,
`metaDescription`. RO comes from the i18n catalogue (`src/locale/messages.ro.xlf`); after any
EN copy change run `npm run extract-i18n` and update the RO targets.
