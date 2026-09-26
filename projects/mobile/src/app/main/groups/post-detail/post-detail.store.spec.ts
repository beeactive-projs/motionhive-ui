import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Post, PostComment, PostService } from 'core';

import { PostDetailStore } from './post-detail.store';

const POST_ID = 'p-1';

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: POST_ID,
    content: 'hello',
    reactionCount: 1,
    commentCount: 0,
    myReaction: null,
    ...overrides,
  } as Post;
}

function comment(id: string, replies: PostComment[] = []): PostComment {
  return { id, postId: POST_ID, parentCommentId: null, content: id, replies } as PostComment;
}

function reply(id: string, parentCommentId: string): PostComment {
  return { id, postId: POST_ID, parentCommentId, content: id } as PostComment;
}

function page<T>(items: T[], total = items.length) {
  return { items, total, page: 1, pageSize: 20 };
}

interface Fixtures {
  post?: Post;
  comments?: ReturnType<typeof page<PostComment>>;
}

function setup(fixtures: Fixtures = {}) {
  const getPostById = vi.fn(() => of(fixtures.post ?? post()));
  const getComments = vi.fn(() => of(fixtures.comments ?? page<PostComment>([])));
  const toggleReaction = vi.fn(() => of({ reacted: true, count: 7 }));
  const addComment = vi.fn((_p: string, payload: { content: string; parentCommentId?: string }) =>
    of(
      payload.parentCommentId
        ? reply('new-reply', payload.parentCommentId)
        : comment('new-comment'),
    ),
  );
  const deleteComment = vi.fn(() => of({ ok: true as const }));
  const deletePost = vi.fn(() => of({ deleted: true as const }));

  TestBed.configureTestingModule({
    providers: [
      PostDetailStore,
      {
        provide: PostService,
        useValue: {
          getPostById,
          getComments,
          toggleReaction,
          addComment,
          deleteComment,
          deletePost,
        },
      },
    ],
  });

  return {
    store: TestBed.inject(PostDetailStore),
    getPostById,
    getComments,
    toggleReaction,
    addComment,
    deleteComment,
  };
}

describe('PostDetailStore — comments', () => {
  it('appends a new comment, matching the API oldest-first order', () => {
    const { store } = setup({ comments: page([comment('c1')]) });
    store.init(POST_ID);

    store.addComment('hi').subscribe();

    expect(store.comments().map((c) => c.id)).toEqual(['c1', 'new-comment']);
  });

  it('nests a reply under its root rather than adding a second thread', () => {
    const { store } = setup({ comments: page([comment('c1')]) });
    store.init(POST_ID);

    store.addComment('hi', 'c1').subscribe();

    expect(store.comments()).toHaveLength(1);
    expect(store.comments()[0].replies?.map((r) => r.id)).toEqual(['new-reply']);
  });

  it('counts replies as comments, the way the post counter does', () => {
    const { store } = setup({
      post: post({ commentCount: 3 }),
      comments: page([comment('c1', [reply('r1', 'c1'), reply('r2', 'c1')]), comment('c2')]),
    });
    store.init(POST_ID);

    // Two roots plus two replies.
    expect(store.commentCount()).toBe(4);
  });

  it('keeps the post counter in step when a comment lands', () => {
    const { store } = setup({ post: post({ commentCount: 1 }), comments: page([comment('c1')]) });
    store.init(POST_ID);

    store.addComment('hi').subscribe();

    expect(store.post()?.commentCount).toBe(2);
  });
});

describe('PostDetailStore — deleting', () => {
  it('takes a thread\'s replies with it, because the API cascades', () => {
    const { store } = setup({
      post: post({ commentCount: 3 }),
      comments: page([comment('c1', [reply('r1', 'c1'), reply('r2', 'c1')])], 1),
    });
    store.init(POST_ID);

    store.deleteComment('c1').subscribe();

    expect(store.comments()).toEqual([]);
    // Three rows went, not one.
    expect(store.post()?.commentCount).toBe(0);
  });

  it('removes a reply without touching its root', () => {
    const { store } = setup({
      post: post({ commentCount: 2 }),
      comments: page([comment('c1', [reply('r1', 'c1')])], 1),
    });
    store.init(POST_ID);

    store.deleteComment('r1').subscribe();

    expect(store.comments()).toHaveLength(1);
    expect(store.comments()[0].replies).toEqual([]);
    expect(store.post()?.commentCount).toBe(1);
  });

  it('never drives the counter below zero', () => {
    // The server's count and the loaded rows can disagree after a delete
    // elsewhere; a negative "-1 comments" is the visible symptom.
    const { store } = setup({ post: post({ commentCount: 0 }), comments: page([comment('c1')], 1) });
    store.init(POST_ID);

    store.deleteComment('c1').subscribe();

    expect(store.post()?.commentCount).toBe(0);
  });
});

describe('PostDetailStore — reactions', () => {
  it('takes the count from the server rather than incrementing', () => {
    const { store } = setup({ post: post({ reactionCount: 1 }) });
    store.init(POST_ID);

    store.toggleReaction().subscribe();

    expect(store.post()?.reactionCount).toBe(7);
    expect(store.post()?.myReaction).toBe('LIKE');
  });
});

describe('PostDetailStore — loading', () => {
  it('loads the post and its comments on entry', () => {
    const { store, getPostById, getComments } = setup();

    store.init(POST_ID);

    expect(getPostById).toHaveBeenCalledTimes(1);
    expect(getComments).toHaveBeenCalledTimes(1);
  });

  it('ignores a repeated init for the post already on screen', () => {
    const { store, getPostById } = setup();
    store.init(POST_ID);

    store.init(POST_ID);

    expect(getPostById).toHaveBeenCalledTimes(1);
  });

  it('does not leave the previous post on screen when the next one fails', () => {
    const { store, getPostById, getComments } = setup({ comments: page([comment('c1')]) });
    store.init(POST_ID);
    expect(store.comments()).toHaveLength(1);

    getPostById.mockReturnValueOnce(throwError(() => new Error('offline')));
    getComments.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.init('p-2');

    expect(store.post()).toBeNull();
    expect(store.comments()).toEqual([]);
  });

  it('appends the next page rather than replacing', () => {
    const { store, getComments } = setup({ comments: page([comment('c1')], 2) });
    store.init(POST_ID);

    getComments.mockReturnValueOnce(
      of({ items: [comment('c2')], total: 2, page: 2, pageSize: 20 }),
    );
    store.loadMoreComments();

    expect(store.comments().map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(store.commentsHasMore()).toBe(false);
  });
});

describe('PostDetailStore — failure', () => {
  it('keeps the comments it has and marks them stale when a refresh fails', () => {
    const { store, getComments } = setup({ comments: page([comment('c1')]) });
    store.init(POST_ID);

    getComments.mockReturnValueOnce(throwError(() => new Error('offline')));
    store.refresh();

    expect(store.comments().map((c) => c.id)).toEqual(['c1']);
    expect(store.isStale()).toBe(true);
    expect(store.showCommentsError()).toBe(false);
  });

  it('always calls done, so a refresher spinner cannot hang', () => {
    const { store, getComments } = setup();
    getComments.mockReturnValueOnce(throwError(() => new Error('offline')));
    const done = vi.fn();

    store.refresh(done);

    expect(done).toHaveBeenCalled();
  });
});
