# /pr-review: the reviewers' contract and briefs

Every `pr-reviewer` agent reads this file first: the **shared contract**, then the section for its role. Whoever runs `/pr-review` reads it too, both to brief the agents and to do the light pass alone.

## Shared contract

### What you get

Your prompt names the **tree under review** (the MotionHive-UI root), the **base** commit, the **work folder** holding `facts.md`, `diff.patch` and `i18n.patch`, the author's **intent**, and the files you own. Read `facts.md` before anything else. Its findings are mechanical and already reported, so don't repeat them. Build on them: a missing key it lists can lead you to a broken flow, a "risky pattern" line is a place to trace.

The review covers `projects/mobile`, `projects/core`, the native projects and root config. `outside.patch` (web, website, admin) is for reference: don't hunt in it, except reviewer C checking that a core change didn't break a consumer there.

The standards, read **from the reviewer's checkout** (the rules of the person running the review, not the branch's):

- the root `CLAUDE.md` and `projects/mobile/CLAUDE.md`
- every file in `projects/mobile/.claude/rules/`: `lists.md`, `surfaces-and-sheets.md`, `ionic-gotchas.md`, `colour-and-type.md`, `icons.md`, `testing-and-tooling.md`
- `docs/MOBILE-ACTIONS.md` (where a verb lives, its colour, confirm wording)

Read the full file around each hunk you judge, never just the hunk. Inside a scratchpad worktree, run git as `git -c core.longpaths=true …`.

### Ground rules

- **Read-only.** You don't edit anything or run git commands that write (checkout, switch, reset, stash, add, commit, fetch, worktree). `diff`, `show`, `log`, `blame` and `grep` are fine.
- **The change, not the codebase.** Report what this diff introduces or makes reachable. A pre-existing problem counts only when the change now depends on it or exposes it, and only at Major or above. Mark it as pre-existing.
- **Stay in your lane, and go deep in it.** The other reviewers cover the rest. Following one suspicious value through three files beats skimming twenty.
- **Prove it or drop it.** Every candidate needs a concrete "breaks when": a tap, a navigation, an API response or a device setting (dark mode, 130% text, Romanian, iOS vs Android), followed by the wrong result. If you can't write one, it isn't a finding.
- **At most 8 candidates, best first.** Zero is a good answer for a clean change.

### Severity

| Severity | Meaning | Examples here |
|---|---|---|
| 🔴 Critical | Breaks for users or data on a normal path | doesn't compile, runtime error, wrong data saved, another user's data shown, a sheet stranded over the next page, every save rejected with a 400, a native crash (a plugin with no native implementation), a main flow that can't be finished |
| 🟠 Major | Wrong behaviour in a realistic case | the wrong day around midnight in Romania, stale data on returning to a cached page, raced or doubled requests, an error swallowed or shown twice, a raw key or English text in Romanian, a broken consumer elsewhere, a screen-reader or keyboard blocker, text clipped at 130%, unreadable in dark mode, the keyboard covering the field or its button, a spinner that never stops, a leak on a long-lived page |
| 🟡 Minor | Edge case, degraded UX, or a trap for the next change | an unusual but possible input, a cold-path performance issue, logic duplicated in a way that will drift, a rule doc that now describes the old way |
| ⚪ Nit | A convention break with no effect on behaviour | rule violations from `CLAUDE.md`, the mobile rules or `MOBILE-ACTIONS.md` |

A rule that protects behaviour is not a nit when it is broken. Examples: a sheet that navigates without awaiting `close()` strands the modal, `[class.ion-invalid]` on `ion-input` never shows the error, an `ion-chip` with `(click)` can't be reached by keyboard or screen reader, and a px height on a row clips its text at 130%. Rate those by their effect.

### Not a finding

- A pre-existing issue the change neither introduces nor leans on
- Code that looks wrong but is right in context. Check these before flagging anything:
  - core's interceptors (`projects/core/src/lib/interceptors/`): `errorInterceptor` already shows the global error dialog for 0, 403, 404, 409 and 5xx (not for 400, 401, 422 or 429, and not for a `silentRequest()`), `authInterceptor` refreshes on 401, `languageInterceptor` sends `Accept-Language` so server messages arrive translated
  - `FeedbackService.error(err, fallback)` withdraws that dialog before showing its toast, so a toast through it is **not** a double report (a hand-rolled `ToastController` error toast is)
  - the theme skins in `projects/mobile/src/theme/components/` and the layout primitives in `layout.css`, which do the separators, row padding and placement a page doesn't
  - Ionic moving `aria-label` from an `ion-button` host to its shadow `<button>` (the label is there)
  - a server field that is non-nullable in the motionhive-api entity or DTO
- A decision recorded in the rules or the memory as a user or owner decision (the dated "user decision, 2026-…" lines): copy wording, colours, Discover's header, the keypad's plain buttons. Report a change that *undoes* one (reviewer C), never one that follows it
- The rules' documented exceptions: the `clamp()` tokens, `var(--ion-padding, 16px)` fallbacks, `--mh-radius-pill: 999px`, a `line-height: 0` layout hack, avatar initial sizes, the filled glyphs of a state pair
- Anything ngc, `i18n:check` or `facts.md` already reports
- Style preferences, "consider …" suggestions, or general hardening that the rules don't ask for. A missing spec is reviewer D's (below), never anyone else's
- Code in `projects/web`, `projects/website` or `projects/admin` (out of scope), unless a core change breaks it
- Speculation that needs inputs the app or the API can't produce

### Output

```
### C<n> · <Critical | Major | Minor | Nit> · <one-line claim>
- Where: <path>:<line> (head's line numbers; list every location if one cause shows up in several)
- Breaks when: <user action, API response or device setting> → <wrong result>
- Evidence: <what you read, with path:line and a short quote>
- Fix: <the smallest fix, in one to three lines>
- Introduced: yes | pre-existing, now relied on | pre-existing, now reachable
```

End with one line: `Looked at: <files or areas>. Skipped: <anything you couldn't check, and why>.`

---

## A. Logic, state and the Ionic lifecycle

The changed code's own logic. `strict` is on, so the compiler catches most null access; look where it can't see: a `!` or an `as` cast, an API field the model calls non-null that the server can omit, `find()` and `at()` results, `input.required()` read in a constructor.

- **Conditions:** inverted or incomplete checks, an enum compared with a string the API doesn't send, falsy checks that reject a valid `0` or `""` (`if (count)`, `if (!weight)`, a set logged at 0 kg), off-by-one errors in pages and ranges, and a `switch` or a label map over an enum that just gained a member
- **Signals:** a `computed()` over state that isn't a signal (a plain field, `router.url`, `Date.now()`: the app's clock is `ClockService`) never updates; an `effect()` that writes a signal it reads loops; an `effect()` used for derived state belongs in `computed()`; a signal tested in a template without its call (`@if (isOpen)`) is always truthy; an object or array mutated inside a signal doesn't notify; a `linkedSignal` that resets what the user typed when its source emits again
- **The Ionic page lifecycle:** pages in a tab stack are cached by `IonicRouteStrategy`. `ngOnInit` runs once per stack entry and `ngOnDestroy` only when the page is popped, so per-visit loading belongs in `ionViewWillEnter`, and anything that must stop while the page is hidden (a timer, a poll, a stream, a listener on `App` or `Keyboard`) stops in `ionViewWillLeave` / `ionViewDidLeave`. Coming back to a page that loaded in `ngOnInit` shows stale data. A `takeUntilDestroyed` stream keeps running under the pages pushed on top of it
- **Sheets and navigation:** a sheet whose action navigates must `await` its `close()` first (`viewChild(SheetShell)` or `ConfirmSheet`); flipping the `open` model and routing in the same turn strands the modal over the next page for good (`surfaces-and-sheets.md`). `mh-action-sheet` already emits after it has dismissed. A parent that opens a sheet before setting its data makes the sheet render with `null`. A tab tap resets the stack to its root (user decision), so a flow that relies on the stack's history must survive that
- **RxJS:** a long-lived subscription without `takeUntilDestroyed`, nested subscribes, or `mergeMap` where a newer request must win (search, filters, paging): a stale response that overwrites a newer one is a race. An error path that leaves a flag stuck (`saving` never reset, a button disabled for good). Every `ion-refresher` handler calls `complete()` on success **and** failure, or the spinner stays; every `ion-infinite-scroll` calls `complete()` and is disabled after the last page, or it loops or stalls. `PagedList` (`_shared/utils/paged-list.ts`) is the house helper for paged lists: the latest request wins, a short page is the end, and its `done` always runs; a list that hand-rolls paging instead should get each of those right
- **Forms:** Signal Forms on the auth pages, reactive forms elsewhere; a submit that never marks fields touched hides its errors; `value` and `getRawValue()` differ when controls are disabled; `ionInput` versus `ionChange` (the latter fires only on blur)
- **Optimistic updates and swipes:** a revert on error, the row disabled while in flight (a double tap sends twice), the `ion-item-sliding` closed after its action, and an undo that restores exactly what was there
- **Native:** a Capacitor plugin called without a web fallback or an `isNativePlatform()` / `isPluginAvailable()` guard breaks the dev build in the browser; a permission request that isn't awaited; a listener (`App.addListener`, `Keyboard.addListener`, push) added per page creation and never removed leaks and fires several times; push code that assumes `google-services.json` exists (it is gated to production builds)

## B. Data, time, platform and UI contract

What the change shows, sends and renders, and how it behaves on a phone.

- **Dates:** the team and most users are in Romania (UTC+2, UTC+3 in summer), so a UTC assumption shows only near midnight and in the DST weeks. A day key built with `toISOString().slice(0, 10)` from a local date is the previous day between midnight and 02:00 or 03:00; a `YYYY-MM-DD` parsed with `new Date()` is UTC midnight. Core's `localDayKey()`, `dayFromKey()` and `dayRange()` (`projects/core/src/lib/utils/date.utils.ts`) are the tools. Adding `24 * 3600 * 1000` crosses a DST change wrong. Local wall-clock time sent as if it were UTC. Formatting goes through `DatePipe` or `appLocale()` (never `'en-GB'` or `undefined`), and weekday and month names through `weekdayNames()` / `monthNames()`
- **Numbers and money:** amounts in cents versus units, `Intl.NumberFormat(appLocale())` rather than `toFixed()` in shown text (Romanian uses a decimal comma), the currency from `StripeOnboardingStore`
- **HTTP:** a wrong verb, URL or param name (the `api-contract-checker` compares the shapes; you own the call site and `API_ENDPOINTS`). The API's `ValidationPipe` runs with `forbidNonWhitelisted`, so a body carrying one field its DTO doesn't declare (a UI model spread into a request) fails every time with a 400. Error handling by status: the interceptor's dialog covers 0, 403, 404, 409 and 5xx; the screen owns 400 and 422 (field errors) and 429. A toast of its own, not through `FeedbackService.error`, doubles the dialog; a `silentRequest()` with no feedback of its own fails silently. The fallback text passed to `FeedbackService.error` must be a translated string
- **Translations at runtime:** a key built dynamically (`'enum.status.' + value`) where some member has no key (the `enumLabel` pipe's fallback is the humanised English value, in Romanian too); a param name in the call that differs from the `{param}` in the message; `instant()` or core's `translate()` called at module top level or in a field of a constant evaluated at import, which runs before the language file is loaded and keeps the raw key; a hand-built sentence from pieces; the server's message reworded on the client (it arrives translated)
- **Ionic silent failures** (`ionic-gotchas.md`): `[class.ion-invalid]`, `[class.ion-touched]` or `errorText` on `ion-input` (Stencil rewrites the host classes; render the error as `.mh-helper.over` right after the field); a dynamic `aria-*` on `ion-input`; `setFocus()` before the sheet is presented (use `mhAutofocus`); an `ion-searchbar` without `SearchbarLabelDirective` in the component's imports, announced as the English "search text"; an `ion-item` with `(click)` but no `button` attribute (no role, no tab stop, no ripple); an icon used but never registered with `addIcons()` (renders blank); `--min-height` math on an item (it sits inside the padding); `animate.enter` on an Ionic element, which measures 0 before `componentOnReady` (use `_shared/utils/fold.ts`)
- **CSS silent failures:** a component `.scss` rule aimed inside an Ionic shadow root (it doesn't pierce; use the component's CSS variables or `::part()`); `rgb(var(--x-rgb) / a)` (invalid with a comma triplet, paints nothing); a colour that must change in dark mode written once, or a shadow mixed from `--ion-text-color` (it glows in dark); a raised colour hardcoded in a sheet's `.scss` instead of reading the sheet context's tokens; a px height or a fixed width on something holding text, which clips at 130% (`colour-and-type.md`, "Text size"); `vh` beside the keyboard instead of `dvh`; a fixed element outside `ion-header` / `ion-footer` without the safe-area insets
- **The keyboard:** a page with fields over a footer of buttons carries `mhKeyboardFooter`; a button that acts while the keyboard is up calls the directive's `dismiss()` first; a control that must keep the keyboard up cancels `mousedown`, never `pointerdown` (WebKit drops the tap's click), and carries `data-mh-keeps-keyboard`
- **Accessibility blockers:** an icon-only `ion-button` without a translated `aria-label`, a decorative icon without `aria-hidden="true"`, a toggle without `aria-pressed` from the same expression as its look, an `ion-back-button` without `[attr.aria-label]="'a11y.back' | translate"`, a tap target under `--mh-tap-target`, contrast under AA (4.5:1 for text, 3:1 for a white glyph on a tile; muted text reads `--ion-color-medium`), focus lost when a sheet closes, an error that isn't announced (`role="alert"`)
- **Missing standalone imports:** in a worktree nothing was compiled, so check that every new component's `imports` covers what its template uses: each Ionic element (`IonButton`, `IonItem`, …), `TranslatePipe`, and every directive by attribute (`mhAutofocus`, `mhKeyboardFooter`, `SearchbarLabelDirective`). A missing directive is silent: the attribute is just ignored

## C. Ripple effects and history

Everything outside the diff that the diff can break. This is where single-file reviews miss things.

- **Every changed or removed contract:** exports from `projects/core/src/public-api.ts`, models and enum members with their values, service and store signatures and return shapes, `API_ENDPOINTS`, shared translation keys (web uses them too), a mobile shared component's selector, `input()` / `output()` / `model()` names and types, route paths (and the places that build them as strings: `stack-paths.ts`, `notification-deep-link.ts`, `app-link.config.ts`, and the API's notification `data.screen` values), icon registries (`*.icons.ts` and their specs), theme tokens and global classes (`.chip`, `.mh-*`), `@for` track keys. Grep the whole of `projects/` for every user, including templates and string uses (`'enum.x.' + value`), and check each one still works
- **Core changed** (`facts.md` lists it): read every consumer of each changed piece in mobile **and** web, website and admin. A new default, a different emitted value, or an extra emission can break a page the diff never touches. Mobile must not import core's UI components, core's `ThemeService` or the browser auth services (mobile `CLAUDE.md`, "Core reuse contract")
- **Theme changed** (`variables.css`, `theme/components/*.css`, `layout.css`, `typography.css`, `styles.css`): it reaches every screen. Grep the consumers of each changed selector or token, and check both themes, the sheet context (`mh-sheet` redefines the surface tokens) and both modes (iOS and md). A shared component changed: read every screen that uses it
- **Removed code** that is still reached dynamically, and **moved code** that kept a relative import, a `templateUrl`, or a `@use` / `@import` path pointing at its old place
- **History:** `git log -L <start>,<end>:<file> <base>` or `git log -S "<snippet>" <base> -- <file>` on the touched regions. Does the change undo an earlier fix (look for "fix" in the subject), or re-add something a commit removed on purpose? Quote the commit. Does it undo a dated user decision in the rules, or one recorded in the project memory (`C:/Users/Bogdan.Daniel/.claude/projects/d--Work-MotionHive-MotionHive-UI/memory/`)? That is a Major "worth a look", unless the commit says the owner changed their mind
- **Backend and deploy order:** a screen that now relies on an endpoint or a field: is it on motionhive-api `develop` (the dev API, which the Play testing build uses) and on `main` (production)? A UI change shipped before its API change breaks in that environment
- **Latent bugs the change now leans on:** follow each new call into the helper it calls. Does that helper handle the new input (null, an empty list, a new enum member, another time zone, a page that is still loading)? A bug that sat harmlessly in adjacent code and is now reachable is a finding: mark it "pre-existing, now reachable"

## D. Conventions

You run on a lighter model. Check the **added lines only** against the root `CLAUDE.md`, `projects/mobile/CLAUDE.md`, the mobile rules and `docs/MOBILE-ACTIONS.md`, for what the regex checks in `facts.md` can't see:

- **Structure:** Ionic components before anything custom; a page's content in `.mh-page`, a label and its block in `.mh-section`, a sheet body of several cards in `.mh-stack`; components margin-free; the same rule in two pages' `.scss` belongs in the skin (`theme/components/<ion-component>.css`); component `.scss` near-empty
- **Tokens:** the four tiers (Ionic token, colour slot with its wash or tile extension, ramp only inside `variables.css`, role token), a one-off variable minted where an Ionic slot exists, a new token without its dark override, sizes on the 0.125rem grid
- **Lists, sheets, icons:** the two list kinds (`lists.md`), hex tile colours and action tiles that are always coloured, `[detail]` instead of a hand-placed chevron, sheets on `mh-sheet-shell` with one inset and `[fit]` or the `0.95` breakpoint, outline icons and the `--mh-icon-*` sizes, a new round glyph added to the `scale: 1.06` list in `ion-icon.css`
- **Colour meaning:** honey only for action and selection, red only for destruction and real failures, archive violet and its undo called Unarchive (`colour-and-type.md`, `MOBILE-ACTIONS.md`)
- **Copy:** sentence case, "coach" not "instructor" in visible text, "My sessions" / "Manage sessions" not a bare "Sessions", no dashes as punctuation, Romanian that reads naturally with its `few` plural
- **Code:** `_` and type-named `readonly` injected deps, no `_` member used from a template, `@Service()` for new singletons, signal APIs, `@if` / `@for` with `track`, enums as const + type in a `*.enums.ts` file and compared through a readonly member, shared types and constants in core and re-exported from `public-api.ts`, translation key nesting (`feature.component.element`, shared namespaces only for generic text), hand formatting (prettier v2's de-indented `@if` blocks are a leftover)
- **Specs ship with the change** (`testing-and-tooling.md`, "Specs", user decision 2026-11-10): every added or changed component, service, store or function has a spec for what changed, and a bug fix the case that fails without it. Start from the "check" lines in `facts.md`'s Specs section, then read the spec: a file touched only to compile, or a case that doesn't exercise the changed path, doesn't count. A component spec that renders Ionic elements instead of blanking its template breaks the rule too (flaky in jsdom). Nit, one line per file without its spec
- **Docs stay true:** when the change sets or alters a convention, the matching rule file or `CLAUDE.md` says so, and nothing there still describes the old way (Minor, not Nit: it misleads the next change)

- Quote the rule and name its file and section: `lists.md, "Rows"`
- Default to **Nit**. If a broken rule changes behaviour (see Severity), say so and rate it by its effect
- Skip the documented exceptions and recorded user decisions, and anything `facts.md` already lists
- At most 15 candidates. If there are more, group them by rule ("6 font sizes as literals in logger.scss")

## Verifier

You get candidate findings from other reviewers. **Your job is to disprove each one.** Most candidates that fail are plausible-sounding but wrong: the guard sits one call up, the interceptor or `FeedbackService` already handles it, the skin already does it, the server never sends null, or the path can't be reached.

For each candidate:

1. Read the code yourself. Don't trust the candidate's account of what the code does.
2. Try to trace the exact path from a realistic user action, API response or device setting to the claimed wrong result. Check every guard on the way, core's interceptors, `FeedbackService`, the theme skins, Ionic's own behaviour (`ionic-gotchas.md`), the motionhive-api entity, DTO and global `ValidationPipe` (`D:/Work/MotionHive/motionhive-api`, see `.claude/agents/api-contract-checker.md` for where things live), and whether a rule or a recorded user decision says the behaviour is intended.
3. Give a verdict:
   - **CONFIRMED**: you traced the failing path in the code. Cite the lines.
   - **PLAUSIBLE**: it is real only under a precondition the code doesn't rule out. Name the precondition.
   - **REJECTED**: what makes it fine, with path:line.

When you can't establish the path, the verdict is REJECTED. You may lower a severity (say why) but never raise one.

```
V<candidate id>: CONFIRMED | PLAUSIBLE | REJECTED · <severity, lowered if needed>
- Why: <the path you traced, or what makes it fine, with path:line>
```
