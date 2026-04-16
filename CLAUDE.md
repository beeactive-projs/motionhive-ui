# MotionHive UI — CLAUDE.md

> **Naming note:** The product is **MotionHive**. The repo directory is still `beeactive-ui` (historical, not renamed). Angular selector prefix is `mh-`. Any `bee-`/`beeactive` references in existing code are historical leftovers — leave them alone unless explicitly renaming.

## Project Overview

MotionHive fitness platform frontend. Angular monorepo with three projects:

- **`core`** — shared library (models, services, stores, guards, interceptors, constants, enums, environment config). Imported as `'core'`. Everything re-exported from `public-api.ts`.
- **`web`** — authenticated application (dashboard, instructor/user/super-admin/writer areas, payments, groups, sessions). Uses `SidenavLayout` + `authGuard`.
- **`website`** — public marketing site (home, about, blog, contact, legal pages, tools like calorie calculator, feedback/waitlist dialogs). Uses `PublicLayout`. **Separate Angular application**, not a section of `web`.
- **Future: Ionic mobile app** — planned, not yet scaffolded. When it lands, anything shared across web + website + mobile belongs in `core`.

**Tech Stack**: Angular 21, PrimeNG 21 (Lara preset), Tailwind CSS 4 + PrimeUI, ngx-translate, Vitest

## Commands

```bash
ng serve web               # Authenticated app dev server
ng serve website           # Marketing site dev server
ng build web               # Production build — authenticated app
ng build website           # Production build — marketing site
ng build core              # Build core library (required before building web/website locally)
ng test                    # Run tests (Vitest)
```

Package manager is **npm**. Prettier config is inline in `package.json`. Angular selector prefix is `mh` (see `angular.json`).

## Architecture

### Monorepo Structure — what goes where

- **`projects/core/`** — anything imported by more than one app. Models, HTTP services, stores (signals), guards, interceptors, constants (endpoints, storage keys), enums, UI types (e.g. `TagSeverity`), environment config. **When you find yourself copy-pasting a type/const between `web` and `website`, stop and move it to core.**
- **`projects/web/`** — authenticated app. Structure:
  - `app/main/<role>/*` — role-scoped pages (`instructor`, `user`, `super-admin`, `writer`)
  - `app/main/<role>/_dialogs/*` — dialog components owned by that role
  - `app/_shared/components/*` — cross-role components (theme toggle, profile menu, error dialog)
  - `app/layouts/sidenav-layout/*` — the authenticated shell
  - `app/pages/auth/*` — login/signup/reset/OAuth callbacks
  - `app/pages/error/*` — 404, 500
- **`projects/website/`** — public marketing site. Structure:
  - `app/home`, `app/about`, `app/contact`, `app/blog`, `app/legal/*`, `app/tools/*`
  - `app/_shared/*` — website-only shared components (waitlist dialog, language switcher, feedback dialog)
  - `app/layouts/public-layout`, `app/layouts/header`, `app/layouts/footer`

### Routing

**`web` app** (authenticated):
```
/auth/*     → login, signup, password reset, OAuth callbacks
/app/*      → Protected (authGuard) via SidenavLayout
  /app/main/instructor/*    → INSTRUCTOR role
  /app/main/user/*          → USER role
  /app/main/super-admin/*   → SUPER_ADMIN role
  /app/main/writer/*        → WRITER role (blog authoring)
  /app/main/profile/*       → shared
```

**`website` app** (public):
```
/           → home
/about, /contact, /blog, /blog/:slug
/legal/privacy-policy, /legal/terms-of-service
/tools/calorie-calculator
```

All routes use `loadComponent()` / `loadChildren()` for code splitting.

### API Integration

- Base URL from `environment.apiUrl` (Railway production)
- Auth interceptor adds Bearer token and auto-refreshes on 401
- Endpoints defined in `API_ENDPOINTS` constant
- Import everything from `'core'`: `import { SomeService, SomeModel } from 'core';`
- **API documentation (Swagger/OpenAPI)**: https://beeactive-api-production.up.railway.app/api/docs

### Auth & State

- `AuthStore` uses Angular signals (`signal()` for writable state, `computed()` for derived)
- Components read store values via `store.value()` in templates
- No NgRx or BehaviorSubject — signals only

### Styling

- Tailwind utility classes in templates (primary)
- SCSS for component-specific styles
- PrimeNG components styled via `styleClass` prop
- Dark mode: CSS class strategy (`.dark` on `<html>`)
- Custom colors: secondary (Midnight Navy), accent (Teal)
- Fonts: Inter (body), Poppins (headings)
- **Custom SCSS must use PrimeNG CSS design tokens — never hardcode colors, spacing, border-radius, or shadows:**
  ```scss
  // correct
  color: var(--p-primary-color);
  background: var(--p-surface-100);
  border: 1px solid var(--p-content-border-color);
  border-radius: var(--p-border-radius-md);
  box-shadow: var(--p-overlay-shadow);

  // wrong
  color: #3b82f6;
  background: #f8f9fa;
  border-radius: 6px;
  ```

## Shared types and constants

When a type or constant is used in more than one place, define it once in the `core` library and import it from `'core'` everywhere:

- **UI/component types** (e.g. PrimeNG tag severities): `projects/core/src/lib/models/common/ui.model.ts`
- **Domain constants** (e.g. endpoint strings, storage keys): `projects/core/src/lib/constants/`
- Always re-export the new entry from `projects/core/src/public-api.ts`

Never copy-paste the same `type` or `const` across multiple component files — extract it.

Use the **const + type** pattern (same as `UserRoles`) so values are accessible at runtime. **Always define these in a dedicated `*.enums.ts` file, separate from the `*.model.ts` interfaces** — they have different reasons to change and mixing them together clutters both files. Example: `profile.enums.ts` + `profile.model.ts`, both exported from `public-api.ts`.

```ts
// core/src/lib/models/common/ui.model.ts
export const TagSeverity = {
  Success: 'success',
  Warn: 'warn',
  Danger: 'danger',
  Secondary: 'secondary',
  Info: 'info',
  Contrast: 'contrast',
} as const;

export type TagSeverity = typeof TagSeverity[keyof typeof TagSeverity] | null | undefined;

// usage — same import works for both value and type
import { TagSeverity } from 'core';

method(): TagSeverity {
  return TagSeverity.Success; // no magic strings
}
```

## Coding Conventions

### Tooling Priority (follow this order strictly)

1. **PrimeNG components** — always prefer PrimeNG over native HTML elements
2. **Tailwind utility classes** — for layout and spacing before writing any custom CSS
3. **Custom SCSS** — only as a last resort when PrimeNG + Tailwind cannot achieve the result

Do not add custom CSS for things Tailwind can handle (flex, gap, padding, font-size, font-weight, overflow, text-overflow, whitespace, cursor, width, transitions, etc.). Keep `.scss` files minimal — only add rules that genuinely cannot be expressed with utility classes.

**Never use plain HTML interactive elements when a PrimeNG equivalent exists — no exceptions, even when wrapping other components or building custom UI:**
`<button>` → `p-button`, `<input>` → `p-inputtext` / `p-inputnumber` / `p-checkbox` / `p-radiobutton` / `p-datepicker`, `<select>` → `p-select`, `<textarea>` → `<textarea pTextArea>`, `<a>` (interactive) → `p-button` with `routerLink`

### File & Naming

Files use **kebab-case**. Components have **no type suffix**; all other artifacts keep theirs:

| Artifact    | File name                              | Example              |
|-------------|----------------------------------------|----------------------|
| Component   | `<name>.ts` + `<name>.html` + `<name>.scss` | `clients.ts`    |
| Service     | `<name>.service.ts`                    | `auth.service.ts`    |
| Store       | `<name>.store.ts`                      | `auth.store.ts`      |
| Model       | `<name>.model.ts`                      | `user.model.ts`      |
| Guard       | `<name>.guard.ts`                      | `auth.guard.ts`      |
| Interceptor | `<name>.interceptor.ts`                | `auth.interceptor.ts`|
| Directive   | `<name>.directive.ts`                  | `tooltip.directive.ts`|
| Pipe        | `<name>.pipe.ts`                       | `date-format.pipe.ts`|

Classes use **PascalCase**. Components have **no type suffix**; all other artifacts keep theirs:

| Artifact       | Class name       | Example           |
|----------------|------------------|-------------------|
| Component      | `<Name>`         | `Clients`, `Dashboard` |
| Service        | `<Name>Service`  | `AuthService`     |
| Store          | `<Name>Store`    | `AuthStore`       |
| Model/Interface| `<Name>`         | `User`, `FeedbackPayload` |
| Guard          | `<name>Guard` (fn) | `authGuard`     |
| Interceptor    | `<name>Interceptor` (fn) | `authInterceptor` |

- Selector prefix: `mh-` (`mh-clients`, `mh-dashboard`, `mh-user-profile`) — set in `angular.json` for all three projects
- Always separate files: `.html` and `.scss` alongside `.ts` — no inline templates or styles

### Member Naming

- **Private injected dependencies**: `_` prefix + `readonly`, name must reflect the injected **type** — never use role/purpose aliases:
  ```ts
  private readonly _http = inject(HttpClient);          // ✓
  private readonly _router = inject(Router);            // ✓
  private readonly _authStore = inject(AuthStore);      // ✓
  private readonly _messageService = inject(MessageService); // ✓
  private readonly _formBuilder = inject(FormBuilder);  // ✓
  private readonly _elementRef = inject(ElementRef);    // ✓
  private readonly _ngZone = inject(NgZone);            // ✓

  private readonly _auth = inject(AuthStore);           // ✗ (purpose alias)
  private readonly _toast = inject(MessageService);     // ✗ (purpose alias)
  private readonly _fb = inject(FormBuilder);           // ✗ (abbreviation)
  ```
- **Private state/derived fields**: `_` prefix + `readonly` (`private readonly _base = '...'`, `private readonly _lgQuery = ...`), including `viewChild` / `viewChildren` refs — never access `_`-prefixed members from the template; expose a public method instead
- **Public signals exposed from a service**: no prefix, no suffix (`readonly isOpen = signal(false)`)
- **Public observables**: `$` suffix (`currentUser$`, `reload$`)
- **Private Subjects** (backing a public observable): camelCase + `Subject` suffix, no `_` (`private currentUserSubject = new BehaviorSubject(...)`)
- **Guards/interceptors** — `inject()` calls are function-scoped `const` locals, no `_` prefix needed

### Angular-Specific Rules

- All components are standalone (do NOT set `standalone: true` — it's the default in Angular 21)
- `changeDetection: ChangeDetectionStrategy.OnPush` on every component
- Use `inject()` function, not constructor injection
- Use `input()` and `output()` functions, not `@Input`/`@Output` decorators
- Use `model()` for two-way bindings, not `@Input` + `@Output XChange` pairs
- Use `viewChild()` / `viewChildren()` instead of `@ViewChild` / `@ViewChildren`
- Use `signal()`, `computed()`, `update()`, `set()` — never `mutate` on signals
- Use `effect()` sparingly — only for side effects that truly depend on signals
- Use `afterNextRender()` for DOM-dependent operations (replaces `AfterViewInit`); `ngOnInit` is fine for data init
- Use native control flow (`@if`, `@for`, `@switch`), not `*ngIf`/`*ngFor`/`*ngSwitch`
- Use `class` bindings, not `ngClass`; `style` bindings, not `ngStyle`
- Use `host` object in decorator, not `@HostBinding`/`@HostListener`
- Use `NgOptimizedImage` for all static images (not inline base64)
- Reactive forms preferred over template-driven
- Services: `providedIn: 'root'`, return `Observable` from HttpClient
- Subscriptions: `takeUntilDestroyed(destroyRef)` for long-lived streams, `take(1)` for one-shot HTTP calls

### PrimeNG

#### Imports — standalone components over modules

Prefer the **standalone component** export over the `*Module` barrel. Fall back to the module only when no standalone export exists.

```ts
// preferred
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Dialog } from 'primeng/dialog';

// fallback — only when no standalone export is available
import { ButtonModule } from 'primeng/button';
```

- Template references: `#header`, `#body`, `#footer` (not `pTemplate`)
- Tables: `[lazy]="true"` + `(onLazyLoad)` with `#loadingbody` (p-skeleton) and `#emptymessage`
- Forms: `isFieldInvalid()` / `getFieldError()` pattern; render errors with:
  ```html
  <p-message severity="error" size="small" variant="simple">{{ getFieldError('field') }}</p-message>
  ```
- Style via `styleClass` prop, not wrapping divs

#### Full-width inputs — use `fluid` instead of `class="w-full"`

The following components support a `fluid` boolean input. Use it instead of adding `class="w-full"`:

```html
<p-button fluid />
<input pInputText fluid />
<p-password fluid />
<textarea pTextarea fluid></textarea>
<p-multiselect fluid />
<p-listbox fluid />
<p-treeselect fluid />
<p-cascadeselect fluid />
<p-selectbutton fluid />
<p-togglebutton fluid />
```

These components do **not** have a `fluid` input — use `class="w-full"` on them:

```html
<p-select class="w-full" />
<p-datepicker class="w-full" />
<p-autocomplete class="w-full" />
<p-inputnumber class="w-full" />
```

#### PrimeNG 21 component names (v18+ renames — never use the old names)

| Old (deprecated) | Current (v21+) |
|------------------|----------------|
| `p-dropdown`     | `p-select`     |
| `p-calendar`     | `p-datepicker` |
| `p-sidebar`      | `p-drawer`     |
| `p-overlaypanel` | `p-popover`    |
| `p-inputSwitch`  | `p-toggleswitch` |
| `p-chips`        | `p-inputchips` |

#### Overlay / popup components — always append to body

Any PrimeNG component that opens a floating overlay (dropdown, calendar, popover, autocomplete, etc.) **must** have `[appendTo]="'body'"` to prevent the overlay from being clipped or triggering unwanted scroll inside its parent container:

```html
<p-select [appendTo]="'body'" ... />
<p-datepicker [appendTo]="'body'" ... />
<p-popover [appendTo]="'body'" ... />
<p-autocomplete [appendTo]="'body'" ... />
<p-multiselect [appendTo]="'body'" ... />
```

Components that are affected: `p-select`, `p-datepicker`, `p-popover`, `p-autocomplete`, `p-multiselect`, `p-cascadeselect`, `p-treeselect`, `p-colorpicker`.

#### Deprecated properties to avoid

- `pTemplate` — use named content projections (`#header`, `#body`, `#footer`, `#content`, `#footer`, `#item`, `#selectedItem`, etc.)
- `appendTo="body"` (string binding) — use `[appendTo]="'body'"` (property binding) instead
- `[styleClass]` on `p-column` — use `headerStyleClass` / `bodyStyleClass` / `footerStyleClass`
- `[iconPos]` on `p-button` when using icon-only buttons — use `[icon]` with an empty or omitted `label`

### Dialogs

- **Complex dialogs**: create a child component that owns the `p-dialog`
  - Use `model(false)` for visibility — enables `[(visible)]` from the parent with no boilerplate
  - Use `input.required()` for data it needs, `output()` for `saved` / `closed` events
  - Place in a subfolder next to the parent feature (e.g. `dialogs/`)
- **Simple confirmations**: inline `p-dialog` directly in the parent template is acceptable

### UI copy & text formatting

- Use **sentence case** for all visible text — labels, headings, button labels, placeholders, dialog titles, menu items, tooltips, and error messages.
  - Correct: "Instructor profile", "Save changes", "Add new client", "Are you sure you want to delete this?"
  - Wrong: "Instructor Profile", "Save Changes", "Add New Client"
- Proper nouns and acronyms remain capitalised as normal (e.g. "MotionHive", "PDF", "API").
- Sentences must start with a capital letter and end with the appropriate punctuation when they form a full sentence.

### Accessibility

- Must pass AXE checks and follow WCAG AA (focus management, color contrast, ARIA attributes)
