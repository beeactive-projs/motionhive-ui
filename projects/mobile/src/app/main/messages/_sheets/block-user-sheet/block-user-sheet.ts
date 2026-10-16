import { Component, computed, inject, input, model, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { BLOCK_REASONS, UserBlockReason } from 'core';

import { ActionSheet } from '../../../../_shared/components/action-sheet/action-sheet';
import { SheetAction } from '../../../../_shared/components/action-sheet/action-sheet.model';

/**
 * Every reason commits the block, so all of them are destructive and share
 * the one red card. Order and values come from core; the labels are core's
 * `enum.userBlockReason` keys.
 */
const BLOCK_ACTIONS: readonly SheetAction<UserBlockReason>[] = BLOCK_REASONS.map(({ value }) => ({
  id: value,
  label: `enum.userBlockReason.${value}`,
  destructive: true,
}));

/**
 * The block confirmation — the reason list from chat details' Privacy row.
 *
 * Choosing a reason is the confirmation, one step; the page owns the actual
 * block.
 */
@Component({
  selector: 'mh-block-user-sheet',
  imports: [ActionSheet, TranslatePipe],
  templateUrl: './block-user-sheet.html',
})
export class BlockUserSheet {
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly name = input.required<string>();

  readonly confirm = output<UserBlockReason>();

  readonly reasons = BLOCK_ACTIONS;

  readonly title = computed(() =>
    this._translateService.instant('messages.blockSheet.title', { name: this.name() }),
  );
}
