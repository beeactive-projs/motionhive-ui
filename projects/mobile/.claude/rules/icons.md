# Icons in the mobile app

Ionicons is the only icon set. These rules keep it reading as one set: one weight, one style, sizes on a grid. The global skin is [`theme/components/ion-icon.css`](../../src/theme/components/ion-icon.css).

## Outline, always

- Every icon is the `-outline` variant. A glyph with no suffix is the filled one; don't use it.
- Filled is allowed only for the "on" half of a state pair, and the "off" half is the outline of the same glyph: `thumbs-up` (reacted) / `thumbs-up-outline`, and `checkmark-circle` for selected or done. A "done" mark is always the filled `checkmark-circle`; `checkmark-circle-outline` is an action ("mark attended", "assign").
- Brand logos (`logo-*`) exist only filled. They are the one other exception.
- `people-circle-outline` and `person-circle-outline` are filled glyphs despite their names. Don't use them.
- Dismiss is `close-outline`. `close-circle-outline` is a cancel or decline verb.
- Ionic's Material built-ins are the sharp set, so they are overridden: `backButtonIcon` in `app.config.ts` (`chevron-back-outline`; it also covers the searchbar's cancel button), `searchIcon="search-outline" clearIcon="close-outline"` on every `ion-searchbar`, and `toggleIcon="chevron-down-outline"` on every `ion-select`. A new searchbar or select carries the same attributes. Those names are registered once in `app.ts`.

## One stroke weight

- The stroke is set once, as `--ionicon-stroke-width` in `ion-icon.css`. Never override it in a component.
- Direction is always a chevron, never an arrow: back is `chevron-back-outline` (the toolbar back button, a search back button), forward is `chevron-forward-outline`, a circled "open" is `chevron-forward-circle-outline`. `arrow-undo-outline` stays: it means undo or restore, not a direction.
- The chevrons hardcode a 48-unit stroke, and `card-outline` and `link-outline` carry their own. They don't follow the variable.

## Sizes

- An icon's `font-size` is a `--mh-icon-*` token, never a `--mh-text-*` step or a literal:

  | Token | Size | Use |
  |---|---|---|
  | `--mh-icon-sm` | 16px | dense: tags, chips, inline meta, banners beside small text |
  | `--mh-icon-md` | 20px | inline with body text, inside buttons and steppers |
  | `--mh-icon-lg` | 24px | toolbars, the tab bar, standalone actions (a sheet's close X) |
  | `--mh-icon-xl` | 32px | empty states, in-card heroes |
  | `--mh-icon-2xl` / `--mh-icon-3xl` | 40 / 48px | xl / 2xl hex tile glyphs |

- Toolbar icon-only buttons and the tab bar are already pinned to 24 in the theme. Don't set a size on them.
- Don't use `size="small|large"` on `ion-icon`.

## Bounding box

- An icon on a tile is an `mh-hex-avatar` with `icon`, never a hand-rolled shape. The tile keeps its glyph at about half its width: sm 16, md 20, lg 24, xl 40, 2xl 48. xs (a 1.5rem tile) keeps a 0.75rem glyph.

## Optical size

- Round glyphs look smaller than square ones in the same box, so `ion-icon.css` scales them up 6% (`scale: 1.06`) by name. When you use a new round glyph (a circle-based outline), add it to that selector list.
