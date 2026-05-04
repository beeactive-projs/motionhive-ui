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
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  AuthStore,
  CreatePostPayload,
  Group,
  GroupMemberPostPolicies,
  Post,
  PostService,
  showApiError,
} from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { Textarea } from 'primeng/textarea';

interface UploadEntry {
  url: string;
  publicId: string;
  fileName: string;
  status: 'uploading' | 'done' | 'failed';
  error?: string;
}

type PostFormField = 'content' | 'groupIds';

const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_CONTENT = 5000;

const noWhitespaceValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = control.value as string | null | undefined;
  return value && value.trim().length > 0 ? null : { required: true };
};

const minSelectedValidator =
  (min: number): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown[] | null | undefined;
    return Array.isArray(value) && value.length >= min
      ? null
      : { minSelected: { requiredLength: min } };
  };

@Component({
  selector: 'mh-create-post-dialog',
  imports: [ReactiveFormsModule, Button, Dialog, Message, MultiSelect, Textarea],
  templateUrl: './create-post-dialog.html',
  styleUrl: './create-post-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatePostDialog {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);
  private readonly _authStore = inject(AuthStore);
  private readonly _formBuilder = inject(FormBuilder);

  readonly visible = model(false);
  readonly preselectedGroupId = input<string | undefined>(undefined);
  readonly userGroups = input.required<Group[]>();
  readonly saved = output<Post[]>();

  readonly maxContent = MAX_CONTENT;
  readonly maxImages = MAX_IMAGES;

  readonly form = this._formBuilder.nonNullable.group({
    content: ['', [noWhitespaceValidator, Validators.maxLength(MAX_CONTENT)]],
    groupIds: this._formBuilder.nonNullable.control<string[]>(
      [],
      minSelectedValidator(1),
    ),
  });

  readonly uploads = signal<UploadEntry[]>([]);
  readonly submitting = signal(false);

  private readonly _formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });
  private readonly _contentValue = toSignal(this.form.controls.content.valueChanges, {
    initialValue: this.form.controls.content.value,
  });

  readonly contentLength = computed(() => (this._contentValue() ?? '').length);

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
      !this.submitting() && !this.anyUploading() && this._formStatus() === 'VALID',
  );

  private readonly _resetOnOpen = effect(() => {
    if (this.visible()) {
      const preselect = this.preselectedGroupId();
      this.form.reset({
        content: '',
        groupIds: preselect ? [preselect] : [],
      });
      this.uploads.set([]);
      this.submitting.set(false);
    }
  });

  isFieldInvalid(field: PostFormField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  getFieldError(field: PostFormField): string {
    const errors = this.form.controls[field].errors;
    if (!errors) return '';
    if (field === 'content') {
      if (errors['required']) return 'Write something to share.';
      if (errors['maxlength']) return `Keep posts under ${MAX_CONTENT} characters.`;
    }
    if (field === 'groupIds' && (errors['minSelected'] || errors['required'])) {
      return 'Pick at least one group.';
    }
    return '';
  }

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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    const { content, groupIds } = this.form.getRawValue();
    const mediaUrls = this.uploads()
      .filter((u) => u.status === 'done')
      .map((u) => u.url);

    const payload: CreatePostPayload = {
      content: content.trim(),
      groupIds,
      ...(mediaUrls.length ? { mediaUrls } : {}),
    };

    this._postService.createPost(payload).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.visible.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Post created',
          detail:
            result.posts.length > 1
              ? `Shared with ${result.posts.length} groups.`
              : 'Your post is live.',
        });
        this.saved.emit(result.posts);
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(this._messageService, 'Could not create post', '', err);
      },
    });
  }

  cancel(): void {
    this.visible.set(false);
  }
}
