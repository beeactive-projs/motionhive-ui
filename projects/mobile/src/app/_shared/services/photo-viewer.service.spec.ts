import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PhotoViewerService } from './photo-viewer.service';

const photo = (url: string) => ({ url, alt: `alt ${url}` });

function viewer(): PhotoViewerService {
  return TestBed.inject(PhotoViewerService);
}

describe('PhotoViewerService', () => {
  it('is closed until a photo is opened', () => {
    const service = viewer();
    expect(service.isOpen()).toBe(false);
    expect(service.current()).toBeNull();
  });

  it('opens on the photo asked for, leaving out photos with no address', () => {
    const service = viewer();
    service.open([photo('a'), photo(''), photo('b'), photo('c')], 1);
    expect(service.isOpen()).toBe(true);
    expect(service.total()).toBe(3);
    expect(service.current()?.url).toBe('b');
  });

  it('opens nothing when there is no photo to show', () => {
    const service = viewer();
    service.open([photo('')]);
    expect(service.isOpen()).toBe(false);
  });

  it('holds the start inside the photos', () => {
    const service = viewer();
    service.open([photo('a'), photo('b')], 9);
    expect(service.current()?.url).toBe('b');
    service.open([photo('a'), photo('b')], -3);
    expect(service.current()?.url).toBe('a');
  });

  it('steps through the photos and stops at either end', () => {
    const service = viewer();
    service.open([photo('a'), photo('b')]);
    expect(service.hasPrevious()).toBe(false);
    service.previous();
    expect(service.index()).toBe(0);
    service.next();
    expect(service.current()?.url).toBe('b');
    expect(service.hasNext()).toBe(false);
    service.next();
    expect(service.index()).toBe(1);
  });

  it('closes and starts over at the first photo next time', () => {
    const service = viewer();
    service.open([photo('a'), photo('b')], 1);
    service.close();
    expect(service.isOpen()).toBe(false);
    service.open([photo('c'), photo('d')]);
    expect(service.current()?.url).toBe('c');
  });
});
