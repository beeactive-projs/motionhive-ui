import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { NotificationMock } from './notification-mock';

describe('NotificationMock', () => {
  it('is a plain alert with no bar and no buttons unless given them', () => {
    TestBed.overrideComponent(NotificationMock, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(NotificationMock);
    fixture.componentRef.setInput('title', 'Rest over');
    fixture.detectChanges();
    const note = fixture.componentInstance;

    expect(note.inline()).toBe(false);
    expect(note.progress()).toBeNull();
    expect(note.actions()).toEqual([]);

    fixture.componentRef.setInput('progress', 0.5);
    fixture.componentRef.setInput('actions', ['+15 s', 'Skip', 'Open']);
    expect(note.progress()).toBe(0.5);
    expect(note.actions()).toHaveLength(3);
  });
});
