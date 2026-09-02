import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';

import { HexAvatar, HexAvatarTone, HexAvatarTones } from '../hex-avatar/hex-avatar';

/**
 * One row of a grouped settings card: optional hexagon icon tile, label, a
 * trailing value or status badge, and a chevron.
 *
 * The account area renders about twenty of these across five screens. Without
 * a component each one is a nine-line `ion-item` with the same six CSS
 * variables re-declared, which is exactly the CSS dumping this project bans.
 *
 * The row draws its own divider instead of letting the list do it. Ionic's
 * inset-list stylesheet zeroes the border on `ion-item:only-child`
 * (`list.ios.css` / `list.md.css`), and every item here IS an only child —
 * of this component's host — so the built-in dividers all disappear. An
 * outer-tree declaration also outranks the item's own shadow `:host` rule, so
 * `lines="full"` cannot win it back. Hence `lines="none"` plus a border here.
 *
 * The consequence: **keep a grouped list homogeneous.** The last row drops its
 * hairline via `:host(:last-of-type)`, which counts only sibling
 * `mh-settings-row`s — mix these with bare `ion-item`s and the hairline lands
 * in the wrong place. Use one or the other per list.
 */
@Component({
  selector: 'mh-settings-row',
  imports: [HexAvatar, IonBadge, IonItem, IonLabel, IonNote],
  templateUrl: './settings-row.html',
  styleUrl: './settings-row.scss',
})
export class SettingsRow {
  readonly label = input.required<string>();
  /** ionicons name — the host page registers it with `addIcons()`. Omit for an untiled row. */
  readonly icon = input<string | null>(null);
  /** Ionic palette name for the tile. */
  readonly iconColor = input<string>('primary');
  readonly iconTone = input<HexAvatarTone>(HexAvatarTones.Base);
  readonly value = input<string | null>(null);
  /** Shown in muted italics when `value` is empty — the design's "Not provided". */
  readonly valuePlaceholder = input<string | null>(null);
  /** Renders the value in the mono family, for handles. */
  readonly valueMono = input(false);
  readonly badge = input<string | null>(null);
  /** A waiting-dot at the row's end — the tab bar's "something is in here" idiom. */
  readonly dot = input(false);
  readonly detail = input(true);
  readonly disabled = input(false);
  /** Secondary line under the label — used for the disabled rows' "Coming soon". */
  readonly note = input<string | null>(null);

  readonly select = output<void>();

  readonly hasValue = computed(() => !!this.value());
  readonly displayValue = computed(() => this.value() ?? this.valuePlaceholder());
}
