import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { InvitationDetails } from '../../models/client/client.model';
import { ClientService } from './client.service';

/**
 * The client invite (`?token=`) in the URL of the auth page that provides it.
 *
 * A coach's invite to someone without an account emails a sign-up link. The
 * invitee may already have an account, or be signed in: sign up, sign in and
 * the signed-in accept card all accept the invite once they know who the user
 * is. Only the token in the URL counts, never a remembered one: on a shared
 * device that could be somebody else's. Provide it per page
 * (`providers: [ClientInviteService]`); where to go after accepting is the
 * app's call.
 */
@Injectable()
export class ClientInviteService {
  private readonly _clientService = inject(ClientService);
  private readonly _activatedRoute = inject(ActivatedRoute);

  /** The invite token in this page's URL, if any. */
  readonly token = this._activatedRoute.snapshot.queryParamMap.get('token');
  /** Who sent the invite, and to which address. Null until loaded, or if invalid. */
  readonly details = signal<InvitationDetails | null>(null);
  /** The token is unknown, expired or already answered. */
  readonly invalid = signal(false);
  /** The inviting coach's full name, once the invite has loaded. */
  readonly coachName = computed(() => {
    const coach = this.details()?.instructor;
    return coach ? `${coach.firstName} ${coach.lastName}` : '';
  });

  /** Loads the invite's details; on failure marks it invalid. */
  load(token: string): Observable<InvitationDetails> {
    return this._clientService.getInvitationByToken(token).pipe(
      tap({
        next: (details) => this.details.set(details),
        error: () => this.invalid.set(true),
      }),
    );
  }

  /** Accepts the invite for the signed-in user. */
  accept(token: string): Observable<unknown> {
    return this._clientService.acceptByToken(token);
  }
}
