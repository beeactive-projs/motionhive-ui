import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap, take } from 'rxjs';

import { AuthStore, GroupMember, GroupService, UserSearchResult } from 'core';

import { SUGGESTION_LIMIT } from '../../../_shared/config/recent-searches.config';

/**
 * Who the coach could invite, taken from the people already around them.
 *
 * Someone in a coach's own group has already turned up to something of
 * theirs, which makes them a better first suggestion than anything the
 * platform could guess. It is also the only suggestion source that costs no
 * new endpoint: the coach's groups, then each group's members.
 *
 * That is `1 + n` requests, so it loads once when the page opens and never
 * again, and a failure is silent — the section simply is not there, and the
 * search field still works. `isClient` on a member is what keeps the list to
 * people who are not already clients; a member the API did not expand is
 * skipped rather than drawn as a blank row.
 */
@Injectable()
export class GroupSuggestionsStore {
  private readonly _groupService = inject(GroupService);
  private readonly _authStore = inject(AuthStore);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _people = signal<UserSearchResult[]>([]);
  private readonly _loading = signal(false);
  private _loaded = false;

  readonly people = this._people.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly hasAny = computed(() => this._people().length > 0);

  /** Idempotent: the page asks on every entry, the work happens once. */
  load(): void {
    if (this._loaded || this._loading()) return;
    this._loading.set(true);

    this._groupService
      .getInstructorsGroups()
      .pipe(
        take(1),
        catchError(() => of([])),
        switchMap((groups) => {
          if (groups.length === 0) return of([] as GroupMember[][]);
          return forkJoin(
            groups.map((group) =>
              this._groupService.getMembers(group.id, 1, 100).pipe(
                take(1),
                catchError(() => of({ items: [] as GroupMember[], total: 0, page: 1, pageSize: 0 })),
              ),
            ),
          ).pipe(map((pages) => pages.map((page) => page.items)));
        }),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (pages) => {
          this._people.set(candidatesFrom(pages.flat(), this._authStore.user()?.id ?? null));
          this._loading.set(false);
          this._loaded = true;
        },
        error: () => {
          this._loading.set(false);
          this._loaded = true;
        },
      });
  }
}

/**
 * Group members worth offering: not the coach themselves, not already a
 * client, expanded enough to draw, one row per person however many groups
 * they are in, capped.
 *
 * The coach is a member of their own groups — the owner, in fact — so without
 * `selfId` the first suggestion a coach sees is an invitation to themselves.
 * Role is not a filter here: the API does not expand `user.roles` on a member,
 * and a coach who also trains is a legitimate client anyway.
 *
 * Exported for the config spec — the filtering is the part worth pinning, and
 * it cannot be reached through the store.
 */
export function candidatesFrom(
  members: readonly GroupMember[],
  selfId: string | null = null,
  limit = SUGGESTION_LIMIT,
): UserSearchResult[] {
  const seen = new Set<string>();
  const people: UserSearchResult[] = [];

  for (const member of members) {
    if (member.isClient || member.userId === selfId) continue;
    const user = member.user;
    if (!user || seen.has(user.id) || user.id === selfId) continue;

    seen.add(user.id);
    people.push({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? null,
      handle: user.handle,
    });
    if (people.length === limit) break;
  }

  return people;
}
