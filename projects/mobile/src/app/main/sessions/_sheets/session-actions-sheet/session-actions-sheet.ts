import { Component, computed, input, model, output } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  SessionInstance,
  formatSessionTime,
  sessionDayLabel,
  sessionLifecycle,
} from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import {
  SESSION_ACTIONS,
  SESSION_ICONS,
  SessionActionId,
  SessionActionIds,
  instanceMeta,
} from '../../sessions.config';

/**
 * The verbs for one occurrence — long-press on a row, or the ⋮ on its detail.
 *
 * A component rather than `ActionSheetController` for two reasons. The design's
 * header line (time, title, where, how full) is not something the controller
 * can render — it takes a plain string. And an action sheet built in TypeScript
 * hides its icon names from the config spec's template scanner, which is what
 * keeps registered and rendered icons in step.
 *
 * The sheet only reports which verb was chosen; the page owns what each one
 * does, because the answers differ by screen (the agenda navigates to the
 * detail to cancel, the detail cancels in place).
 */
@Component({
  selector: 'mh-session-actions-sheet',
  imports: [IonIcon, IonItem, IonLabel, IonList, SheetShell],
  templateUrl: './session-actions-sheet.html',
  styleUrl: './session-actions-sheet.scss',
})
export class SessionActionsSheet {
  readonly open = model(false);
  readonly instance = input<SessionInstance | null>(null);
  /** Hides Share when the coach has not claimed a handle — there is no link yet. */
  readonly canShare = input(false);

  readonly action = output<SessionActionId>();

  constructor() {
    addIcons(SESSION_ICONS);
  }

  readonly title = computed(() => {
    const instance = this.instance();
    if (!instance) return 'Session';
    return instance.titleOverride ?? instance.template?.title ?? 'Session';
  });

  readonly time = computed(() => {
    const instance = this.instance();
    return instance ? formatSessionTime(instance.startAt) : '';
  });

  /** "TODAY · HERĂSTRĂU · 8/12" — uppercased in CSS, not here. */
  readonly meta = computed(() => {
    const instance = this.instance();
    if (!instance) return '';
    const day = sessionDayLabel(new Date(instance.startAt)).split(' · ')[0];
    return `${day} · ${instanceMeta(instance)}`;
  });

  /**
   * Only the verbs that can do something right now.
   *
   * Check-in is hidden before the session starts — there is nobody to tick off
   * yet — and messaging is hidden with no signups, since it would send to an
   * empty room. Everything left is backed, so nothing here is a dead end.
   */
  readonly visibleActions = computed(() => {
    const instance = this.instance();
    if (!instance) return [];

    const started = sessionLifecycle(instance.startAt, instance.endAt) !== 'upcoming';
    const signups = instance.confirmedCount + instance.pendingApprovalCount;
    const cancelled = instance.status === 'CANCELLED';

    return SESSION_ACTIONS.filter((action) => {
      switch (action.id) {
        case SessionActionIds.CheckIn:
          return started && !cancelled;
        case SessionActionIds.Message:
          return signups > 0;
        case SessionActionIds.Share:
          return this.canShare() && !cancelled;
        case SessionActionIds.Cancel:
          return !cancelled;
        default:
          return true;
      }
    });
  });

  choose(id: SessionActionId): void {
    this.open.set(false);
    this.action.emit(id);
  }
}
