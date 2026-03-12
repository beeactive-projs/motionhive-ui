# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fitness platform frontend. Angular monorepo with a shared `core` library and `web` application.

**Tech Stack**: Angular 21, PrimeNG 21 (Lara preset), Tailwind CSS 4 + PrimeUI, ngx-translate, Vitest

## Commands

```bash
ng serve web               # Dev server (port 4200)
ng build web               # Production build
ng build core              # Build core library
ng test                    # Run tests (Vitest)
```

Package manager is **npm**. Prettier config is inline in `package.json`.

## Architecture

### Monorepo Structure

- `projects/core/` — Shared library imported as `'core'`. Contains models, services, stores, guards, interceptors, constants, enums, and environment config. Everything is re-exported from `public-api.ts`.
- `projects/web/` — Main Angular application with pages, layouts, and protected routes.

### Routing

```
/           → Public pages (home, about, blog) via PublicLayout
/auth/*     → Login, signup, password reset
/app/*      → Protected (authGuard) via SidenavLayout
  /app/dashboard, /app/clients, /app/groups, /app/profile, /app/client/*
```

All routes use `loadComponent()` / `loadChildren()` for code splitting.

### API Integration

- Base URL from `environment.apiUrl` (Railway production)
- Auth interceptor adds Bearer token and auto-refreshes on 401
- Endpoints defined in `API_ENDPOINTS` constant
- Import everything from `'core'`: `import { SomeService, SomeModel } from 'core';`

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

## Coding Conventions

### Tooling Priority (follow this order strictly)

1. **PrimeNG components** — always prefer PrimeNG over native HTML elements
2. **Tailwind utility classes** — for layout and spacing before writing any custom CSS
3. **Custom SCSS** — only as a last resort when PrimeNG + Tailwind cannot achieve the result

Never use plain HTML form/interactive elements when a PrimeNG equivalent exists:
`<button>` → `p-button`, `<input>` → `p-inputtext` / `p-inputnumber` / `p-checkbox` / `p-radiobutton` / `p-datepicker`, `<select>` → `p-select`, `<textarea>` → `p-textarea`

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

- Selector prefix: `bee-` (`bee-clients`, `bee-dashboard`, `bee-user-profile`)
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
- **Private state/derived fields**: `_` prefix + `readonly` (`private readonly _base = '...'`, `private readonly _lgQuery = ...`)
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

- Template references: `#header`, `#body`, `#footer` (not `pTemplate`)
- Tables: `[lazy]="true"` + `(onLazyLoad)` with `#loadingbody` (p-skeleton) and `#emptymessage`
- Forms: `isFieldInvalid()` / `getFieldError()` pattern, `p-message` for errors
- Style via `styleClass` prop, not wrapping divs

### Dialogs

- **Complex dialogs**: create a child component that owns the `p-dialog`
  - Use `model(false)` for visibility — enables `[(visible)]` from the parent with no boilerplate
  - Use `input.required()` for data it needs, `output()` for `saved` / `closed` events
  - Place in a subfolder next to the parent feature (e.g. `dialogs/`)
- **Simple confirmations**: inline `p-dialog` directly in the parent template is acceptable

### Accessibility

- Must pass AXE checks and follow WCAG AA (focus management, color contrast, ARIA attributes)
