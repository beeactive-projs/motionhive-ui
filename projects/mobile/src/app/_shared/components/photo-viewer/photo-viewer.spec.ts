import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { PhotoViewerService } from '../../services/photo-viewer.service';
import { PhotoViewer } from './photo-viewer';

describe('PhotoViewer', () => {
  it('closes when the app goes to another screen', () => {
    const events = new Subject<unknown>();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { events } }] });
    const viewer = TestBed.inject(PhotoViewerService);
    TestBed.runInInjectionContext(() => new PhotoViewer());

    viewer.open([{ url: 'blob:workout', alt: 'Workout photo' }]);
    events.next(new NavigationEnd(1, '/a', '/a'));
    expect(viewer.isOpen()).toBe(true);
    events.next(new NavigationStart(2, '/tabs/messages'));
    expect(viewer.isOpen()).toBe(false);
  });
});
