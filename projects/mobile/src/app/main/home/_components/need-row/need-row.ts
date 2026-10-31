import { Component, computed, input, output } from '@angular/core';

import { PersonRow } from '../../../../_shared/components/person-row/person-row';
import { RecentPerson } from '../../../../_shared/config/recent-searches.config';
import { NeedRow } from '../../home.config';

/**
 * One row of Needs you, on Home and on its page: who, why in one line, and
 * the one verb that deals with it. A people row (`mh-person-row`) with a
 * title and a verb; the row itself takes no taps, so each person is one
 * control (`lists.md`, the row verb). The requests row has nobody single
 * behind it, so it shows the people tile.
 */
@Component({
  selector: 'mh-need-row',
  imports: [PersonRow],
  templateUrl: './need-row.html',
})
export class NeedRowItem {
  readonly row = input.required<NeedRow>();

  readonly act = output<void>();

  /** The face and the line under the title; the requests row keys its tile on the row. */
  readonly person = computed<RecentPerson>(() => {
    const row = this.row();
    return {
      id: row.person?.id ?? row.key,
      name: row.person?.name ?? row.title,
      avatarUrl: row.person?.avatarUrl ?? null,
      subline: row.detail,
    };
  });
}
