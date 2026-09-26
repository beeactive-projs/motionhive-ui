import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
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
  IonNote,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { forkJoin, of, switchMap, take } from 'rxjs';

import { GroupService, GroupWithMyRole, GroupsRefreshService, PostService } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import {
  IMAGE_MAX_BYTES,
  POST_MAX_IMAGES,
  POST_MAX_LENGTH,
  isPostingBlockedError,
  postNeedsApproval,
} from '../groups.config';
import { GROUP_ICONS } from '../groups.icons';

/** A picked image: the local preview, and the URL once it has uploaded. */
interface PendingImage {
  file: File;
  /** Object URL for the thumbnail. Revoked when the image is dropped. */
  previewUrl: string;
}

/**
 * Writing a post.
 *
 * A full screen rather than a sheet: a post is the longest thing anyone
 * types in this app, and a sheet over the feed would put the keyboard on top
 * of the thing being written.
 *
 * Images upload on submit, not on pick. Uploading eagerly would leave
 * orphaned files on Cloudinary every time someone changed their mind, and
 * there is no endpoint to clean those up.
 */
@Component({
  selector: 'mh-post-compose',
  imports: [
    EmptyState,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonNote,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './post-compose.html',
  styleUrl: './post-compose.scss',
})
export class PostCompose {
  private readonly _postService = inject(PostService);
  private readonly _groupService = inject(GroupService);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly maxLength = POST_MAX_LENGTH;
  readonly maxImages = POST_MAX_IMAGES;
  /** Same list the avatar picker uses; the upload route rejects the rest. */
  readonly accept = 'image/png,image/jpeg,image/webp';

  private readonly _groupId = signal('');
  private readonly _group = signal<GroupWithMyRole | null>(null);
  readonly loadError = signal(false);

  readonly content = signal('');
  readonly images = signal<PendingImage[]>([]);
  readonly submitting = signal(false);

  readonly groupName = computed(() => this._group()?.name ?? '');

  readonly canAddImage = computed(() => this.images().length < this.maxImages);

  readonly canSubmit = computed(
    () =>
      this.content().trim().length > 0 &&
      this.content().length <= this.maxLength &&
      !this.submitting(),
  );

  readonly remaining = computed(() => this.maxLength - this.content().length);
  readonly showRemaining = computed(() => this.remaining() <= 500);

  /**
   * Whether this person's post will wait for review. Worth saying before
   * they write it, not after: the API returns success either way and only
   * `approvalState` on the response tells them apart.
   */
  readonly needsApproval = computed(() => {
    const group = this._group();
    return !!group && postNeedsApproval(group.myRole, group);
  });

  constructor() {
    addIcons(GROUP_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const groupId = params.get('groupId');
      if (groupId && groupId !== this._groupId()) {
        this._groupId.set(groupId);
        this._loadGroup(groupId);
      }
    });

    // Object URLs outlive the component unless revoked, and a composer
    // opened repeatedly with photos would leak every one of them.
    this._destroyRef.onDestroy(() => {
      for (const image of this.images()) URL.revokeObjectURL(image.previewUrl);
    });
  }

  onContent(value: string): void {
    this.content.set(value);
  }

  pickImage(): void {
    this._fileInput()?.nativeElement.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    // Reset first, so picking the same file twice still fires `change`.
    input.value = '';

    for (const file of files) {
      if (!this.canAddImage()) {
        void this._feedbackService.error(null, `You can add up to ${this.maxImages} photos.`);
        return;
      }
      if (file.size > IMAGE_MAX_BYTES) {
        void this._feedbackService.error(null, `${file.name} is larger than 5 MB.`);
        continue;
      }
      // Picking the same photo twice is a mis-tap, not an instruction to
      // post it twice — and it would upload twice on submit. Name and size
      // together, because two different photos can share a name.
      if (this._alreadyPicked(file)) continue;

      this.images.update((list) => [
        ...list,
        { file, previewUrl: URL.createObjectURL(file) },
      ]);
    }
  }

  private _alreadyPicked(file: File): boolean {
    return this.images().some(
      (image) =>
        image.file.name === file.name &&
        image.file.size === file.size &&
        image.file.lastModified === file.lastModified,
    );
  }

  removeImage(image: PendingImage): void {
    URL.revokeObjectURL(image.previewUrl);
    this.images.update((list) => list.filter((row) => row !== image));
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);

    const pending = this.images();
    // Uploads first, then the post — a post that referenced a failed upload
    // would render a broken image nobody can fix.
    const uploads = pending.length
      ? forkJoin(pending.map((image) => this._postService.uploadImage(image.file)))
      : of([]);

    uploads
      .pipe(
        switchMap((results) =>
          this._postService.createPost({
            content: this.content().trim(),
            groupIds: [this._groupId()],
            ...(results.length ? { mediaUrls: results.map((r) => r.url) } : {}),
          }),
        ),
        take(1),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          // The group we are returning to is holding a feed without this
          // post in it, and it was fetched seconds ago — so its freshness
          // window would otherwise keep it.
          this._groupsRefresh.notify();
          void this._feedbackService.success(
            this.needsApproval() ? 'Post sent for review' : 'Posted',
          );
          void this._router.navigate(['/tabs/groups', this._groupId()], { replaceUrl: true });
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const message = (error as { error?: { message?: string } } | null)?.error?.message ?? '';
          // Two API messages interpolate a raw group id, so they cannot be
          // matched by equality — and both mean the same thing to a reader.
          void this._feedbackService.error(
            error,
            isPostingBlockedError(message)
              ? 'You can no longer post in this group.'
              : 'Could not publish that post.',
          );
        },
      });
  }

  retry(): void {
    const groupId = this._groupId();
    if (groupId) this._loadGroup(groupId);
  }

  private _loadGroup(groupId: string): void {
    this.loadError.set(false);
    this._groupService
      .getById(groupId)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (group) => this._group.set(group),
        error: () => this.loadError.set(true),
      });
  }
}
