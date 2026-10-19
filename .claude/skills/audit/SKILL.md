---
name: audit
description: Pre-push audit of the uncommitted changes (or a given path / git range) in MotionHive-UI. Reviews the diff and the code around it against CLAUDE.md, the project rules and Angular/Ionic best practice, applies the refactors and fixes, then runs the build, test and i18n gates. Never commits or pushes.
argument-hint: "[path | git-range]  (default: all uncommitted changes)"
disable-model-invocation: true
---

# /audit: pre-push code audit

The user pushes by hand right after this. The job is to leave the working tree in a state they can push: rule-compliant, de-duplicated, verified. **Never `git add`, commit, stash, reset or push.**

## 1. Scope

- No argument: every uncommitted change. `git status --short`, then `git -c core.autocrlf=false diff` (and read untracked files in full). Large diffs: dump to the scratchpad and Read them in parts.
- A path: the uncommitted changes under it, plus the files themselves.
- A git range (`main..HEAD`, `HEAD~3`): `git diff <range>`.
- Note which projects are touched: `core`, `web`, `website`, `mobile`. That decides which rules apply and which gates run.

## 2. Load the rules (binding, they override generic best practice)

- Root `CLAUDE.md` always.
- `projects/mobile/CLAUDE.md` and **every** file in `projects/mobile/.claude/rules/` when mobile is touched (lists, icons, colour-and-type, surfaces-and-sheets, ionic-gotchas, testing-and-tooling).
- Any `CLAUDE.md` inside another touched project.
- The memory index (`MEMORY.md`) entries that name the touched features. They record user decisions; don't "correct" those.
- For Angular-specific questions, the `angular-developer` skill is the reference, but the repo rules win where they differ (separate `.html`/`.scss` files, no explicit `OnPush`, `_`-prefixed injected deps, …).

## 3. Read the change *and the code around it*

The diff alone is not enough. For each changed file, also read:

- the whole file (not only the hunks), its template/style/config siblings, and its `*.config.spec.ts` if one exists;
- the consumers and the shared pieces it relies on (the theme skins in `projects/mobile/src/theme/components/`, `layout.css`, `typography.css`, shared components such as `mh-action-sheet` / `mh-sheet-shell`, core utils);
- for a **rename** (class, token, icon, identifier): Grep the whole of `projects/` for leftovers of the old name: CSS classes, TS identifiers, comments, rule docs, CLAUDE.md files.

## 4. Checklist

Work through every item for the touched code. Cite the rule when you fix something.

**Translations**
- No literal user-visible text in templates or TS (labels, `aria-label`s, toasts, placeholders, empty states). Every key exists in **both** `en.json` and `ro.json` (app or core `i18n`, the right namespace). ICU plurals (`one` / `few` / `other` in RO), no hand-rolled plurals, no string concatenation, no dashes as punctuation, sentence case.
- `website` uses XLIFF (`messages.xlf` + `messages.ro.xlf`), not ngx-translate.

**Angular**
- `inject()`, `input()` / `output()` / `model()`, `viewChild()`, signals and `computed()` (no `mutate`), `effect()` only for real side effects, native control flow, `class` / `style` bindings, `host` object, no `standalone: true`, no explicit `OnPush`.
- Naming: `_`-prefixed `readonly` injected deps named after the type; no `_` member used from a template; kebab-case files; `mh-` selectors; no type suffix on components.
- Enum comparisons through a readonly class member exposing the const object, never string literals. Const + type pattern.
- No `any`; unused imports and dead members removed (e.g. a computed whose last template use was deleted).
- Subscriptions: `takeUntilDestroyed` for long-lived streams, `take(1)` for one-shot HTTP.
- Shared types and constants live in `core` and are re-exported from `public-api.ts`; nothing copy-pasted between apps.

**Ionic (mobile)**
- Ionic components only, imported individually from `@ionic/angular/standalone`; icons via `addIcons()` and every rendered icon registered (the config specs guard this; extend them for new icons).
- Interactive controls are `ion-button`, not `ion-chip` or bare elements (`ion-chip` has no role).
- Lists follow `lists.md`: `mh-card-list` vs `mh-flat-list`, no `lines` / `--padding-*` / `--min-height` / `--border-*` on rows, `[detail]` instead of hand-placed chevrons, the hex tile rules and colours, the `--mh-row-lead` rule for a new leading item.
- Icons follow `icons.md`: outline only (except the state pairs), chevrons not arrows for direction, `--mh-icon-*` sizes, new round glyphs added to the `scale: 1.06` list in `ion-icon.css`.
- Sheets follow `surfaces-and-sheets.md`: built on `mh-sheet-shell` / `mh-action-sheet`; a sheet that navigates awaits `close()` first (`mh-action-sheet` already emits after it has dismissed).
- `ion-searchbar` carries `mhAutofocus` (unless it is always on screen), `searchIcon` / `clearIcon`; `ion-select` carries `toggleIcon`.
- `ionViewWillEnter` for per-visit loads in tab-stack pages, not `ngOnInit`.

**PrimeNG (web)**
- `<button pButton>` (never `<p-button>`), `type="button"`, `iconOnly` + `aria-label`, `fluid` where supported, `[appendTo]="'body'"` on overlays, v22 component names, `MenuItem` / `SelectItem` shapes, no `pTemplate`.

**Styling**
- Tokens only: no hex / rgb literals, no `font-size` literal (use `--mh-text-*` / `--mh-icon-*`), no `px` except 1px hairlines and the named width tokens, every dimension on the 0.125rem grid, line-height through `--mh-leading-*`.
- Web: PrimeNG design tokens in SCSS, Tailwind before custom CSS.
- **No duplication across page `.scss` files.** The same rule in two pages moves into the skin for that component (`theme/components/<ion-component>.css`) or a layout primitive, and the page copies are deleted. Component `.scss` stays minimal; an empty file is fine.
- Honey (primary) means action or selection, never status. Red means destruction (plus unread dots and real failures).

**Accessibility**
- Icon-only buttons have a translated `aria-label`; decorative icons are `aria-hidden="true"`; toggles expose `aria-pressed` from the same expression as their visual state; popup triggers have `aria-haspopup`; status dots have an accessible name. WCAG AA contrast (white glyph on a tile needs 3:1, text 4.5:1).

**Docs and specs stay true**
- If the change sets or alters a convention, the matching rule file / CLAUDE.md says so, and nothing in them still describes the old way.
- New or changed pure helpers in a `*.config.ts` get a case in the matching `*.config.spec.ts`. Mobile adds **no** component, service or store specs.

**Formatting**
- Hand-format to match the file: 2-space indent, `@if` / `@for` contents indented one level, trailing commas, ~100-column wrap. **Never run the repo's local prettier** (v2 de-indents control-flow blocks). Fix stray indentation by hand.

## 5. Apply

- Fix everything that is a clear rule violation, a duplication, dead code, a leftover from a rename, a missing translation or a missing spec. Keep behaviour identical unless a bug is the finding.
- Don't redesign. A finding that needs a product or design decision (copy wording the user chose, a colour choice recorded in memory, a layout change) is **reported, not applied**. Ask with AskUserQuestion only if it blocks the push.
- Keep refactors inside the audited scope plus the shared skins it relies on; don't sweep unrelated files.

## 6. Verify (all must pass)

Run from **PowerShell** (the Bash/rtk path breaks vitest):

```powershell
npx ng build core                 # always first if core changed; mobile tests resolve core from dist/core
npx ng build mobile               # for each touched app: mobile / web / website
npx ng test mobile --watch=false  # or the touched project's tests
npm run i18n:check
```

On a failure: fix it and re-run that gate. Report any gate you could not run. For a visual change, say that it still needs a look in the running app in light **and** dark mode (`npm run start:mobile`); don't claim it was verified visually unless it was.

## 7. Report

End with a short summary for the user, who pushes next:

- **Fixed**: one line per change, with file links (`[file.ts:42](path#L42)`) and the rule it satisfies.
- **Left as is**: findings not applied, and why (user decision, needs design input, out of scope).
- **Gates**: build / test / i18n results with the counts.
- **Before you push**: anything still manual (visual check, a backend dependency).

Do not commit or push. The working tree is handed back as is.
