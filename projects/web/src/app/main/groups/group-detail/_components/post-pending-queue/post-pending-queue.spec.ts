import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Post, PostService } from 'core';

import { PostPendingQueue } from './post-pending-queue';

function post(id: string): Post {
  return { id, groupId: 'g1', content: 'hello' } as Post;
}

function setup(pages: { items: Post[]; total: number }[]) {
  const postService = { getPendingForGroup: vi.fn(), moderatePost: vi.fn(() => of({})) };
  for (const p of pages) {
    postService.getPendingForGroup.mockReturnValueOnce(of(p));
  }
  TestBed.overrideComponent(PostPendingQueue, { set: { template: '', imports: [] } });
  TestBed.configureTestingModule({
    providers: [
      { provide: PostService, useValue: postService },
      { provide: MessageService, useValue: { add: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const fixture = TestBed.createComponent(PostPendingQueue);
  fixture.componentRef.setInput('groupId', 'g1');
  fixture.detectChanges();
  return { queue: fixture.componentInstance, postService };
}

describe('PostPendingQueue', () => {
  it('counts the posts waiting on the server, not the page on screen', () => {
    const { queue } = setup([{ items: [post('p1')], total: 60 }]);
    expect(queue.count()).toBe(60);
  });

  // Reviewing the page on screen used to leave "nothing waiting" while the
  // server still held more.
  it('reads the next posts in once the page on screen is reviewed', () => {
    const { queue, postService } = setup([
      { items: [post('p1')], total: 2 },
      { items: [post('p2')], total: 1 },
    ]);
    queue.approve(post('p1'));

    expect(postService.getPendingForGroup).toHaveBeenCalledTimes(2);
    expect(queue.pending().map((p) => p.id)).toEqual(['p2']);
    expect(queue.count()).toBe(1);
  });

  it('stops at the end of the queue', () => {
    const { queue, postService } = setup([{ items: [post('p1')], total: 1 }]);
    queue.reject(post('p1'));
    expect(postService.getPendingForGroup).toHaveBeenCalledTimes(1);
    expect(queue.count()).toBe(0);
  });
});
