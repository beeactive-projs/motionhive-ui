---
paths:
  - "projects/mobile/src/**/*.{html,scss,css,ts}"
  - "src/**/*.{html,scss,css,ts}"
---

# Colour and type in the mobile app

The token tiers and the type scale are in `projects/mobile/CLAUDE.md`. These are the rules people trip over.

## Colour

- The palette **is** Tailwind's default ramps under product names (`primary` Amber, `info` Sky, `danger` Red, `success` Emerald, `medium` Slate…), with the source of truth in `projects/core/src/styles/theme-colors.ts`. Map a design hex to an existing ramp step before adding anything. A new hue gets its full Tailwind ramp in `theme-colors.ts` first, then the slot set in `variables.css`.
- Variants come from adjacent ramp steps (600 shade, 400 tint), never from a mix formula.
- Honey (`primary`) means action or selection: the primary CTA, a selected chip, the active tab. Never use it as a status colour.
  - One exception, chosen to match WhatsApp's chat list: on an inbox row, the unread count badge and the unread timestamp are honey (muted rows too; the bell marks them), and so is the Messages tab's count. The unread timestamp stays at 600, like the rest of the type scale. Don't spread the honey to other lists.
- Red (`danger`) on an action means it destroys something: block, delete, remove, cancel, archive, leave, discard, sign out. A verb that is not destructive is never red, even if it concerns alerts or notifications (those are `info`). As a status, red stays for real failures and overdue or conflicting states, plus the small unread dots and the Clients tab's count of requests waiting on the coach.
- Status colours are neutral or semantic. Soft status chips use the wash pair: `background: var(--ion-color-<name>-wash); color: var(--ion-color-<name>-wash-contrast)`.
- A white glyph needs 3:1 on its tile. Sky 500 and Emerald 500 miss it; use `tone="shade"` for those where the glyph carries meaning.
- Hairlines between rows use `--mh-color-separator`. `--mh-color-divider` is a soft fill (pills, composer), not a line on a card.
- Dark mode is Ionic's palette class on `<html>`. A colour that must differ in dark mode is a token with its override in `variables.css`. Use a component-level `:host-context(.ion-palette-dark)` rule only for what no token expresses (the auth pages' honeycomb flips navy to honey and changes its opacity).

## Type

- Sentence case for all visible text. `mh-kicker` is never uppercased: no `ion-text-uppercase` beside it, no `text-transform` on it. The kicker look comes from weight and `--mh-tracking-kicker`. Don't add new uppercase micro-labels.
- `font-size` is always a `--mh-text-*` token, and dimensions sit on the 0.125rem grid (see CLAUDE.md). Off-grid literals like `0.7rem` or `0.8rem` are bugs; snap them to a token when you touch the file.
- Secondary text is secondary by colour (`--ion-color-medium`) before size. A row's trailing value stays at the label's size.
