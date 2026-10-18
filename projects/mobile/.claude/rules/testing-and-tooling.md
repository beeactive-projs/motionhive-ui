---
paths:
  - "projects/mobile/**"
  - "src/**"
---

# Testing and tooling for the mobile app

## Specs

- Mobile specs are **config-only**: pure helpers in `*.config.ts`, tested in the matching `*.config.spec.ts`. Don't scaffold specs for components, services or stores (Ionic web components are flaky in jsdom).
- When you change a helper an existing config spec covers, extend that spec.
- `ng test mobile` resolves `core` from `dist/core` first. After any change under `projects/core`, run `npx ng build core` before `npx ng test mobile --watch=false`, or the tests fail on members that do exist.
- A change is done when `npx ng build mobile`, `npx ng test mobile --watch=false` and `npm run i18n:check` all pass.

## Formatting

- Don't run the repo's local `prettier`. It is v2, which de-indents the contents of `@if` / `@for` / `@switch` blocks and strips trailing commas, rewriting whole files. Hand-format to match the file (2-space indent, block contents indented one level, trailing commas on multi-line lists, 100-column wrap). If a pass is really needed, use `npx prettier@3 --write <files>` and check `git diff --numstat` shows only the intended change.

## Verifying UI

- Check a visual change in the running app (`npm run start:mobile`, http://localhost:8100) in **both** light and dark mode. Dark mode is the `ion-palette-dark` class, persisted as `localStorage['mh-mobile-theme']` (`light` / `dark` / `system`).
- The dev build talks to a local API on `:3800` (no `/api` prefix). Lists only show their real layout with data in them; an empty account hides row-level problems.
- For alignment, measure instead of eyeballing: in a card list, the leading item's vertical centre and the label's should match the row's to within about 1px.
