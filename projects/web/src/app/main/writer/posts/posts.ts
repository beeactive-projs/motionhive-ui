import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService, ConfirmationService } from 'primeng/api';
import { BlogService, BlogPost, BlogCategory, TagSeverity, BLOG_CATEGORY_OPTIONS } from 'core';
import { SelectItem } from 'primeng/api';

@Component({
  selector: 'mh-posts',
  imports: [
    DatePipe,
    TableModule,
    ButtonModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    InputTextModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './posts.html',
  styleUrl: './posts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Posts implements OnInit {
  private readonly _blogService = inject(BlogService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _router = inject(Router);

  posts = signal<BlogPost[]>([]);
  totalRecords = signal(0);
  loading = signal(true);

  readonly rows = 10;
  currentPage = signal(1);
  searchQuery = signal('');
  categoryFilter = signal<BlogCategory | undefined>(undefined);

  readonly categoryOptions: SelectItem<BlogCategory | undefined>[] = [
    { label: 'All', value: undefined },
    ...BLOG_CATEGORY_OPTIONS,
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
            summary: 'Error',
            detail: 'Failed to load posts',
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
      header: 'Delete post',
      message: `Are you sure you want to delete "${post.title}"? This action cannot be undone.`,
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary',
      acceptLabel: 'Yes, delete',
      rejectLabel: 'No',
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
          summary: 'Post deleted',
          detail: `"${post.title}" has been deleted`,
        });
        this.loadPosts();
      },
      error: () => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete post',
        });
      },
    });
  }

  publishedSeverity(isPublished: boolean): TagSeverity {
    return isPublished ? TagSeverity.Success : TagSeverity.Secondary;
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
