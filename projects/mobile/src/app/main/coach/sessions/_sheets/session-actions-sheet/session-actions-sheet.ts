import { Component, computed, inject, input, model, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import {
  SessionInstance,
  SessionInstanceStatus,
  formatSessionTime,
  sessionDayLabel,
  sessionLifecycle,
} from 'core';

import { ActionSheet } from '../../../../../_shared/components/action-sheet/action-sheet';
import {
  SESSION_ACTIONS,
  SESSION_ICONS,
  SessionActionId,
  SessionActionIds,
  SessionSurface,
  SessionSurfaces,
  instanceCapacityLabel,
  instancePlaceLabel,
} from '../../sessions.config';

/**
 * The verbs for one occurrence — long-press on a row, or the ⋮ on its detail —
 * under its title, with when, where and how full it is below.
 *
 * The sheet only reports which verb was chosen; the page owns what each one
 * does, because the answers differ by screen (the agenda navigates to the
 * detail to cancel, the detail cancels in place).
 */
@Component({
  selector: 'mh-session-actions-sheet',
  imports: [ActionSheet],
  templateUrl: './session-actions-sheet.html',
})
export class SessionActionsSheet {
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly instance = input<SessionInstance | null>(null);
  /** Hides Share when the coach has not claimed a handle — there is no link yet. */
  readonly canShare = input(false);
  /** Which screen opened it — the detail screen offers fewer verbs. */
  readonly surface = input<SessionSurface>(SessionSurfaces.Agenda);

  readonly action = output<SessionActionId>();

  constructor() {
    addIcons(SESSION_ICONS);
  }

  readonly title = computed(() => {
    const instance = this.instance();
    const fallback = this._translateService.instant('common.session');
    if (!instance) return fallback;
    return instance.titleOverride ?? instance.template?.title ?? fallback;
  });

  /**
   * "Today · 08:30 · Herăstrău · 8/12", the sheet's subtitle.
   *
   * Composed here rather than through `instanceMeta`, which leads with capacity
   * because that is what a dense agenda row needs first. With the session named
   * on the line above, the question this sheet answers is "which one of the two
   * at Herăstrău?", so when and where come before the count.
   */
  readonly meta = computed(() => {
    const instance = this.instance();
    if (!instance) return '';
    const day = sessionDayLabel(new Date(instance.startAt)).split(' · ')[0];
    return [day, formatSessionTime(instance.startAt), instancePlaceLabel(instance), instanceCapacityLabel(instance)]
      .filter(Boolean)
      .join(' · ');
  });

  /**
   * Only the verbs that can do something right now.
   *
   * Check-in is hidden before the session starts — there is nobody to tick off
   * yet — and messaging is hidden with no signups, since it would send to an
   * empty room. Everything left is backed, so nothing here is a dead end.
   *
   * Both navigational verbs go on the detail screen: "open" and "check in" mean
   * "take me to this session", and it is already open, with attendance a
   * section further down the same page.
   */
  readonly visibleActions = computed(() => {
    const instance = this.instance();
    if (!instance) return [];

    const started = sessionLifecycle(instance.startAt, instance.endAt) !== 'upcoming';
    const signups = instance.confirmedCount + instance.pendingApprovalCount;
    const cancelled = instance.status === SessionInstanceStatus.Cancelled;
    const onDetail = this.surface() === SessionSurfaces.Detail;

    return SESSION_ACTIONS.filter((action) => {
      switch (action.id) {
        case SessionActionIds.Open:
          return !onDetail;
        case SessionActionIds.CheckIn:
          return started && !cancelled && !onDetail;
        case SessionActionIds.Message:
          return signups > 0;
        case SessionActionIds.Edit:
          // Detail only: editing needs the full template, which the agenda's
          // rows don't carry — their eager `template` is an allowlisted subset.
          return onDetail && !cancelled;
        case SessionActionIds.Share:
          return this.canShare() && !cancelled;
        case SessionActionIds.Cancel:
          return !cancelled;
        default:
          return true;
      }
    });
  });
}
