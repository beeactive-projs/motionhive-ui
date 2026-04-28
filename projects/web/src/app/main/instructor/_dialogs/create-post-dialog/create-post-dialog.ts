import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { MultiSelect } from 'primeng/multiselect';
import { Textarea } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import {
  AuthStore,
  CreatePostPayload,
  Group,
  GroupMemberPostPolicies,
  Post,
  PostService,
  showApiError,
} from 'core';

interface UploadEntry {
  url: string;
  publicId: string;
  fileName: string;
  status: 'uploading' | 'done' | 'failed';
  error?: string;
}

const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — matches the API limit.

@Component({
  selector: 'mh-create-post-dialog',
  imports: [FormsModule, Button, Dialog, MultiSelect, Textarea],
  templateUrl: './create-post-dialog.html',
  styleUrl: './create-post-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatePostDialog {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);
  private readonly _authStore = inject(AuthStore);

  readonly visible = model(false);
  readonly preselectedGroupId = input<string | undefined>(undefined);
  readonly userGroups = input.required<Group[]>();
  readonly saved = output<Post>();

  readonly content = signal('');
  readonly selectedGroupIds = signal<string[]>([]);
  readonly uploads = signal<UploadEntry[]>([]);
  readonly submitting = signal(false);

  /** Groups the user can post in: their own (any policy) + others where policy isn't DISABLED. */
  readonly postableGroups = computed(() => {
    const userId = this._authStore.user()?.id;
    return this.userGroups().filter(
      (g) =>
        g.instructorId === userId ||
        g.memberPostPolicy !== GroupMemberPostPolicies.Disabled,
    );
  });

  readonly anyUploading = computed(() =>
    this.uploads().some((u) => u.status === 'uploading'),
  );

  readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      !this.anyUploading() &&
      this.content().trim().length > 0 &&
      this.selectedGroupIds().length > 0,
  );

  private readonly _resetOnOpen = effect(() => {
    if (this.visible()) {
      this.content.set('');
      this.uploads.set([]);
      this.submitting.set(false);
      const preselect = this.preselectedGroupId();
      this.selectedGroupIds.set(preselect ? [preselect] : []);
    }
  });

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length) return;

    for (const file of files) {
      if (this.uploads().length >= MAX_IMAGES) {
        this._messageService.add({
          severity: 'warn',
          summary: 'Image limit reached',
          detail: `Up to ${MAX_IMAGES} images per post.`,
        });
        break;
      }
      if (!file.type.startsWith('image/')) {
        this._messageService.add({
          severity: 'warn',
          summary: 'Skipped file',
          detail: `${file.name}: not an image.`,
        });
        continue;
      }
      if (file.size > MAX_BYTES) {
        this._messageService.add({
          severity: 'warn',
          summary: 'Skipped file',
          detail: `${file.name}: larger than 5 MB.`,
        });
        continue;
      }
      this._upload(file);
    }
    // Allow re-selecting the same file later.
    input.value = '';
  }

  private _upload(file: File): void {
    const placeholder: UploadEntry = {
      url: '',
      publicId: '',
      fileName: file.name,
      status: 'uploading',
    };
    this.uploads.update((list) => [...list, placeholder]);
    this._postService.uploadImage(file).subscribe({
      next: (res) => {
        this.uploads.update((list) =>
          list.map((u) =>
            u === placeholder
              ? { ...u, url: res.url, publicId: res.publicId, status: 'done' }
              : u,
          ),
        );
      },
      error: (err) => {
        this.uploads.update((list) =>
          list.map((u) =>
            u === placeholder
              ? { ...u, status: 'failed', error: 'Upload failed' }
              : u,
          ),
        );
        showApiError(this._messageService, 'Image upload failed', file.name, err);
      },
    });
  }

  removeUpload(entry: UploadEntry): void {
    this.uploads.update((list) => list.filter((u) => u !== entry));
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    const payload: CreatePostPayload = {
      content: this.content().trim(),
      groupIds: this.selectedGroupIds(),
      mediaUrls: this.uploads()
        .filter((u) => u.status === 'done')
        .map((u) => u.url),
    };
    if (payload.mediaUrls?.length === 0) {
      delete payload.mediaUrls;
    }

    this._postService.createPost(payload).subscribe({
      next: (post) => {
        this.submitting.set(false);
        this.visible.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Post created',
          detail:
            payload.groupIds.length > 1
              ? `Shared with ${payload.groupIds.length} groups.`
              : 'Your post is live.',
        });
        this.saved.emit(post);
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(this._messageService, 'Could not create post', "", err);
      },
    });
  }

  cancel(): void {
    this.visible.set(false);
  }
}
