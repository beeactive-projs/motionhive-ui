import {
  ChangeDetectionStrategy,
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
import {
  BLOG_CATEGORY_OPTIONS,
  BLOG_LANGUAGE_OPTIONS,
  BlogCategories,
  BlogCategory,
  BlogLanguage,
  BlogLanguages,
  BlogPost,
  BlogService,
  CreateBlogPostPayload,
} from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Chip } from 'primeng/chip';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
import { EditorModule } from 'primeng/editor';

@Component({
  selector: 'mh-post-detail',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    Message,
    Card,
    Button,
    InputText,
    TextareaModule,
    InputNumber,
    Select,
    Toast,
    Tooltip,
    Chip,
    EditorModule,
  ],
  providers: [MessageService],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostDetail implements OnInit {
  private readonly _blogService = inject(BlogService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _destroyRef = inject(DestroyRef);

  loading = signal(true);
  saving = signal(false);
  uploading = signal(false);

  private _postId = signal<string | null>(null);
  mode = computed<'create' | 'edit'>(() => (this._postId() ? 'edit' : 'create'));
  postTitle = signal('New post');

  private _slugTouched = false;

  formTagInput = '';
  formTags = signal<string[]>([]);

  readonly categoryOptions = BLOG_CATEGORY_OPTIONS;
  readonly languageOptions =  BLOG_LANGUAGE_OPTIONS;

  form = this._formBuilder.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    excerpt: ['', [Validators.required, Validators.maxLength(500)]],
    content: ['', [Validators.required]],
    category: [null as BlogCategory | null, [Validators.required]],
    language: [null as BlogLanguage | null, [Validators.required]],
    coverImage: ['', [Validators.required]],
    authorName: ['', [Validators.required]],
    authorInitials: ['', [Validators.required, Validators.maxLength(3)]],
    authorRole: ['', [Validators.required]],
    readTime: [5, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    const slug = this._route.snapshot.paramMap.get('slug');
    if (slug) {
      // this._postId.set(slug);
      this.loadPost(slug);
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

  onSlugInput(): void {
    this._slugTouched = true;
  }

  private loadPost(slug: string): void {
    this._blogService.getBySlug(slug).subscribe({
      next: (post) => {
        this._postId.set(post.id);
        this.postTitle.set(post.title);
        this.patchForm(post);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load post',
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
      authorName: post.authorName,
      authorInitials: post.authorInitials,
      authorRole: post.authorRole,
      readTime: post.readTime,
    });
    this.formTags.set(post.tags ?? []);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CreateBlogPostPayload = {
      title: raw.title!,
      slug: raw.slug!,
      excerpt: raw.excerpt!,
      content: raw.content!,
      category: raw.category!,
      coverImage: raw.coverImage!,
      authorName: raw.authorName!,
      authorInitials: raw.authorInitials!,
      authorRole: raw.authorRole!,
      readTime: raw.readTime!,
      tags: this.formTags(),
    };

    this.saving.set(true);
    const id = this._postId();

    const request$ = id ? this._blogService.update(id, payload) : this._blogService.create(payload);

    request$.subscribe({
      next: (post) => {
        this.saving.set(false);
        this._messageService.add({
          severity: 'success',
          summary: this.mode() === 'create' ? 'Post created' : 'Post updated',
          detail:
            this.mode() === 'create'
              ? 'Your post has been created successfully'
              : 'Your post has been updated successfully',
        });
        if (this.mode() === 'create') {
          this._router.navigate(['/writer/posts', post.id]);
        } else {
          this.postTitle.set(post.title);
          this._postId.set(post.id);
        }
      },
      error: () => {
        this.saving.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save post',
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
          summary: 'Upload failed',
          detail: 'Failed to upload image',
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

  goBack(): void {
    this._router.navigate(['/writer/posts']);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  getFieldError(field: string): string {
    const control = this.form.get(field);
    if (!control?.errors) return '';
    if (control.errors['required']) return 'This field is required.';
    if (control.errors['minlength'])
      return `Minimum ${control.errors['minlength'].requiredLength} characters required.`;
    if (control.errors['maxlength'])
      return `Maximum ${control.errors['maxlength'].requiredLength} characters allowed.`;
    if (control.errors['min']) return `Minimum value is ${control.errors['min'].min}.`;
    if (control.errors['pattern']) return 'Use lowercase letters, numbers, and hyphens only.';
    return 'Invalid value.';
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
