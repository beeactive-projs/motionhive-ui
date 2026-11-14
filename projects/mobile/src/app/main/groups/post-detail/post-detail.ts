import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
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
  NavController,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import {
  AuthStore,
  GroupsRefreshService,
  Post,
  PostComment,
  displayName,
  formatRelativeShort,
} from 'core';

import { ActionSheet } from '../../../_shared/components/action-sheet/action-sheet';
import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../_shared/components/sheet-shell/sheet-shell';
import { KeyboardFooterDirective } from '../../../_shared/directives/keyboard-footer.directive';
import { PostGallery } from '../_components/post-gallery/post-gallery';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { groupLinks } from '../../../_shared/utils/stack-paths';
import {
  COMMENT_MAX_LENGTH,
  POST_MAX_LENGTH,
  canDeleteComment,
  canDeletePost,
  canEditPost,
} from '../groups.config';
import { GROUP_ICONS } from '../groups.icons';
import { PostDetailStore } from './post-detail.store';
import { PostActionId, PostActionIds, postActions } from '../_sheets/post-actions/post-actions.config';
import { PostWorkoutCard } from '../_components/post-workout/post-workout';

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
    ActionSheet,
    PostWorkoutCard,
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
    KeyboardFooterDirective,
    PostGallery,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.scss',
  providers: [PostDetailStore],
})
export class PostDetail implements ViewWillEnter {
  readonly store = inject(PostDetailStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _navController = inject(NavController);
  /** The stack the post was opened in: the Groups tab, or a profile's. */
  private readonly _links = groupLinks(this._router.url);
  readonly backHref = this._links.home;
  private readonly _authStore = inject(AuthStore);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _keyboard = viewChild(KeyboardFooterDirective);
  private readonly _composer = viewChild<IonTextarea>('composer');

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

  private readonly _viewerId = computed(() => this._authStore.user()?.id ?? '');

  readonly canDeleteThisPost = computed(() => {
    const post = this.store.post();
    return !!post && canDeletePost(this.store.viewerRole(), this._viewerId(), post.authorId);
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

  readonly commentCountLabel = computed(() =>
    this._translateService.instant('groups.post.commentCount', {
      count: this.store.commentCount(),
    }),
  );

  readonly composerPlaceholder = computed(() => {
    const target = this.replyingTo();
    return target
      ? this._translateService.instant('groups.post.replyTo', { name: target.name })
      : this._translateService.instant('groups.post.addComment');
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

  /**
   * Comment on a card opens the post with the field ready. The instruction
   * is taken out of the URL once used, or every way back to this page would
   * replay it.
   */
  ionViewDidEnter(): void {
    const params = this._router.parseUrl(this._router.url).queryParamMap;
    if (!params.has('comment')) {
      return;
    }
    const composer = this._composer();
    if (composer) {
      void composer.setFocus();
    }
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { comment: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ── The post's ⋯ ───────────────────────────────────────────────────────

  readonly actionsOpen = signal(false);

  /**
   * Edit and Delete. View profile is left out here: the author's name above
   * the post already opens it.
   */
  readonly postActions = computed(() => {
    const post = this.store.post();
    if (!post) {
      return [];
    }
    const actions = postActions(post, {
      canEdit: this.canEditThisPost(),
      canDelete: this.canDeleteThisPost(),
    });
    return actions.filter((action) => action.id !== PostActionIds.Profile);
  });

  openActions(): void {
    this._dismissKeyboard();
    this.actionsOpen.set(true);
  }

  onAction(id: PostActionId): void {
    if (id === PostActionIds.Edit) {
      this.startEdit();
      return;
    }
    if (id === PostActionIds.Delete) {
      this.confirmDeletePost();
    }
  }

  // ── Display helpers ────────────────────────────────────────────────────

  authorName(row: Post | PostComment): string {
    return displayName(row.author, this._translateService.instant('groups.common.member'));
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

  /** Opens the full-screen viewer on the photo that was tapped. */
  openPhoto(index: number): void {
    const post = this.store.post();
    if (!post) return;
    void this._router.navigate(this._links.post(post.id, 'photos'), {
      queryParams: { index },
    });
  }

  openProfile(row: Post | PostComment): void {
    const handle = row.author?.handle;
    if (!handle) return;
    void this._router.navigate(this._links.person(handle));
  }

  mayDeleteComment(comment: PostComment): boolean {
    return canDeleteComment(this.store.viewerRole(), this._viewerId(), comment.authorId);
  }

  // ── Composing ──────────────────────────────────────────────────────────

  onDraft(value: string): void {
    this.draft.set(value);
  }

  /**
   * Start a reply. `root` is the thread this belongs to and `tapped` is who
   * the viewer answered — the same row for a top-level comment, different
   * when they replied to a reply.
   *
   * The keyboard comes up at once, as Reply does in a messaging app, with the
   * comment being answered kept above the bar (`row`). Focus is given inside
   * the tap: the only moment iOS lets a script raise the keyboard.
   */
  replyTo(root: PostComment, tapped: PostComment = root, row: HTMLElement | null = null): void {
    this.replyingTo.set({ rootId: root.id, name: this.authorName(tapped) });
    const keyboard = this._keyboard();
    if (keyboard) {
      keyboard.keepInView(row);
    }
    const composer = this._composer();
    if (composer) {
      void composer.setFocus();
    }
  }

  cancelReply(): void {
    this.replyingTo.set(null);
    this._unpin();
  }

  /** The comment being answered no longer needs to stay in view. */
  private _unpin(): void {
    const keyboard = this._keyboard();
    if (keyboard) {
      keyboard.keepInView(null);
    }
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
        this._unpin();
      },
      error: (error: unknown) => {
        this.sending.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('groups.post.toast.commentFailed'),
        );
      },
    });
  }

  // ── Verbs ──────────────────────────────────────────────────────────────

  like(): void {
    this.store.toggleReaction().subscribe({
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('groups.post.toast.reactionFailed'),
        ),
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
        void this._feedbackService.success(
          this._translateService.instant('groups.post.toast.commentDeleted'),
        );
      },
      error: (error: unknown) => {
        this.deletingComment.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('groups.post.toast.deleteCommentFailed'),
        );
      },
    });
  }

  startEdit(): void {
    this._dismissKeyboard();
    this.editDraft.set(this.store.post()?.content ?? '');
    this.editOpen.set(true);
  }

  /** A header verb opening a sheet takes the comment bar's keyboard down first. */
  private _dismissKeyboard(): void {
    const keyboard = this._keyboard();
    if (keyboard) {
      keyboard.dismiss();
    }
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
        // The feeds behind this screen are still showing the old text.
        this._groupsRefresh.notify();
        void this._feedbackService.success(
          this._translateService.instant('groups.post.toast.updated'),
        );
      },
      error: (error: unknown) => {
        this.savingEdit.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('groups.post.toast.editFailed'),
        );
      },
    });
  }

  confirmDeletePost(): void {
    this._dismissKeyboard();
    this.deletePostOpen.set(true);
  }

  deletePost(): void {
    if (this.deletingPost()) return;

    this.deletingPost.set(true);
    this.store.deletePost().subscribe({
      next: () => {
        this.deletingPost.set(false);
        this.deletePostOpen.set(false);
        // We are about to land on a feed that still lists this post.
        this._groupsRefresh.notify();
        void this._feedbackService.success(
          this._translateService.instant('groups.post.toast.deleted'),
        );
        // Back to the group: the screen it was deleted from no longer has
        // anything to show.
        if (this._links.inGroupsTab) void this._router.navigateByUrl(this._links.home);
        else void this._navController.back();
      },
      error: (error: unknown) => {
        this.deletingPost.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('groups.post.toast.deleteFailed'),
        );
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
