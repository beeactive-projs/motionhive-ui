import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { GalleriaModule } from 'primeng/galleria';
import { MessageService } from 'primeng/api';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Toast } from 'primeng/toast';
import { Post, PostService, showApiError } from 'core';
import { PostHeader } from '../main/groups/group-detail/_components/post-header/post-header';
import { PostReactionBar } from '../main/groups/group-detail/_components/post-reaction-bar/post-reaction-bar';
import { PostCommentList } from '../main/groups/group-detail/_components/post-comment-list/post-comment-list';

interface GalleriaItem {
  itemImageSrc: string;
  alt: string;
}

@Component({
  selector: 'mh-photo-viewer',
  imports: [
    Button,
    GalleriaModule,
    ProgressSpinner,
    Toast,
    PostHeader,
    PostReactionBar,
    PostCommentList,
  ],
  providers: [MessageService],
  templateUrl: './photo-viewer.html',
  styleUrl: './photo-viewer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'photo-viewer-host',
    '(document:keydown.escape)': 'close()',
  },
})
export class PhotoViewer {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);
  private readonly _postService = inject(PostService);
  private readonly _messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly post = signal<Post | null>(null);
  readonly currentIndex = signal(0);

  readonly images = computed<GalleriaItem[]>(() =>
    (this.post()?.mediaUrls ?? []).map((src, i) => ({
      itemImageSrc: src,
      alt: `Photo ${i + 1}`,
    })),
  );

  readonly hasMultiple = computed(() => this.images().length > 1);

  readonly responsiveOptions = [
    { breakpoint: '768px', numVisible: 3 },
    { breakpoint: '480px', numVisible: 1 },
  ];

  // Set after the initial route param is consumed, so the index→URL effect
  // doesn't fire on first render and create a redundant navigation.
  private _seeded = false;

  private readonly _syncIndexToUrl = effect(() => {
    const idx = this.currentIndex();
    if (!this._seeded) return;
    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { index: idx },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  constructor() {
    const postId = this._route.snapshot.paramMap.get('postId');
    const rawIndex = Number(this._route.snapshot.queryParamMap.get('index') ?? 0);
    const seedIndex = Number.isFinite(rawIndex) && rawIndex >= 0 ? Math.floor(rawIndex) : 0;

    if (!postId) {
      this.loading.set(false);
      this.error.set('Photo not found.');
      return;
    }

    this._postService.getPostById(postId).subscribe({
      next: (p) => {
        this.post.set(p);
        const max = (p.mediaUrls?.length ?? 1) - 1;
        const clamped = Math.min(Math.max(0, seedIndex), Math.max(0, max));
        this.currentIndex.set(clamped);
        this.loading.set(false);
        this._seeded = true;
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set('Could not load this photo.');
        showApiError(this._messageService, 'Could not load photo', '', err);
      },
    });
  }

  close(): void {
    if (history.length > 1) {
      this._location.back();
    } else {
      this._router.navigate(['/']);
    }
  }
}
