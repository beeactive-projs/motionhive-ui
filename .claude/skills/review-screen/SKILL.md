---
name: review-screen
description: Live browser review of a MotionHive mobile (Ionic) screen against the mobile rules. It drives the running app with Playwright in light and dark × md and iOS, at 130% text and in Romanian, forces every state, measures contrast, targets and names through the shadow DOM, and writes a ranked fix report. Use when asked to audit, review or QA a mobile screen or feature in the browser, or to re-verify fixes from such a report. Not for reviewing a diff (that is /audit).
argument-hint: "<route or feature>  e.g. /tabs/messages, or 'Clients'"
---

# /review-screen: live review of a mobile screen

The output is a report another session can act on: every finding reproduced, measured, tied to a file and a rule, with a fix. **Never report what you have not reproduced.** Ionic's shadow DOM fools browser tooling; confirm in the real DOM, and mark anything found only by reading code `[from code]`.

The scripts in `scripts/` are the harness. Run them with Node from PowerShell. They resolve `playwright` from the repo's `node_modules`. Set `REVIEW_OUT` to the session scratchpad on every call: the browser profile and the screenshots go there, never into the repo.

## 1. Scope and rules

- **Name the screens:** the route, its sub-pages and its sheets. Read their source from disk. Read every file you will report on in full, along with its template and style siblings.
- **Load the binding rules:**
  - `projects/mobile/CLAUDE.md` and every file in `projects/mobile/.claude/rules/`.
  - The memory index entries for the feature. They hold user decisions such as "archive is violet", "the pending badge is amber" and `mobile-redesign-scope`.
- **Decisions come first.** A finding that contradicts a recorded decision, or a code comment saying "deliberately", is a question for the user, not a bug. Example: `clients-empty.ts` says "Deliberately not `mh-empty-state`".
- **Redesign scope:** only the screens on the new design (see memory `mobile-redesign-scope`) are held to the full rules. Problems elsewhere get one line each as "old design".

## 2. Preflight

- **Check the servers over HTTP**, never with `Get-NetTCPConnection`: it reported the user's running servers as down.
  - `Invoke-WebRequest http://localhost:8100/` should return 200.
  - `Invoke-WebRequest http://localhost:3800/auth/login` returns 404, which means it's up.
- **If a server is down,** ask before starting it. The API's `.env` points at a shared cloud Redis, so start it the way memory `local-browser-login-for-mobile-dev` describes: schedulers off, and a dead Redis port.
- **Pick the account.** Run `node scripts/probe-accounts.js` to see what each test account reaches. Use the one with the most states and fake the rest (step 5). As of 2026-11-03:

  | Account | Has |
  |---|---|
  | `instructor@motionhive.fit` / `Test1234!` | Coach: 3 sent invites, 1 email-only invite, 2 active clients. Trainee of 2 coaches, 12 routines |
  | `mh.more.menu.check@gmail.com` / `SecurePass123!` | Coach: 1 incoming request, 1 email-only invite, 2 active |
  | `coach.radu.marin@motionhive.fit` / `Test1234!` | Coach: 1 active client (instructor@) |

  No account has an archived client. Fake that state.

- **Start the browser:** `node scripts/browser-host.js` with `run_in_background`. It prints `host ready`. Steps connect to `127.0.0.1:9333`; `localhost` resolves to IPv6 there and misses.

## 3. How a step works

Write small step files in the scratchpad and run `node scripts/step.js <step.js>`. A step exports `async (page, ctx) => result`. The `ctx` helpers are documented at the top of `step.js`:

- `ctx.login(email, pw)` signs in.
- `ctx.calls()` logs API calls.
- `ctx.kit()` injects `a11y-lib.js`, after which `window.__a11y.*` is available.
- `ctx.shot(name)` takes a screenshot. Then **Read the PNG and look at it.** Numbers miss what eyes catch, such as misalignment and the same person in two colours.
- `ctx.romanian()` renders Romanian without writing to the account.

Anything a step sets on the connection (routes, viewport, media) dies with the step, so set, measure and screenshot in one step. Keep steps short. When a selector fails, the step stops and the results so far are lost.

Driving Ionic from Playwright:

- **Click the host:** `ion-button` intercepts the pointer, so click `mh-x ion-header ion-button.round`, not the inner button.
- **Segment buttons:** `ion-segment-button`'s `value` is a property, not an attribute. Click by position (`.nth(i)`).
- **Swipes:** don't drag. Call `row.querySelector('ion-item-sliding').open('end')`, then measure, then `.close()`.
- **Sheet title:** `.heading-title` in the shell. The dialog name is on `modal.shadowRoot .modal-wrapper`.
- **Labelled controls:** Ionic moves a button's `aria-label` to its shadow `<button>`. Target `button[aria-label="…"]` to find one; the host has none.
- **Searchbar clear:** a keystroke within 64ms of tapping the X is lost (Ionic's timer). Wait 150ms; that's not a bug.

## 4. Sweep

- `scripts/sweep.js` with `URL` and `WAIT_FOR` runs light and dark × md and iOS. It returns contrast, tap targets, Ionic names, headings, live regions, small text and row heights for each, plus the API calls.
- Read all four screenshots.
- Flat-list rows must be exactly 72px at 100%. Anything else is a separator drift (`lists.md`).

## 5. Drive every path, force every state

- **Paths:** search (one character, a real term, a miss, clear, close), each chip, each sheet, each swipe side, the detail page and every tab, and back. Log calls per action: one request per settled term, nothing on a quick in-and-out (freshness windows), no duplicates.
- **States:** reach them through the page's store. In dev, `window.ng.getComponent(document.querySelector('mh-<page>')).store` exposes private signals too. Force:
  - the skeleton;
  - the first-run empty screen;
  - the filtered empty and search empty states;
  - a cold error (no rows) and a stale error (rows kept, bar shown);
  - an archived row;
  - a long list (25+ rows; the infinite scroll fires and the last row clears the tab bar).

  **Reload afterwards.**
- **Failures:** `page.route(api + '/x*', r => r.abort())` inside the step.

## 6. Accessibility, measured

- **Contrast:** `contrast()` handles Ionic's native fills. Also run `hexTiles()`: SVG tiles, where a glyph needs 3:1. And run `swipeOptions()` on every open swipe: 12px labels, 4.5:1.
- **Names:** `ionicNames()`. The search input's own `aria-label` must be the field's name, not "search text". Back buttons must read "Back" / "Înapoi". The dialog name must equal the visible title every time the sheet opens.
- **Targets:** `targets()` flags anything under the house 44px. WCAG AA's floor is 24, so report the gap as a house-rule question unless it's under 24.
- **Structure:** headings (an `h1` on every page; `ion-title` isn't one), live regions (a settled search or chip is announced, in words that match the screen), and `focusables()`.
- **Text size and language:** `scripts/large-text.js` on an iPhone SE at 130%, once in English and once with `LANG_CODE=ro`. Check clipping (an `overflow` entry with `scrolls: false`), leaked keys and row heights.

## 7. Never do these to dev data

- **Email goes out for real** (Resend is live in the local API). Never send an invite, resend an invitation or trigger any other email.
- **Destructive or answering verbs:** never Withdraw, Decline, Accept, Delete, Archive or End coaching. Open the sheet or confirm, measure it, dismiss it. Fake the outcome by setting the store's signals.
- **The account's settings:** never change them (language, theme, profile). Romanian goes through `ctx.romanian()`.

## 8. Known false alarms (each one cost a pass before)

- **Text in an SVG hex tile, or in `.mh-visually-hidden`:** the CSS walk can't see it, so the kit skips both. Use `hexTiles()` for tiles.
- **Ionic button fills in shadow DOM:** the kit reads `[part=native]`. A 1.2:1 on a honey button means a host was measured.
- **`innerText` of a row or tab:** that's not its accessible name. Use `page.locator(x).ariaSnapshot()`. The Clients tab was "Clients 1" by text but "Clients 1 client request waiting" to a screen reader.
- **A second `NAV` to the same URL on load:** the router settling, not a second boot.
- **Flat rows of 93.563px at 130% text:** Chrome lays out in 1/64px units, and 4.5rem at a 20.8px root rounds to that. At 100% anything but 72px is real.

## 9. Report

Markdown in the scratchpad (offer to move it to `docs/`). Sections, in order:

1. Scope and method: screens, viewport, accounts, what was faked, what was deliberately not done.
2. "Do these first": 6–10 rows of id, severity, one line.
3. Functional bugs, accessibility, UI and UX, code quality. Each finding has:
   - an id (`F1` `A1` `U1` `C1`);
   - the repo-relative `file:line`;
   - what happens;
   - why (the line, the guard, or the Ionic internal);
   - the fix, in code where that's shorter;
   - measured numbers (`4.23:1`, `73.031px`);
   - a tag, `[verified]` or `[from code]`.
4. What was verified fine, briefly, so nobody re-checks it.
5. Tests worth adding: mobile specs are config-only (`testing-and-tooling.md`).
6. Not covered: devices, screen readers, gestures, writes.

## 10. After fixes

- Re-run the same steps.
- Add a "Fix status" table to the report with the measured-after number for each fix.
- Run the gates: `npm run i18n:check`, `npx ng test mobile --watch=false` from **PowerShell**, and `npx ng build mobile --configuration development`.
- Other sessions may be editing the same tree. Use targeted edits, never whole-file rewrites of files you didn't create, and recheck your edits at the end.
- Stop the browser host. Leave the user's servers running.
