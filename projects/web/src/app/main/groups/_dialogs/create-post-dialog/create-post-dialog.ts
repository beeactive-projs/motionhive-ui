import {
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  AuthStore,
  CreatePostPayload,
  Group,
  GroupMemberPostPolicies,
  Post,
  PostService,
  noWhitespaceValidator,
  showApiError,
  validationMessage,
} from 'core';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
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
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    Dialog,
    Message,
    MultiSelect,
    Textarea,
    TranslatePipe,
  ],
  templateUrl: './create-post-dialog.html',
  styleUrl: './create-post-dialog.scss',
})
export class CreatePostDialog {
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);
  private readonly _authStore = inject(AuthStore);
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model(false);
  readonly preselectedGroupId = input<string | undefined>(undefined);
  readonly userGroups = input.required<Group[]>();
  readonly saved = output<Post[]>();
  /** When set, the dialog edits this post (content + images) instead of creating one. */
  readonly post = input<Post | null>(null);

  readonly editMode = computed(() => !!this.post());

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
      const editing = this.post();
      if (editing) {
        // Edit mode: prefill content + existing images; the group is fixed.
        this.form.reset({
          content: editing.content,
          groupIds: [editing.groupId],
        });
        this.uploads.set(
          (editing.mediaUrls ?? []).map((url) => ({
            url,
            publicId: '',
            fileName: '',
            status: 'done' as const,
          })),
        );
      } else {
        const preselect = this.preselectedGroupId();
        this.form.reset({
          content: '',
          groupIds: preselect ? [preselect] : [],
        });
        this.uploads.set([]);
      }
      this.submitting.set(false);
    }
  });

  isFieldInvalid(field: PostFormField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  getFieldError(field: PostFormField): string {
    const errors = this.form.controls[field].errors;
    if (field === 'content') {
      return validationMessage(errors, {
        required: 'groups.postDialog.validation.contentRequired',
        maxlength: 'groups.postDialog.validation.contentTooLong',
      });
    }
    return validationMessage(errors, {
      required: 'groups.postDialog.validation.groupsRequired',
      minSelected: 'groups.postDialog.validation.groupsRequired',
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length) return;

    for (const file of files) {
      if (this.uploads().length >= MAX_IMAGES) {
        this._messageService.add({
          severity: 'warn',
          summary: this._translateService.instant('groups.toast.imageLimit.summary'),
          detail: this._translateService.instant('groups.toast.imageLimit.detail', { max: MAX_IMAGES }),
        });
        break;
      }
      if (!file.type.startsWith('image/')) {
        this._messageService.add({
          severity: 'warn',
          summary: this._translateService.instant('groups.toast.skippedFile.summary'),
          detail: this._translateService.instant('groups.toast.skippedFile.notImage', { name: file.name }),
        });
        continue;
      }
      if (file.size > MAX_BYTES) {
        this._messageService.add({
          severity: 'warn',
          summary: this._translateService.instant('groups.toast.skippedFile.summary'),
          detail: this._translateService.instant('groups.toast.skippedFile.tooLarge', { name: file.name }),
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
        showApiError(
          this._messageService,
          this._translateService.instant('groups.toast.imageUploadFailed'),
          file.name,
          err,
        );
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

    // ── Edit mode: PATCH the single post, emit the updated row ──
    const editing = this.post();
    if (editing) {
      this._postService
        .updatePost(editing.id, { content: content.trim(), mediaUrls })
        .subscribe({
          next: (updated) => {
            this.submitting.set(false);
            this.visible.set(false);
            this._messageService.add({
              severity: 'success',
              summary: this._translateService.instant('groups.toast.postUpdated.summary'),
              detail: this._translateService.instant('groups.toast.postUpdated.detail'),
            });
            this.saved.emit([updated]);
          },
          error: (err) => {
            this.submitting.set(false);
            showApiError(
              this._messageService,
              this._translateService.instant('groups.toast.postUpdateFailed'),
              '',
              err,
            );
          },
        });
      return;
    }

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
          summary: this._translateService.instant('groups.toast.postCreated.summary'),
          detail:
            result.posts.length > 1
              ? this._translateService.instant('groups.toast.postCreated.detailShared', {
                  count: result.posts.length,
                })
              : this._translateService.instant('groups.toast.postCreated.detail'),
        });
        this.saved.emit(result.posts);
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('groups.toast.postCreateFailed'),
          '',
          err,
        );
      },
    });
  }

  cancel(): void {
    this.visible.set(false);
  }
}
