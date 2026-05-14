import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  output,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthStore,
  type AvatarUser,
  InstructorGroupSummary,
  joinPolicyLabel,
  joinPolicySeverity,
  type JoinPolicy,
  PublicProfileStore,
  TagSeverity,
} from 'core';
import { Avatar as PrimeAvatar } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { Avatar } from '../../../../_shared/components/avatar/avatar';

@Component({
  selector: 'mh-public-profile-groups-tab',
  imports: [Avatar, PrimeAvatar, Button, Card, SkeletonModule, TagModule],
  templateUrl: './groups-tab.html',
  styleUrl: './groups-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupsTab implements OnInit {
  private readonly _store = inject(PublicProfileStore);
  private readonly _authStore = inject(AuthStore);
  private readonly _router = inject(Router);

  readonly groups = this._store.groups;
  readonly loading = this._store.loadingGroups;

  readonly isGuest = computed(() => !this._authStore.isAuthenticated());

  /** Bubbles up so the parent shell can open the signup-prompt dialog. */
  readonly lockedJoin = output<void>();

  ngOnInit(): void {
    this._store.loadGroups();
  }

  policySeverity(policy: string): TagSeverity {
    return joinPolicySeverity(policy as JoinPolicy);
  }

  policyLabel(policy: string): string {
    return joinPolicyLabel(policy as JoinPolicy);
  }

  /**
   * Adapts an `InstructorGroupSummary` into the shape `mh-avatar` expects.
   * The group's name is fed in as `firstName` so the fallback initials
   * derive cleanly from the first letter when there's no logo.
   */
  groupAvatar(group: InstructorGroupSummary): AvatarUser {
    return {
      firstName: group.name,
      lastName: null,
      avatarUrl: group.logoUrl,
    };
  }

  /** Trailing meta chips beyond members count — tags after the first one. */
  extraTags(group: InstructorGroupSummary): string[] {
    return (group.tags ?? []).slice(0, 3);
  }

  onJoin(groupId: string): void {
    if (this.isGuest()) {
      this.lockedJoin.emit();
      return;
    }
    void this._router.navigate(['/groups', groupId]);
  }
}
