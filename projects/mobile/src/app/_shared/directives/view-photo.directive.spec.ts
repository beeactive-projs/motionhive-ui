import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PhotoViewerService } from '../services/photo-viewer.service';
import { ViewPhotoDirective } from './view-photo.directive';

@Component({
  imports: [ViewPhotoDirective],
  template: `<div
    aria-hidden="true"
    [mhViewPhoto]="url()"
    mhViewPhotoAlt="Profile photo"
    mhViewPhotoLabel="See the profile photo"
  ></div>`,
})
class Host {
  readonly url = signal<string | null>(null);
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const element = fixture.nativeElement.querySelector('div') as HTMLElement;
  const viewer = TestBed.inject(PhotoViewerService);
  const withPhoto = (url: string | null) => {
    fixture.componentInstance.url.set(url);
    fixture.detectChanges();
  };
  return { element, viewer, withPhoto };
}

describe('ViewPhotoDirective', () => {
  it('leaves a picture with no photo as it was: hidden, not a button', () => {
    const { element, viewer } = setup();
    expect(element.getAttribute('role')).toBeNull();
    expect(element.getAttribute('tabindex')).toBeNull();
    expect(element.getAttribute('aria-hidden')).toBe('true');
    element.click();
    expect(viewer.isOpen()).toBe(false);
  });

  it('makes a picture with a photo a named button', () => {
    const { element, withPhoto } = setup();
    withPhoto('https://img.example/a.jpg');
    expect(element.getAttribute('role')).toBe('button');
    expect(element.getAttribute('tabindex')).toBe('0');
    expect(element.getAttribute('aria-label')).toBe('See the profile photo');
    expect(element.getAttribute('aria-hidden')).toBeNull();
    expect(element.classList.contains('mh-photo-tap')).toBe(true);
  });

  it('opens the photo full screen on a tap, and on Enter', () => {
    const { element, viewer, withPhoto } = setup();
    withPhoto('https://img.example/a.jpg');
    element.click();
    expect(viewer.current()).toEqual({ url: 'https://img.example/a.jpg', alt: 'Profile photo' });
    viewer.close();
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(viewer.isOpen()).toBe(true);
  });

  it('lets a button inside keep its own tap', () => {
    const { element, viewer, withPhoto } = setup();
    withPhoto('https://img.example/a.jpg');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    event.preventDefault();
    element.dispatchEvent(event);
    expect(viewer.isOpen()).toBe(false);
  });
});
