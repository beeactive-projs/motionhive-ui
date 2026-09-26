import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSkeletonText,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { GroupsRefreshService, SelfJoinResult } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { JoinActions, joinPolicyLabel, joinPolicyTone } from '../groups.config';
import { GROUP_ICONS } from '../groups.icons';
import { GroupPreviewStore } from './group-preview.store';

/**
 * A group seen from outside: what it is, and the way in.
 *
 * Reached from Discover, which lists groups you are not in — so this screen
 * exists because the group's own page is members-only and answers a
 * non-member with 403. Before it, a Discover tap was a dead end.
 */
@Component({
  selector: 'mh-group-preview',
  imports: [
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSkeletonText,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './group-preview.html',
  styleUrl: './group-preview.scss',
  providers: [GroupPreviewStore],
})
export class GroupPreview {
  readonly store = inject(GroupPreviewStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly Actions = JoinActions;
  readonly skeletonRows = [1, 2, 3];

  readonly joining = signal(false);

  readonly group = computed(() => this.store.profile()?.group ?? null);

  readonly memberCountLabel = computed(() => {
    const count = this.group()?.memberCount ?? 0;
    return `${count} ${count === 1 ? 'member' : 'members'}`;
  });

  readonly policyLabel = computed(() => {
    const group = this.group();
    return group ? joinPolicyLabel(group.joinPolicy) : '';
  });

  readonly policyTone = computed(() => {
    const group = this.group();
    return group ? joinPolicyTone(group.joinPolicy) : 'medium';
  });

  readonly location = computed(() => {
    const group = this.group();
    if (!group?.city) return '';
    return group.country ? `${group.city}, ${group.country}` : group.city;
  });

  readonly instructorName = computed(() => {
    const instructor = this.store.profile()?.instructor;
    if (!instructor) return '';
    return (
      instructor.displayName ||
      [instructor.firstName, instructor.lastName].filter(Boolean).join(' ')
    );
  });

  constructor() {
    addIcons(GROUP_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const groupId = params.get('groupId');
      if (groupId) this.store.init(groupId);
    });
  }

  /**
   * Join, or ask to. Which of the two happened is the server's answer, not a
   * guess from the policy — so the message and where we go next both come
   * from the response.
   */
  join(): void {
    if (this.joining()) return;
    this.joining.set(true);

    this.store.join().subscribe({
      next: (result: SelfJoinResult) => {
        this.joining.set(false);
        this._groupsRefresh.notify();

        if (result.status === 'JOINED') {
          void this._feedbackService.success('You joined the group');
          // Straight in: the group's own page works now, and it is what they
          // were trying to reach.
          void this._router.navigate(['/tabs/groups', this.group()?.id ?? ''], {
            replaceUrl: true,
          });
          return;
        }
        void this._feedbackService.success('Request sent');
      },
      error: (error: unknown) => {
        this.joining.set(false);
        void this._feedbackService.error(error, 'Could not join this group.');
      },
    });
  }

  cancelRequest(): void {
    if (this.joining()) return;
    this.joining.set(true);

    this.store.cancelRequest().subscribe({
      next: () => {
        this.joining.set(false);
        this._groupsRefresh.notify();
        void this._feedbackService.success('Request withdrawn');
      },
      error: (error: unknown) => {
        this.joining.set(false);
        void this._feedbackService.error(error, 'Could not withdraw that request.');
      },
    });
  }

  retry(): void {
    this.store.retry();
  }
}
