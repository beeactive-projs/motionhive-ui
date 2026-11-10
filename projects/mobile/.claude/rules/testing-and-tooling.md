---
paths:
  - "projects/mobile/**"
  - "src/**"
---

# Testing and tooling for the mobile app

## Specs

- **Every change ships with its specs** (user decision, 2026-11-10; it replaces the config-only rule). A component, service, store or function that is added or changed gets a spec for what changed, in the same change: a new `<name>.spec.ts` beside the file, or new cases in the one already there. A bug fix comes with the case that fails without it.
- Logic a page holds can be tested where it lives: a pure helper in `*.config.ts` or in a module of functions (`logger-flow.ts`) in its matching spec. Moving logic out of a component only to test it is fine when the helper reads well on its own; don't contort a component for it.
- Services and stores: `TestBed` with the core services they call stubbed (`{ provide: WorkoutLogService, useValue: { logSet } }`), and a `Subject` per reply when the order of the answers matters (`logger.store.spec.ts`).
- Components: test the class, never Ionic's rendering. Ionic web components are flaky in jsdom, so a component spec renders no template:
  - without inputs, build it in an injection context: `TestBed.runInInjectionContext(() => new VenueList())` (`venue-list.spec.ts`);
  - with inputs, blank the template first: `TestBed.overrideComponent(SetRow, { set: { template: '', imports: [] } })`, then `TestBed.createComponent`, `fixture.componentRef.setInput(...)` and `fixture.detectChanges()`, which also runs the effects (`set-row.spec.ts`). Override once per test, in a `beforeEach` when a test builds several: TestBed refuses an override after the first component is created;
  - assert signals, computeds and outputs (`instance.tick.subscribe(...)`), not the DOM.
- Stub `TranslateService` as `{ instant: (key) => key }`, so a component or service spec asserts keys. Core's `translate()` returns the real English (`test-setup.ts`), so a config spec asserts what a user reads.
- Stylesheets and the theme have no specs: check them in the running app (below).
- `ng test mobile` resolves `core` from `dist/core` first. After any change under `projects/core`, run `npx ng build core` before `npx ng test mobile --watch=false`, or the tests fail on members that do exist.
- A change is done when `npx ng build mobile`, `npx ng test mobile --watch=false` and `npm run i18n:check` all pass.

## Formatting

- Don't run the repo's local `prettier`. It is v2, which de-indents the contents of `@if` / `@for` / `@switch` blocks and strips trailing commas, rewriting whole files. Hand-format to match the file (2-space indent, block contents indented one level, trailing commas on multi-line lists, 100-column wrap). If a pass is really needed, use `npx prettier@3 --write <files>` and check `git diff --numstat` shows only the intended change.

## Verifying UI

- Check a visual change in the running app (`npm run start:mobile`, http://localhost:8100) in **both** light and dark mode, and at 130% text on an iPhone SE viewport (`document.documentElement.style.fontSize = '130%'`). Dark mode is the `ion-palette-dark` class, persisted as `localStorage['mh-mobile-theme']` (`light` / `dark` / `system`).
- The dev build talks to a local API on `:3800` (no `/api` prefix). Lists only show their real layout with data in them; an empty account hides row-level problems.
- For alignment, measure instead of eyeballing: in a card list, the leading item's vertical centre and the label's should match the row's to within about 1px.
