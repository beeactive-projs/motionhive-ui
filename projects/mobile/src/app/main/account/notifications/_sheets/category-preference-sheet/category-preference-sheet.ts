import { Component, computed, input, model, output } from '@angular/core';
import {
  IonButton,
  IonItem,
  IonLabel,
  IonList,
  IonToggle,
  ToggleCustomEvent,
} from '@ionic/angular/standalone';

import { CategoryPreferenceView } from 'core';

import { HexAvatar } from '../../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../../_shared/components/sheet-shell/sheet-shell';
import { categoryStyle } from '../../../../../_shared/config/notification-categories.config';
import {
  ChannelRow,
  ConfigurableChannel,
  channelRows,
} from '../../notification-preferences.config';

/** One flipped toggle, as the page commits it. */
export interface ChannelChange {
  channel: ConfigurableChannel;
  enabled: boolean;
}

/**
 * One category's channels, as a sheet: the locked in-app row with its reason,
 * then a toggle per channel the API lets you set. Each flip commits on its
 * own — every other switch on the phone works that way — so there is no
 * footer. The page owns the write and its rollback; this only reports flips,
 * and reads the row back from the page so a rollback shows here too.
 */
@Component({
  selector: 'mh-category-preference-sheet',
  imports: [HexAvatar, IonButton, IonItem, IonLabel, IonList, IonToggle, SheetShell],
  templateUrl: './category-preference-sheet.html',
  styleUrl: './category-preference-sheet.scss',
})
export class CategoryPreferenceSheet {
  readonly open = model(false);
  readonly preference = input<CategoryPreferenceView | null>(null);
  /** A write for this category is in flight — no double flips meanwhile. */
  readonly saving = input(false);
  readonly resetting = input(false);

  readonly channelChanged = output<ChannelChange>();
  readonly reset = output<void>();

  readonly style = computed(() => {
    const preference = this.preference();
    return preference ? categoryStyle(preference.category) : null;
  });

  readonly rows = computed(() => {
    const preference = this.preference();
    return preference ? channelRows(preference) : [];
  });

  readonly title = computed(() => this.preference()?.label ?? 'Notifications');

  onToggle(row: ChannelRow, event: ToggleCustomEvent): void {
    if (row.locked || row.key === 'in_app') return;
    this.channelChanged.emit({ channel: row.key, enabled: event.detail.checked });
  }
}
