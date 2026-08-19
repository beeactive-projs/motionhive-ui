# MotionHive Mobile — CLAUDE.md

Ionic Angular + Capacitor app (`projects/mobile`). Coach-facing mobile app; v1 scope is auth + coach clients. These rules are binding for all work in this project and complement the root `CLAUDE.md` (naming, terminology, copy rules all still apply). Where the root file says "PrimeNG", this project says "Ionic" — PrimeNG is banned here.

## Tooling priority (strict order)

1. **Ionic components — always.** Never use unstyled HTML interactive elements when an Ionic equivalent exists:
   `<button>` → `ion-button`, `<input>` → `ion-input`, `<select>` → `ion-select`, `<textarea>` → `ion-textarea`, checkbox → `ion-checkbox`, radio → `ion-radio`, toggle → `ion-toggle`, lists → `ion-list`/`ion-item`, cards → `ion-card`, badges → `ion-badge`, chips → `ion-chip`, spinners → `ion-spinner`, search → `ion-searchbar`.
   Import from `@ionic/angular/standalone` only — individual component imports (`IonButton`, `IonList`, …), never a module barrel. Icons via `addIcons()` from `ionicons` + named imports from `ionicons/icons`.
2. **Ionic patterns.** Follow Ionic's documented UX patterns: `ion-header`/`ion-toolbar`/`ion-content` page structure (with `[translucent]`/`[fullscreen]` + `collapse="condense"` large-title header), `ion-back-button` for stack navigation, `ion-refresher` for pull-to-refresh, `ion-infinite-scroll` for pagination, `ion-modal`/`ion-action-sheet`/`ion-alert`/`ion-toast` for overlays, `ion-skeleton-text` for loading, `ion-item-sliding` for swipe actions. Layout and spacing via Ionic CSS utilities (`ion-padding`, `ion-text-*`, `ion-hide-*`) and `ion-grid` before anything custom.
3. **Customization only when specified.** Ionic components may be customized **only when the task explicitly calls for it**, and then only through the component's documented API: inputs, `--ion-*` / component-specific CSS variables, and `::part()` selectors. Colors exclusively through the theme palette (`color="primary"` etc.) — never hardcoded hex/rgb in components.
4. **No CSS or code dumping.** Component `.scss` files stay empty or near-empty by default. Do not add custom CSS for what Ionic already provides (spacing, alignment, typography, safe areas). A custom rule requires a reason the Ionic API cannot cover. Same for code: no utility/helper dumps — reuse `core` or write the minimal purposeful code.

## Theming

- Ionic's theming system only, **fully separate from web's** (`.dark`/PrimeNG/Tailwind stack). No Tailwind in this project; utilities may be introduced later only for a demonstrated need.
- All theme tokens live in [`src/theme/variables.css`](src/theme/variables.css); ramp hex values mirror `projects/core/src/styles/theme-colors.ts` (the workspace palette source of truth) — a change there means updating both.
- Dark mode is Ionic's class-driven palette: the mobile-local [`ThemeService`](src/app/_shared/services/theme.service.ts) toggles `ion-palette-dark` on `<html>` (light/dark/system, persisted). Core's `ThemeService` must NOT be used here.

### Theme structure (`src/theme/`)

- [`variables.css`](src/theme/variables.css) — tokens only (ramps, colour slots, washes, role tokens).
- [`typography.css`](src/theme/typography.css) — headings + the `.mh-*` text roles (`mh-kicker`, `mh-section-label`, `mh-helper`, `mh-note-block`, `mh-footnote`).
- [`layout.css`](src/theme/layout.css) — the layout primitives `.mh-page` and `.mh-section` (below).
- [`components/`](src/theme/components/) — **one file per Ionic component** that needs a global skin (`ion-card.css`, `ion-list.css`, `ion-button.css`, …), imported from `styles.css`. General custom CSS for a component goes in its file — never back into `styles.css`, never copy-pasted across page `.scss` files. Add a new file (and its `@import`) when a component first needs a global rule.

### Layout rule — components are margin-free, pages place them

- **Component skins carry no margins.** `ion-card`, `mh-card-list` and friends are layout-neutral (`margin: 0` in their skin); where they sit on a screen is the screen's decision. Never re-introduce a placement margin into `theme/components/` or into a shared component's own `.scss`.
- **Pages opt into the layout primitives:** wrap the scrolling content in `<div class="mh-page">` (one gutter, one vertical rhythm via flex gap) and glue a label to its block with `<section class="mh-section">` (kicker/`mh-section-label` + card-list). Fixed-slot elements (`ion-refresher`) and sheet/modal components stay outside the wrapper.
- Page-specific placement that the primitives don't cover (a sticky-CTA clearance, a two-tile row, a full-bleed list screen's card inset) belongs in that page's `.scss` — layout in the page, skin in the theme.

### CSS variable standard (four tiers — use the highest that fits)

1. **Ionic tokens.** If Ionic names it, use Ionic's name: global tokens (`--ion-background-color`, `--ion-text-color`, `--ion-border-color`), per-component variables (`--background`, `--border-radius`, …), and `color="primary|success|…"`. Never invent a parallel variable for something Ionic already exposes.
2. **Ionic colour slots, extended.** Every hue goes through `--ion-color-<name>` (custom hues — info, violet, teal, coral — join the system with the full slot set plus a `.ion-color-<name>` class block; never a standalone one-off variable). Soft fills for chips/badges/tiles use the **wash extension**: `background: var(--ion-color-<name>-wash); color: var(--ion-color-<name>-wash-contrast);` — the mobile equivalent of web's `bg-sky-100 text-sky-700` tag idiom, and it flips automatically in dark mode. To parameterize a hue from the template, set a per-instance custom prop that resolves to wash tokens (see the category chips in `notifications.html`).
3. **Ramps** — `--mh-<scale>-<step>` (primary, warning, success, info, danger, violet, navy, slate, teal, coral), mirrored from `theme-colors.ts`. Ramps are absolute (no dark-mode flip) and exist **only for `variables.css` to derive tokens from**. Component SCSS must never read a ramp step directly — needing one is the signal to mint a role token. Variants come from adjacent ramp steps: shade/tint = 600/400; wash = 100 fill + 700 ink in light, 900 fill + 200 ink in dark (honey uses 800 / 950+300 — see the file header).
4. **Role tokens** — `--mh-*`, only for what Ionic has no slot for: `--mh-font-heading`/`--mh-font-mono`, the type scale `--mh-text-*`, leadings/tracking, `--mh-radius-control|card|pill|sheet` (Ionic has no global radius token), `--mh-tap-target`, `--mh-ring-width`/`--mh-spine-width`, `--mh-color-divider`, `--mh-color-honey-deep` (accent ink on honey surfaces), `--mh-color-selected-background` (selection fill — selection, never status). Each is defined once in `variables.css` with its dark override; components consume, never define.

### Dimensions & typography — the 0.125rem grid

Every dimension in this project sits on a **0.125rem grid** (1rem = 16px, so the step is 2px): `0.125 / 0.25 / 0.375 / 0.5 / 0.625 / 0.75 / 0.875 / 1 / 1.125 …`. Never write an off-grid value (`0.66rem`, `0.7rem`, `0.82rem`, `1.3rem` are all wrong — snap to the nearest step).

**px is banned except for border widths**: `1px` hairlines as a literal, and the two tokens `--mh-ring-width` (2px — focus/danger ring, avatar cutout) and `--mh-spine-width` (3px — left accent spine). `--mh-radius-pill: 999px` is a sentinel, not a dimension. Everything else — spacing, sizes, radii, even `ion-skeleton-text` inline styles in templates — is rem on the grid. (`var(--ion-padding, 16px)` fallbacks mirroring Ionic's own default are tolerated.)

**Never write a `font-size` literal** — always a `--mh-text-*` token (defined in `variables.css`, mirroring web's Tailwind ladder):

| Token | Value | Role |
|---|---|---|
| `--mh-text-xs` | 0.625rem (10px) | kickers, badges, timestamps, footnotes |
| `--mh-text-sm` | 0.75rem (12px) | meta, helper, secondary text |
| `--mh-text-base` | 0.875rem (14px) | body, controls |
| `--mh-text-md` | 1rem (16px) | emphasized body, inputs, card titles |
| `--mh-text-lg` | 1.125rem (18px) | section titles |
| `--mh-text-xl` | 1.25rem (20px) | page titles (`h1`) |
| `--mh-text-2xl` | 1.5rem (24px) | hero numbers |

Display/glyph sizes above the ladder (avatar initials at `1.75`/`2.25`/`2.75rem`) may stay on-grid literals. `line-height` comes from `--mh-leading-none|tight|body` (1 / 1.4 / 1.55; a bare `line-height: 0` layout hack is not typography and stays). `letter-spacing` for mono kickers is `--mh-tracking-kicker` (0.08em) — never a per-component tracking value. Font families only via `--ion-font-family` / `--mh-font-heading` / `--mh-font-mono`.

Other dimension roles: `--mh-tap-target` (2.75rem, the WCAG 44px minimum — use it for anything sized as a touch target) and `--mh-radius-sheet` (1.25rem sheet top corners). **No `vh` for keyboard-adjacent UI** — use `dvh` so the WebView's dynamic chrome/keyboard is accounted for.

## Core reuse contract

- **Import from `'core'`**: models, constants (`API_ENDPOINTS`, `STORAGE_KEYS`, …), utils (api-error, date, form, …), HTTP services (`AuthService`, `TokenService`, `UserService`, `ClientService`, …), pure signal services (`ErrorDialogService`, `LoadingService`), stores (`AuthStore`, …), guards (`authGuard`, `instructorGuard`), interceptors (auth, error, loading, silent-request context), `environment`.
- **Never import**: core UI components (logo, hex, segmented, dialog-shell, bottom-sheet, sticky-cta, action-list, avatar-stack, youtube-embed), `stripe-iframe.directive`, core `ThemeService`, `google-auth.service`/`facebook-auth.service` (don't work in a WebView), anything PrimeNG — including the `TableLazyLoadEvent`-shaped `ClientService.filterClients`/`filterPendingRequests` (use `getClients()`/`getPendingRequests()` instead).

## Environments

Mobile never ships core's host-sniffing `environment.ts`. Both build configurations swap it via `fileReplacements`: production → `environment.mobile.ts` (fixed prod URLs), development → `environment.mobile-dev.ts` (browser serve → local API on :3800; native → dev Railway API). Keep the exported shape identical to `environment.ts`.

## Angular rules (same bar as root CLAUDE.md)

Standalone components (no `standalone: true` flag), no explicit `OnPush` (default in v22+), `inject()` not constructor injection, `input()`/`output()`/`model()` not decorators, `viewChild()`/`viewChildren()`, signals (`signal`/`computed`/`update`/`set`; `linkedSignal` where warranted; `effect` sparingly), native control flow (`@if`/`@for`/`@switch`), `class`/`style` bindings not `ngClass`/`ngStyle`, `host` object not `@HostBinding`/`@HostListener`, `takeUntilDestroyed(destroyRef)` for long-lived subscriptions and `take(1)` for one-shot HTTP, Signal Forms preferred (reactive forms otherwise), separate `.html`/`.scss` files, kebab-case file names, components without type suffix, `mh-` selector prefix, `_`-prefixed `readonly` injected deps named after the injected type, `@Service` decorator for new singleton services, strict typing (no `any`), enum comparisons via readonly class members exposing the const object — never inline string literals.

## Routing

`IonicRouteStrategy` + per-tab stacks under `/tabs` (`ion-tabs` in [`src/app/layouts/tabs/`](src/app/layouts/tabs/tabs.ts)). Auth pages live outside the tabs at `/auth/*`. All routes `loadComponent()`. Structure mirrors web: `app/main/<feature>/`, `app/layouts/`, `app/pages/auth/`, `app/_shared/`.

## Commands

```bash
npm run start:mobile       # Dev server on http://localhost:8100 (CORS-whitelisted on the API)
npm run build:mobile       # Production build → dist/mobile
npm run build:mobile:dev   # Development build (dev environment file)
npm run cap:sync           # Prod build + capacitor sync to android/ + ios/
npm run cap:android        # Dev build + sync + gradlew installDebug + launch on the connected device/emulator
ng test mobile             # Vitest unit tests (keep component specs shallow — Ionic web components are flaky in jsdom)
```

Android gotchas on this machine:
- **Do not use `npx cap run android`** — this machine sets `NoDefaultCurrentDirectoryInExePath=1`, so cmd refuses bare `gradlew` from the current directory and the Capacitor CLI's spawn fails (`'gradlew' is not recognized`). `npm run cap:android` calls `.\gradlew.bat` explicitly instead.
- `ANDROID_HOME` is not set globally; the SDK path lives in `android/local.properties` (gitignored — recreate with `sdk.dir=<path to %LOCALAPPDATA%\Android\Sdk>` after a fresh clone).
- **Native dev builds hit the LOCAL API** (`environment.mobile-dev.ts`) through `adb reverse tcp:3800 tcp:3800` — `npm run cap:android` sets it up, but it resets when the emulator reboots (re-run the script or the adb command). The local motionhive-api must be running, and it must include the Capacitor CORS origins (`capacitor://localhost`, `https://localhost`) — restart it after pulling that change.
