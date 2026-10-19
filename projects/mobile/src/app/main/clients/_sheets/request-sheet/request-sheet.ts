import { Component, computed, inject, input, model, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { InstructorClient, clientDisplayName, isIncomingRequest } from 'core';

import { ActionSheet } from '../../../../_shared/components/action-sheet/action-sheet';
import { ClockService } from '../../../../_shared/services/clock.service';
import { RequestActionId, clientSubline, visibleRequestActions } from '../../clients.config';
import { CLIENT_ICONS } from '../../clients.icons';
import { receivedLabel, sentMetaLabel } from '../../requests.utils';

/**
 * One pending row, opened from the Clients list: who it is, how long it has
 * been waiting, what they wrote when asking, and the verbs. An incoming
 * request is accepted or declined, a sent invitation resent or withdrawn.
 *
 * The sheet only reports which verb was chosen, once it has gone; the page
 * owns the calls, the toasts and the withdraw confirmation.
 */
@Component({
  selector: 'mh-request-sheet',
  imports: [ActionSheet, TranslatePipe],
  templateUrl: './request-sheet.html',
  styleUrl: './request-sheet.scss',
})
export class RequestSheet {
  private readonly _translateService = inject(TranslateService);
  private readonly _clockService = inject(ClockService);

  readonly open = model(false);
  readonly request = input<InstructorClient | null>(null);
  /** Already resent on this visit: Resend stays, disabled and saying so. */
  readonly resent = input(false);

  readonly action = output<RequestActionId>();

  constructor() {
    addIcons(CLIENT_ICONS);
  }

  readonly name = computed(() => {
    const request = this.request();
    return request
      ? clientDisplayName(request)
      : this._translateService.instant('clients.thisPerson');
  });

  /**
   * Their address, or for an email-only invite (whose title is already the
   * address) that they have no account yet.
   */
  readonly subline = computed(() => {
    const request = this.request();
    return request ? clientSubline(request) : '';
  });

  /** "Received yesterday", or "Sent 3 days ago · expires in 11 days". */
  readonly when = computed(() => {
    const request = this.request();
    if (!request) return '';
    const now = this._clockService.now();
    return isIncomingRequest(request)
      ? receivedLabel(request.createdAt, now)
      : sentMetaLabel(request, now);
  });

  /** What they wrote when asking — only an incoming request carries one. */
  readonly message = computed(() => {
    const request = this.request();
    return request && isIncomingRequest(request) ? request.notes?.trim() || '' : '';
  });

  readonly actions = computed(() => {
    const request = this.request();
    return request ? visibleRequestActions(request, this.resent()) : [];
  });
}
