import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonDirective } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BLOG_CATEGORY_OPTIONS,
  BLOG_COVER_PRESETS,
  BlogCategory,
  BlogPost,
  BlogService,
  blogCategoryLabel,
  escapeHtml,
  TagSeverity,
  withCloudinaryTransform,
} from 'core';
import { SelectItem } from 'primeng/api';
import { ListEmptyState } from '../../../_shared/components/list-empty-state/list-empty-state';

@Component({
  selector: 'mh-posts',
  imports: [
    DatePipe,
    TableModule,
    ButtonDirective,
    TagModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    InputTextModule,
    ListEmptyState,
    TranslatePipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './posts.html',
  styleUrl: './posts.scss',
})
export class Posts implements OnInit {
  private readonly _blogService = inject(BlogService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);

  posts = signal<BlogPost[]>([]);
  totalRecords = signal(0);
  loading = signal(true);

  readonly rows = 10;
  currentPage = signal(1);
  searchQuery = signal('');
  categoryFilter = signal<BlogCategory | undefined>(undefined);

  readonly categoryOptions: SelectItem<BlogCategory | undefined>[] = [
    { label: this._translateService.instant('common.all'), value: undefined },
    ...BLOG_CATEGORY_OPTIONS.map((option) => ({
      ...option,
      label: this.categoryLabel(option.value),
    })),
  ];

  ngOnInit(): void {
    // this.loadPosts();
  }

  loadPosts(): void {
    this.loading.set(true);
    this._blogService
      .getPostsForAdmin({
        page: this.currentPage(),
        limit: this.rows,
        category: this.categoryFilter(),
        search: this.searchQuery() || undefined,
      })
      .subscribe({
        next: (response) => {
          this.posts.set(response.items);
          this.totalRecords.set(response.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this._messageService.add({
            severity: 'error',
            summary: this._translateService.instant('toast.summary.error'),
            detail: this._translateService.instant('writer.toast.loadListFailed'),
          });
        },
      });
  }

  onPageChange(event: { first?: number | null; rows?: number | null }): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows;
    this.currentPage.set(Math.floor(first / rows) + 1);
    this.loadPosts();
  }

  onCategoryFilterChange(value: BlogCategory | undefined): void {
    this.categoryFilter.set(value);
    this.currentPage.set(1);
    this.loadPosts();
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
    this.loadPosts();
  }

  navigateToNew(): void {
    this._router.navigate(['/writer/posts/new']);
  }

  navigateToEdit(post: BlogPost): void {
    this._router.navigate(['/writer/posts', post.id]);
  }

  confirmDelete(post: BlogPost): void {
    this._confirmationService.confirm({
      header: this._translateService.instant('writer.confirm.delete.header'),
      message: this._translateService.instant('writer.confirm.delete.message', {
        title: escapeHtml(post.title),
      }),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary',
      acceptLabel: this._translateService.instant('writer.confirm.delete.accept'),
      rejectLabel: this._translateService.instant('button.no'),
      acceptIcon: 'pi pi-trash',
      rejectIcon: 'pi pi-times',
      accept: () => this.deletePost(post),
    });
  }

  private deletePost(post: BlogPost): void {
    this._blogService.delete(post.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('writer.toast.deleted.summary'),
          detail: this._translateService.instant('writer.toast.deleted.detail', {
            title: post.title,
          }),
        });
        this.loadPosts();
      },
      error: () => {
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('writer.toast.deleteFailed'),
        });
      },
    });
  }

  publishedSeverity(isPublished: boolean): TagSeverity {
    return isPublished ? TagSeverity.Success : TagSeverity.Secondary;
  }

  categoryLabel(category: string | null | undefined): string {
    return blogCategoryLabel(category);
  }

  trackById = (_: number, item: { id: string }) => item.id;

  /** Pipe a Cloudinary cover URL through the list-thumb preset so we
   *  serve a 480px 16:9 image instead of the original full-size file. */
  thumbUrl(coverImage: string | null | undefined): string {
    return withCloudinaryTransform(coverImage, BLOG_COVER_PRESETS.listThumb);
  }
}
