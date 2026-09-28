import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  AuthStore,
  BLOG_CATEGORY_OPTIONS,
  BLOG_COVER_PRESETS,
  BLOG_LANGUAGE_OPTIONS,
  BlogCategory,
  BlogLanguage,
  BlogPost,
  BlogService,
  CreateBlogPostPayload,
  languageName,
  UserRoles,
  validationMessage,
  withCloudinaryTransform,
} from 'core';
import { MessageService } from 'primeng/api';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { Chip } from 'primeng/chip';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { Toast } from 'primeng/toast';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { EditorModule } from 'primeng/editor';

const SUGGESTED_TAGS = [
  'fitness', 'wellness', 'nutrition', 'workout', 'health',
  'strength', 'cardio', 'yoga', 'pilates', 'running',
  'mental health', 'recovery', 'stretching', 'mobility',
  'weight loss', 'muscle building', 'beginners', 'tips',
  'community', 'motivation', 'coaching', 'habits',
];

@Component({
  selector: 'mh-post-detail',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    Message,
    Card,
    ButtonDirective,
    InputText,
    TextareaModule,
    InputNumber,
    Select,
    Toast,
    ToggleSwitch,
    Tooltip,
    Chip,
    EditorModule,
    AutoComplete,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.scss',
})
export class PostDetail implements OnInit {
  private readonly _blogService = inject(BlogService);
  private readonly _messageService = inject(MessageService);
  private readonly _authStore = inject(AuthStore);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _translateService = inject(TranslateService);

  loading = signal(true);
  saving = signal(false);
  uploading = signal(false);
  showSlug = signal(false);

  private _postId = signal<string | null>(null);
  mode = computed<'create' | 'edit'>(() => (this._postId() ? 'edit' : 'create'));
  postTitle = signal('');

  private _slugTouched = false;

  formTagInput = '';
  formTags = signal<string[]>([]);
  filteredTagSuggestions = signal<string[]>([]);

  categorySuggestions = signal<string[]>([]);
  private readonly _allCategories = BLOG_CATEGORY_OPTIONS.map((o) => o.value as string);

  /** The language the post is written in (not the UI language): each
   *  option is labelled with the language's own name, values unchanged. */
  readonly languageOptions = BLOG_LANGUAGE_OPTIONS.map((option) => ({
    ...option,
    label: languageName(option.value),
  }));

  /**
   * Whether the current user can publish under a guest byline.
   * Admins / super-admins only — writers always publish under their
   * own user record. Mirrors the BE rule in blog.service.ts:create.
   */
  readonly canSetGuestByline = computed(() => {
    const roles = this._authStore.user()?.roles ?? [];
    return roles.includes(UserRoles.Admin) || roles.includes(UserRoles.SuperAdmin);
  });

  form = this._formBuilder.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    excerpt: ['', [Validators.required, Validators.maxLength(500)]],
    content: ['', [Validators.required]],
    category: ['' as string, [Validators.required]],
    language: [null as BlogLanguage | null, [Validators.required]],
    coverImage: ['', [Validators.required]],
    /**
     * Optional. Empty string = "publish under my own user" (BE uses
     * the JWT subject). Non-empty string = "publish as a guest" — the
     * BE rejects this with 403 if the caller is not an admin.
     */
    guestAuthorName: [''],
    readTime: [5, [Validators.required, Validators.min(1)]],
    isPublished: [false],
  });

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (id) {
      this.loadPost(id);
    } else {
      this.loading.set(false);
    }

    this.form.controls.title.valueChanges
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((title) => {
        if (!this._slugTouched && this.mode() === 'create') {
          this.form.controls.slug.setValue(this.generateSlug(title ?? ''), { emitEvent: false });
        }
      });
  }

  toggleSlug(): void {
    this.showSlug.update((v) => !v);
  }

  onSlugInput(): void {
    this._slugTouched = true;
  }

  onCategorySearch(event: AutoCompleteCompleteEvent): void {
    const query = (event.query ?? '').toLowerCase();
    this.categorySuggestions.set(
      this._allCategories.filter((c) => c.toLowerCase().includes(query)),
    );
  }

  onTagSearch(event: AutoCompleteCompleteEvent): void {
    const query = (event.query ?? '').toLowerCase();
    const existing = this.formTags();
    this.filteredTagSuggestions.set(
      SUGGESTED_TAGS.filter((t) => t.includes(query) && !existing.includes(t)),
    );
  }

  onTagSelect(event: { value: string }): void {
    const tag = (event.value ?? '').trim();
    if (tag && !this.formTags().includes(tag)) {
      this.formTags.update((tags) => [...tags, tag]);
    }
    this.formTagInput = '';
  }

  private loadPost(id: string): void {
    this._blogService.getForEdit(id).subscribe({
      next: (post) => {
        this._postId.set(post.id);
        this.postTitle.set(post.title);
        this.showSlug.set(true);
        this.patchForm(post);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const detail = this._translateService.instant(
          err?.status === 403 ? 'writer.toast.ownPostsOnly' : 'writer.toast.loadFailed',
        );
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail,
        });
      },
    });
  }

  private patchForm(post: BlogPost): void {
    this._slugTouched = true;
    this.form.patchValue({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      language: post.language,
      coverImage: post.coverImage,
      // Only populated for guest-authored posts (admin attribution).
      // Writers see this as empty when editing their own posts.
      guestAuthorName: post.guestAuthorName ?? '',
      readTime: post.readTime,
      isPublished: post.isPublished,
    });
    this.formTags.set(post.tags ?? []);
  }

  /**
   * Replace non-breaking spaces with regular spaces in pasted text.
   *
   * Pasting from Word / Google Docs / Pages produces U+00A0 (`&nbsp;`)
   * between every word, which makes the rendered post look like
   * `For&nbsp;many&nbsp;people&nbsp;…` in raw HTML and breaks normal
   * line-wrapping behaviour on narrow viewports. We normalise on
   * save — it's cheap, runs once, and matches the "long-form prose"
   * shape of every post we publish today (we don't have code blocks
   * where NBSP would be load-bearing).
   *
   * Both the literal U+00A0 character (what Quill stores after a
   * Word paste) and the `&nbsp;` entity (rare, but seen in some
   * paste sources) are folded to regular spaces.
   */
  private static normalizeWhitespace(value: string): string {
    return value.replace(/ /g, ' ').replace(/&nbsp;/g, ' ');
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const guestByline = raw.guestAuthorName?.trim();
    const payload: CreateBlogPostPayload = {
      title: PostDetail.normalizeWhitespace(raw.title!),
      slug: raw.slug!,
      excerpt: PostDetail.normalizeWhitespace(raw.excerpt!),
      content: PostDetail.normalizeWhitespace(raw.content!),
      category: raw.category! as BlogCategory,
      language: raw.language!,
      coverImage: raw.coverImage!,
      // Send only when admin actually entered a guest byline.
      // Otherwise omit so the BE attributes the post to the JWT user.
      ...(guestByline ? { guestAuthorName: guestByline } : {}),
      readTime: raw.readTime!,
      tags: this.formTags(),
      isPublished: raw.isPublished ?? false,
    };

    this.saving.set(true);
    const id = this._postId();

    const request$ = id ? this._blogService.update(id, payload) : this._blogService.create(payload);

    request$.subscribe({
      next: (post) => {
        this.saving.set(false);
        const toastKey = this.mode() === 'create' ? 'writer.toast.created' : 'writer.toast.updated';
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant(`${toastKey}.summary`),
          detail: this._translateService.instant(`${toastKey}.detail`),
        });
        if (this.mode() === 'create') {
          this._postId.set(post.id);
          this._router.navigate(['/writer/posts', post.id]);
        } else {
          this.postTitle.set(post.title);
        }
      },
      error: (err) => {
        this.saving.set(false);
        const detail = this._translateService.instant(
          err?.status === 403 ? 'writer.toast.ownPostsOnly' : 'writer.toast.saveFailed',
        );
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail,
        });
      },
    });
  }

  onImageUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this._blogService.uploadImage(file).subscribe({
      next: (response) => {
        this.form.controls.coverImage.setValue(response.url);
        this.uploading.set(false);
      },
      error: () => {
        this.uploading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('writer.toast.uploadFailed.summary'),
          detail: this._translateService.instant('writer.toast.uploadFailed.detail'),
        });
      },
    });
  }

  onTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addTag();
    }
  }

  addTag(): void {
    const tag = this.formTagInput.trim();
    if (!tag || this.formTags().includes(tag)) return;
    this.formTags.update((tags) => [...tags, tag]);
    this.formTagInput = '';
  }

  removeTag(tag: string): void {
    this.formTags.update((tags) => tags.filter((t) => t !== tag));
  }

  addSuggestedTag(tag: string): void {
    if (!this.formTags().includes(tag)) {
      this.formTags.update((tags) => [...tags, tag]);
    }
  }

  get availableSuggestions(): string[] {
    const existing = this.formTags();
    return SUGGESTED_TAGS.filter((t) => !existing.includes(t)).slice(0, 8);
  }

  goBack(): void {
    this._router.navigate(['/writer/posts']);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  getFieldError(field: string): string {
    return validationMessage(this.form.get(field)?.errors, {
      pattern: 'writer.postDetail.validation.slugPattern',
    });
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /** Editor preview — pipe Cloudinary URLs through the editor preset
   *  so the preview shows the cropped 16:9 the readers will see, not
   *  the writer's raw upload. Non-Cloudinary URLs pass through. */
  coverPreviewUrl(url: string | null | undefined): string {
    return withCloudinaryTransform(url, BLOG_COVER_PRESETS.editorPreview);
  }
}
