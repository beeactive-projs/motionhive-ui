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
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  GroupMemberPostPolicies,
  GroupMemberPostPolicy,
  GroupService,
  GroupsRefreshService,
  JoinPolicies,
  JoinPolicy,
} from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import {
  GROUP_DESCRIPTION_MAX_LENGTH,
  GROUP_MAX_TAGS,
  GROUP_NAME_MAX_LENGTH,
  GROUP_TAG_MAX_LENGTH,
  JOIN_POLICY_OPTIONS,
  POST_POLICY_OPTIONS,
} from '../groups.config';
import { GROUP_ICONS } from '../groups.icons';

/**
 * Create a group, or change one you own. One page for both.
 *
 * The two differ only in what the fields start as and what the save button
 * says — a separate create wizard would ask the same five questions in a
 * longer way, and none of them depend on each other.
 *
 * Delete sits last and red, after everything else, because it is the one
 * action here that cannot be walked back.
 */
@Component({
  selector: 'mh-group-edit',
  imports: [
    ConfirmSheet,
    EmptyState,
    IonBackButton,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonRadio,
    IonRadioGroup,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToggle,
    IonToolbar,
  ],
  templateUrl: './group-edit.html',
  styleUrl: './group-edit.scss',
})
export class GroupEdit implements ViewWillEnter {
  private readonly _groupService = inject(GroupService);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly joinPolicyOptions = JOIN_POLICY_OPTIONS;
  readonly postPolicyOptions = POST_POLICY_OPTIONS;
  readonly nameMaxLength = GROUP_NAME_MAX_LENGTH;
  readonly descriptionMaxLength = GROUP_DESCRIPTION_MAX_LENGTH;
  readonly maxTags = GROUP_MAX_TAGS;
  readonly tagMaxLength = GROUP_TAG_MAX_LENGTH;

  /** Set when editing; empty when creating. */
  private readonly _groupId = signal('');

  readonly isEdit = computed(() => !!this._groupId());
  readonly heading = computed(() => (this.isEdit() ? 'Edit group' : 'New group'));
  readonly saveLabel = computed(() => (this.isEdit() ? 'Save changes' : 'Create group'));

  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly saving = signal(false);

  readonly name = signal('');
  readonly description = signal('');
  readonly isPublic = signal(false);
  readonly joinPolicy = signal<JoinPolicy>(JoinPolicies.InviteOnly);
  readonly postPolicy = signal<GroupMemberPostPolicy>(GroupMemberPostPolicies.Open);
  readonly city = signal('');
  readonly tags = signal<string[]>([]);
  readonly tagDraft = signal('');

  readonly deleteOpen = signal(false);
  readonly deleting = signal(false);

  readonly canSave = computed(
    () => this.name().trim().length > 0 && !this.saving() && !this.loading(),
  );

  readonly canAddTag = computed(() => {
    const tag = this.tagDraft().trim();
    return (
      tag.length > 0 &&
      tag.length <= this.tagMaxLength &&
      this.tags().length < this.maxTags &&
      !this.tags().includes(tag)
    );
  });

  /**
   * A private group cannot be found, so an open join policy on one is a
   * setting nobody can act on. Said out loud rather than silently corrected:
   * the owner may be about to flip the toggle next.
   */
  readonly joinPolicyNote = computed(() => {
    if (this.isPublic()) return '';
    if (this.joinPolicy() === JoinPolicies.InviteOnly) return '';
    return 'This group is private, so people can only join from a link or an invite.';
  });

  constructor() {
    addIcons(GROUP_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const groupId = params.get('groupId');
      if (groupId && groupId !== this._groupId()) {
        this._groupId.set(groupId);
        this._load(groupId);
      }
    });
  }

  ionViewWillEnter(): void {
    // Nothing: the form is loaded from the route, and re-reading it on entry
    // would throw away edits made before stepping into a sheet.
  }

  setJoinPolicy(value: string | number | undefined): void {
    const match = this.joinPolicyOptions.find((option) => option.value === value);
    if (match) this.joinPolicy.set(match.value);
  }

  setPostPolicy(value: string | number | undefined): void {
    const match = this.postPolicyOptions.find((option) => option.value === value);
    if (match) this.postPolicy.set(match.value);
  }

  addTag(): void {
    if (!this.canAddTag()) return;
    this.tags.update((list) => [...list, this.tagDraft().trim()]);
    this.tagDraft.set('');
  }

  removeTag(tag: string): void {
    this.tags.update((list) => list.filter((row) => row !== tag));
  }

  save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);

    const payload = {
      name: this.name().trim(),
      description: this.description().trim() || undefined,
      isPublic: this.isPublic(),
      joinPolicy: this.joinPolicy(),
      memberPostPolicy: this.postPolicy(),
      city: this.city().trim() || undefined,
      tags: this.tags().length > 0 ? this.tags() : undefined,
    };

    const request = this.isEdit()
      ? this._groupService.update(this._groupId(), payload)
      : this._groupService.create(payload);

    request.pipe(take(1), takeUntilDestroyed(this._destroyRef)).subscribe({
      next: (group) => {
        this.saving.set(false);
        this._groupsRefresh.notify();
        void this._feedbackService.success(this.isEdit() ? 'Group updated' : 'Group created');
        // Into the group either way: after a create there is nowhere else
        // sensible to land, and after an edit the changes are what you want
        // to see.
        void this._router.navigate(['/tabs/groups', group.id], { replaceUrl: true });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        void this._feedbackService.error(
          error,
          this.isEdit() ? 'Could not save those changes.' : 'Could not create that group.',
        );
      },
    });
  }

  confirmDelete(): void {
    this.deleteOpen.set(true);
  }

  deleteGroup(): void {
    if (this.deleting()) return;
    this.deleting.set(true);

    this._groupService
      .delete(this._groupId())
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.deleteOpen.set(false);
          this._groupsRefresh.notify();
          void this._feedbackService.success('Group deleted');
          void this._router.navigateByUrl('/tabs/groups', { replaceUrl: true });
        },
        error: (error: unknown) => {
          this.deleting.set(false);
          void this._feedbackService.error(error, 'Could not delete this group.');
        },
      });
  }

  retry(): void {
    const groupId = this._groupId();
    if (groupId) this._load(groupId);
  }

  private _load(groupId: string): void {
    this.loading.set(true);
    this.loadError.set(false);

    this._groupService
      .getById(groupId)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (group) => {
          this.name.set(group.name);
          this.description.set(group.description ?? '');
          this.isPublic.set(group.isPublic);
          this.joinPolicy.set(group.joinPolicy);
          this.postPolicy.set(group.memberPostPolicy);
          this.city.set(group.city ?? '');
          this.tags.set(group.tags ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
  }
}
