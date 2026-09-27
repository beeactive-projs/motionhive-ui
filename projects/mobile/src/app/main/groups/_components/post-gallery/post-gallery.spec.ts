import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PostGallery } from './post-gallery';

function make(urls: string[]) {
  const fixture = TestBed.createComponent(PostGallery);
  fixture.componentRef.setInput('urls', urls);
  fixture.detectChanges();
  return fixture.componentInstance;
}

function urls(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `https://example.test/${i}.jpg`);
}

describe('PostGallery', () => {
  it('shows every photo when there are no more than the cap', () => {
    const gallery = make(urls(4));

    expect(gallery.visible()).toHaveLength(4);
    expect(gallery.extra()).toBe(0);
  });

  it('caps the grid and counts the rest', () => {
    // The API caps a post at four, so this is defensive — it covers older
    // rows and a cap that moves, rather than something reachable today.
    const gallery = make(urls(7));

    expect(gallery.visible()).toHaveLength(4);
    expect(gallery.extra()).toBe(3);
  });

  it('names the photo and its author for a screen reader', () => {
    const fixture = TestBed.createComponent(PostGallery);
    fixture.componentRef.setInput('urls', urls(2));
    fixture.componentRef.setInput('authorName', 'Anna Popescu');
    fixture.detectChanges();

    expect(fixture.componentInstance.label(0)).toBe('Open photo 1 of 2 by Anna Popescu');
  });

  it('still names the photo when the author is unknown', () => {
    const gallery = make(urls(2));

    expect(gallery.label(1)).toBe('Open photo 2 of 2');
  });
});
