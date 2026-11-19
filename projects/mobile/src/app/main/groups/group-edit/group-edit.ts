import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
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
  IonRouterOutlet,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  CategoryStore,
  GroupMemberPostPolicies,
  GroupMemberPostPolicy,
  GroupService,
  GroupsRefreshService,
  JoinPolicies,
  JoinPolicy,
} from 'core';

import { ChipInput } from '../../../_shared/components/chip-input/chip-input';
import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { ACTIVITY_ICONS, categoryIcon } from '../../../_shared/config/category-icons.config';
import { KeyboardFooterDirective } from '../../../_shared/directives/keyboard-footer.directive';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { toggleValue } from '../../../_shared/utils/list.utils';
import { groupLinks } from '../../../_shared/utils/stack-paths';
import {
  GROUP_DESCRIPTION_MAX_LENGTH,
  canManageGroup,
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
 * What the group trains is picked from MotionHive's category list, the
 * same one coaches and people pick from: Discover's topics find the group
 * by it, on the server. Tags stay the owner's own words.
 *
 * Delete sits last and red, after everything else, because it is the one
 * action here that cannot be walked back.
 */
@Component({
  selector: 'mh-group-edit',
  imports: [
    ChipInput,
    ConfirmSheet,
    EmptyState,
    IonBackButton,
    IonButton,
    IonButtons,
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
    KeyboardFooterDirective,
    TranslatePipe,
  ],
  templateUrl: './group-edit.html',
  styleUrl: './group-edit.scss',
})
export class GroupEdit implements ViewWillEnter {
  private readonly _groupService = inject(GroupService);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _outlet = inject(IonRouterOutlet);
  /** The stack the group was opened in: the Groups tab, or a profile's. */
  private readonly _links = groupLinks(this._router.url);
  readonly backHref = this._links.home;
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);
  readonly categoryStore = inject(CategoryStore);

  readonly joinPolicyOptions = JOIN_POLICY_OPTIONS;
  readonly postPolicyOptions = POST_POLICY_OPTIONS;
  readonly nameMaxLength = GROUP_NAME_MAX_LENGTH;
  readonly descriptionMaxLength = GROUP_DESCRIPTION_MAX_LENGTH;
  readonly maxTags = GROUP_MAX_TAGS;
  readonly tagMaxLength = GROUP_TAG_MAX_LENGTH;

  /** Set when editing; empty when creating. */
  private readonly _groupId = signal('');

  readonly isEdit = computed(() => !!this._groupId());
  /** Translation keys — the template translates. */
  readonly headingKey = computed(() =>
    this.isEdit() ? 'groups.edit.heading.edit' : 'groups.edit.heading.create',
  );
  readonly saveLabelKey = computed(() =>
    this.isEdit() ? 'button.saveChanges' : 'groups.edit.saveCreate',
  );

  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly saving = signal(false);

  /**
   * Set when the group loaded but this viewer does not own it.
   *
   * `GET /groups/:id` answers any member with 200, so the form would
   * populate for someone whose save is going to 403 — Delete button and
   * all. Only `PATCH` and `DELETE` are owner-gated on the server.
   */
  readonly notAllowed = signal(false);

  readonly name = signal('');
  readonly description = signal('');
  readonly isPublic = signal(false);
  readonly joinPolicy = signal<JoinPolicy>(JoinPolicies.InviteOnly);
  readonly postPolicy = signal<GroupMemberPostPolicy>(GroupMemberPostPolicies.Open);
  readonly city = signal('');
  readonly tags = signal<string[]>([]);
  /** Activity ids from the category list. */
  readonly categoryIds = signal<string[]>([]);

  private readonly _tagInput = viewChild(ChipInput);
  private readonly _keyboard = viewChild(KeyboardFooterDirective);

  readonly deleteOpen = signal(false);
  readonly deleting = signal(false);

  readonly canSave = computed(
    () => this.name().trim().length > 0 && !this.saving() && !this.loading(),
  );

  /**
   * A private group cannot be found, so an open join policy on one is a
   * setting nobody can act on. Said out loud rather than silently corrected:
   * the owner may be about to flip the toggle next. A translation key, or
   * empty when there is nothing to say.
   */
  readonly joinPolicyNoteKey = computed(() => {
    if (this.isPublic()) return '';
    if (this.joinPolicy() === JoinPolicies.InviteOnly) return '';
    return 'groups.edit.privateNote';
  });

  constructor() {
    addIcons(GROUP_ICONS);
    addIcons(ACTIVITY_ICONS);
    this.categoryStore.ensureLoaded();

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

  hasCategory(id: string): boolean {
    return this.categoryIds().includes(id);
  }

  toggleCategory(id: string): void {
    this.categoryIds.update((ids) => toggleValue(ids, id));
  }

  categoryIcon(name: string): string {
    return categoryIcon(name);
  }

  retryCategories(): void {
    this.categoryStore.ensureLoaded();
  }

  save(): void {
    if (!this.canSave()) {
      return;
    }
    const keyboard = this._keyboard();
    if (keyboard) {
      keyboard.dismiss();
    }
    // A tag typed and not yet added goes in with the rest; one that cannot
    // (too long, no room) stays in the field with the line saying why.
    const tagInput = this._tagInput();
    if (tagInput && !tagInput.commit()) {
      return;
    }
    this.saving.set(true);

    const payload = {
      name: this.name().trim(),
      description: this.description().trim() || undefined,
      isPublic: this.isPublic(),
      joinPolicy: this.joinPolicy(),
      memberPostPolicy: this.postPolicy(),
      city: this.city().trim() || undefined,
      tags: this.tags().length > 0 ? this.tags() : undefined,
      // Always sent: on an edit, an emptied pick clears what was there.
      categoryIds: this.categoryIds(),
    };

    const request = this.isEdit()
      ? this._groupService.update(this._groupId(), payload)
      : this._groupService.create(payload);

    request.pipe(take(1), takeUntilDestroyed(this._destroyRef)).subscribe({
      next: (group) => {
        this.saving.set(false);
        this._groupsRefresh.notify();
        void this._feedbackService.success(
          this._translateService.instant(
            this.isEdit() ? 'groups.edit.toast.updated' : 'groups.edit.toast.created',
          ),
        );
        // Into the group either way: after a create there is nowhere else
        // sensible to land, and after an edit the changes are what you want
        // to see.
        void this._router.navigate(this._links.group(group.id), { replaceUrl: true });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant(
            this.isEdit() ? 'groups.edit.toast.saveFailed' : 'groups.edit.toast.createFailed',
          ),
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
          void this._feedbackService.success(
            this._translateService.instant('groups.edit.toast.deleted'),
          );
          // Past the deleted group: to the list on the Groups tab, and
          // elsewhere back to whoever opened it.
          if (!this._links.inGroupsTab && this._outlet.canGoBack(2)) void this._outlet.pop(2);
          else void this._router.navigateByUrl(this._links.home, { replaceUrl: true });
        },
        error: (error: unknown) => {
          this.deleting.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('groups.edit.toast.deleteFailed'),
          );
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
          if (!canManageGroup(group.myRole)) {
            this.notAllowed.set(true);
            this.loading.set(false);
            return;
          }
          this.name.set(group.name);
          this.description.set(group.description ?? '');
          this.isPublic.set(group.isPublic);
          this.joinPolicy.set(group.joinPolicy);
          this.postPolicy.set(group.memberPostPolicy);
          this.city.set(group.city ?? '');
          this.tags.set(group.tags ?? []);
          this.categoryIds.set(group.categoryIds ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
  }
}
