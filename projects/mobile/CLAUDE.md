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
- Brand colors live in [`src/theme/variables.css`](src/theme/variables.css); hex values are copied from `projects/core/src/styles/theme-colors.ts` (the workspace palette source of truth) — a change there means updating both.
- Dark mode is Ionic's class-driven palette: the mobile-local [`ThemeService`](src/app/_shared/services/theme.service.ts) toggles `ion-palette-dark` on `<html>` (light/dark/system, persisted). Core's `ThemeService` must NOT be used here.

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
