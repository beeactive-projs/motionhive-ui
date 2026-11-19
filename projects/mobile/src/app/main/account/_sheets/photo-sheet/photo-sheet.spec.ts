import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

import { UserService } from 'core';

import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { PhotoViewerService } from '../../../../_shared/services/photo-viewer.service';
import { AccountStore } from '../../account.store';
import { PhotoSheet } from './photo-sheet';

function setup(avatarUrl: string | null) {
  TestBed.configureTestingModule({
    providers: [
      { provide: UserService, useValue: {} },
      { provide: FeedbackService, useValue: {} },
      { provide: AccountStore, useValue: { avatarUrl: signal(avatarUrl) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const sheet = TestBed.runInInjectionContext(() => new PhotoSheet());
  return { sheet, viewer: TestBed.inject(PhotoViewerService) };
}

describe('PhotoSheet', () => {
  it('offers to see the photo first, while there is one', () => {
    const { sheet } = setup('https://img.example/me.jpg');
    expect(sheet.actions()[0].id).toBe('view');
  });

  it('has nothing to see without a photo', () => {
    const { sheet } = setup(null);
    expect(sheet.actions().some((action) => action.id === 'view')).toBe(false);
  });

  it('closes and shows the whole photo', () => {
    const { sheet, viewer } = setup('https://img.example/me.jpg');
    sheet.open.set(true);
    sheet.choose('view');
    expect(sheet.open()).toBe(false);
    expect(viewer.current()).toEqual({ url: 'https://img.example/me.jpg', alt: 'photoViewer.alt.profile' });
  });
});
