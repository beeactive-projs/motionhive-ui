import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { AuthStore, Post, PostComment, displayName, formatRelativeShort } from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import {
  COMMENT_MAX_LENGTH,
  POST_MAX_LENGTH,
  canDeleteComment,
  canDeletePost,
  canEditPost,
} from '../groups.config';
import { GROUP_ICONS } from '../groups.icons';
import { PostDetailStore } from './post-detail.store';

/**
 * One post, its comments, and the box to add one.
 *
 * Comments nest a single level. A reply always targets the thread root, not
 * the comment tapped, because the API rejects a reply to a reply — so
 * replying to someone inside a thread puts the new row at the end of that
 * same thread rather than starting a third level.
 */
@Component({
  selector: 'mh-post-detail',
  imports: [
    ConfirmSheet,
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTextarea,
    IonTitle,
    IonToolbar,
    SheetShell,
  ],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.scss',
  providers: [PostDetailStore],
})
export class PostDetail implements ViewWillEnter {
  readonly store = inject(PostDetailStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _auth = inject(AuthStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly maxLength = COMMENT_MAX_LENGTH;
  readonly skeletonRows = [1, 2, 3];

  readonly draft = signal('');
  readonly sending = signal(false);

  /**
   * The thread the composer is replying into, or null for a new thread.
   *
   * Holds the *root* id and the name of whoever was tapped — those differ
   * when replying to a reply, and the name is what the viewer expects to see
   * even though the row lands under the root.
   */
  readonly replyingTo = signal<{ rootId: string; name: string } | null>(null);

  readonly deleteCommentOpen = signal(false);
  readonly commentBeingDeleted = signal<PostComment | null>(null);
  readonly deletingComment = signal(false);

  readonly deletePostOpen = signal(false);
  readonly deletingPost = signal(false);

  private readonly _viewerId = computed(() => this._auth.user()?.id ?? '');

  /**
   * The group's own role is not on a post, and this screen is reached from a
   * notification as often as from the group — so there is nothing to ask.
   * Authorship is what this page can answer, and the API is the real gate:
   * staff moderating from here still get their delete, it just is not
   * offered up front.
   */
  private readonly _authorOnlyRole = null;

  readonly canDeleteThisPost = computed(() => {
    const post = this.store.post();
    return !!post && canDeletePost(this._authorOnlyRole, this._viewerId(), post.authorId);
  });

  /** Edit is the author's alone — staff may delete, never rewrite. */
  readonly canEditThisPost = computed(() => {
    const post = this.store.post();
    return !!post && canEditPost(this._viewerId(), post.authorId);
  });

  readonly postMaxLength = POST_MAX_LENGTH;
  readonly editOpen = signal(false);
  readonly editDraft = signal('');
  readonly savingEdit = signal(false);

  readonly canSaveEdit = computed(() => {
    const draft = this.editDraft().trim();
    return (
      draft.length > 0 &&
      draft.length <= this.postMaxLength &&
      draft !== (this.store.post()?.content ?? '').trim() &&
      !this.savingEdit()
    );
  });

  readonly canSend = computed(
    () => this.draft().trim().length > 0 && this.draft().length <= this.maxLength && !this.sending(),
  );

  readonly remaining = computed(() => this.maxLength - this.draft().length);

  /** Only worth showing as the limit comes into view. */
  readonly showRemaining = computed(() => this.remaining() <= 200);

  readonly commentCountLabel = computed(() => {
    const count = this.store.commentCount();
    return `${count} ${count === 1 ? 'comment' : 'comments'}`;
  });

  readonly composerPlaceholder = computed(() => {
    const target = this.replyingTo();
    return target ? `Reply to ${target.name}` : 'Add a comment';
  });

  constructor() {
    addIcons(GROUP_ICONS);

    // Via the param stream rather than a snapshot: Ionic reuses this page,
    // so opening a second post has to re-init rather than keep showing the
    // first. The store ignores a repeat of the id it already holds.
    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const postId = params.get('postId');
      if (postId) this.store.init(postId);
    });
  }

  ionViewWillEnter(): void {
    this.store.refresh();
  }

  // ── Display helpers ────────────────────────────────────────────────────

  authorName(row: Post | PostComment): string {
    return row.author ? displayName(row.author, 'Member') : 'Member';
  }

  avatarUrl(row: Post | PostComment): string | null {
    return row.author?.avatarUrl ?? null;
  }

  postedAt(iso: string): string {
    return formatRelativeShort(iso);
  }

  /**
   * A profile is addressed by handle, and an account can still be without
   * one — so a name is only a link when there is somewhere to go.
   */
  hasProfile(row: Post | PostComment): boolean {
    return !!row.author?.handle;
  }

  openProfile(row: Post | PostComment): void {
    const handle = row.author?.handle;
    if (!handle) return;
    void this._router.navigate(['/tabs/u', handle]);
  }

  mayDeleteComment(comment: PostComment): boolean {
    return canDeleteComment(this._authorOnlyRole, this._viewerId(), comment.authorId);
  }

  // ── Composing ──────────────────────────────────────────────────────────

  onDraft(value: string): void {
    this.draft.set(value);
  }

  /**
   * Start a reply. `root` is the thread this belongs to and `tapped` is who
   * the viewer answered — the same row for a top-level comment, different
   * when they replied to a reply.
   */
  replyTo(root: PostComment, tapped: PostComment = root): void {
    this.replyingTo.set({ rootId: root.id, name: this.authorName(tapped) });
  }

  cancelReply(): void {
    this.replyingTo.set(null);
  }

  send(): void {
    if (!this.canSend()) return;
    const content = this.draft().trim();
    const target = this.replyingTo();

    this.sending.set(true);
    this.store.addComment(content, target?.rootId).subscribe({
      next: () => {
        this.sending.set(false);
        // Cleared only once it landed: a failed send that ate the text is
        // worse than one that leaves it there to retry.
        this.draft.set('');
        this.replyingTo.set(null);
      },
      error: (error: unknown) => {
        this.sending.set(false);
        void this._feedbackService.error(error, 'Could not post that comment.');
      },
    });
  }

  // ── Verbs ──────────────────────────────────────────────────────────────

  like(): void {
    this.store.toggleReaction().subscribe({
      error: (error: unknown) =>
        void this._feedbackService.error(error, 'Could not save that reaction.'),
    });
  }

  confirmDeleteComment(comment: PostComment): void {
    this.commentBeingDeleted.set(comment);
    this.deleteCommentOpen.set(true);
  }

  deleteComment(): void {
    const comment = this.commentBeingDeleted();
    if (!comment || this.deletingComment()) return;

    this.deletingComment.set(true);
    this.store.deleteComment(comment.id).subscribe({
      next: () => {
        this.deletingComment.set(false);
        this.deleteCommentOpen.set(false);
        void this._feedbackService.success('Comment deleted');
      },
      error: (error: unknown) => {
        this.deletingComment.set(false);
        void this._feedbackService.error(error, 'Could not delete that comment.');
      },
    });
  }

  startEdit(): void {
    this.editDraft.set(this.store.post()?.content ?? '');
    this.editOpen.set(true);
  }

  onEditDraft(value: string): void {
    this.editDraft.set(value);
  }

  saveEdit(): void {
    if (!this.canSaveEdit()) return;
    this.savingEdit.set(true);

    this.store.updatePost(this.editDraft().trim()).subscribe({
      next: () => {
        this.savingEdit.set(false);
        this.editOpen.set(false);
        void this._feedbackService.success('Post updated');
      },
      error: (error: unknown) => {
        this.savingEdit.set(false);
        void this._feedbackService.error(error, 'Could not save that change.');
      },
    });
  }

  confirmDeletePost(): void {
    this.deletePostOpen.set(true);
  }

  deletePost(): void {
    if (this.deletingPost()) return;

    this.deletingPost.set(true);
    this.store.deletePost().subscribe({
      next: () => {
        this.deletingPost.set(false);
        this.deletePostOpen.set(false);
        void this._feedbackService.success('Post deleted');
        // Back to the group: the screen it was deleted from no longer has
        // anything to show.
        void this._router.navigateByUrl('/tabs/groups');
      },
      error: (error: unknown) => {
        this.deletingPost.set(false);
        void this._feedbackService.error(error, 'Could not delete that post.');
      },
    });
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.refresh(() => void event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.store.loadMoreComments(() => void event.target.complete());
  }

  retry(): void {
    this.store.refresh();
  }
}
