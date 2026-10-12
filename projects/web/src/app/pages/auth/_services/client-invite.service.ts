import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ClientService, InvitationDetails } from 'core';
import { ProfileTabs } from '../../../main/profile/profile.enums';

/**
 * The client invite (`?token=`) in the URL of the auth page that provides it.
 *
 * A coach's invite to someone without an account emails a sign-up link. The
 * invitee may already have an account, or be signed in: sign up, sign in and
 * the signed-in accept card all accept the invite once they know who the user
 * is. Provide it per page (`providers: [ClientInviteService]`).
 */
@Injectable()
export class ClientInviteService {
  private readonly _clientService = inject(ClientService);
  private readonly _router = inject(Router);
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

  /** The profile's Coaches tab, where an accepted invite's coach shows up. */
  openCoaches(): Promise<boolean> {
    return this._router.navigate(['/profile'], { queryParams: { tab: ProfileTabs.Coaches } });
  }
}
