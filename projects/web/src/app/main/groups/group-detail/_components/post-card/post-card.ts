import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { Button } from 'primeng/button';
import { Post } from 'core';
import { PostReactionBar } from '../post-reaction-bar/post-reaction-bar';
import { PostCommentList } from '../post-comment-list/post-comment-list';
import { PostHeader } from '../post-header/post-header';

@Component({
  selector: 'mh-post-card',
  imports: [
    CardModule,
    Button,
    PostHeader,
    PostReactionBar,
    PostCommentList,
  ],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCard {
  private readonly _router = inject(Router);

  readonly post = input.required<Post>();
  /** True when the viewer is OWNER/MODERATOR of the *current* group context. */
  readonly canModerate = input<boolean>(false);
  /**
   * When true, render a "posted in <group name>" badge above the author
   * line using `post().group`. The aggregated feed (`/groups/feed`) sets
   * this; the per-group feed leaves it off because the group is implicit
   * in the URL.
   */
  readonly showGroupBadge = input<boolean>(false);
  readonly deleteRequested = output<Post>();
  readonly editRequested = output<Post>();

  readonly showComments = signal(false);
  readonly contentExpanded = signal(false);

  /**
   * Soft cap on visible content lines before truncating with a
   * "Read more" toggle. Posts with images get a tighter clamp so the
   * gallery stays prominent above the fold.
   */
  readonly contentClampLines = computed(() =>
    this.hasImages() ? 2 : 10,
  );

  /**
   * Heuristic for "is the content long enough that we should bother
   * clamping?". Avoids rendering the toggle on a one-line post.
   *
   * Kicks in when the content has more newlines than the clamp allows,
   * OR when it's long enough that line-wrapping is likely to push past
   * the clamp at typical viewport widths (~80 chars per line).
   */
  readonly isContentLong = computed(() => {
    const content = this.post().content ?? '';
    const newlines = (content.match(/\n/g) ?? []).length;
    const limit = this.contentClampLines();
    if (newlines >= limit) return true;
    return content.length > limit * 80;
  });

  hasImages(): boolean {
    return (this.post().mediaUrls?.length ?? 0) > 0;
  }

  toggleContent(): void {
    this.contentExpanded.update((v) => !v);
  }

  toggleComments(): void {
    this.showComments.update((v) => !v);
  }

  // Image grid display: max 4, with "+N" overlay on the 4th if more.
  visibleImages(): string[] {
    const list = this.post().mediaUrls ?? [];
    return list.slice(0, 4);
  }

  extraImageCount(): number {
    const total = this.post().mediaUrls?.length ?? 0;
    return total > 4 ? total - 4 : 0;
  }

  openPhoto(index: number): void {
    this._router.navigate(['/photo', this.post().id], {
      queryParams: { index },
    });
  }
}
