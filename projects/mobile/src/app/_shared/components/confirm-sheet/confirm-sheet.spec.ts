import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ConfirmSheet } from './confirm-sheet';

describe('ConfirmSheet', () => {
  beforeEach(() => {
    TestBed.overrideComponent(ConfirmSheet, { set: { template: '', imports: [] } });
  });

  // Its size, inset and ink are the template's and the stylesheet's, checked
  // in the running app. Callers that navigate after the confirm (the routine
  // builder's Discard, Delete and Make a copy) await this before routing.
  it('closes, with no shell drawn', async () => {
    const fixture = TestBed.createComponent(ConfirmSheet);
    fixture.componentRef.setInput('title', 'Discard changes?');
    fixture.componentRef.setInput('body', 'Your changes will be lost.');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const confirm = fixture.componentInstance;

    await confirm.close();

    expect(confirm.open()).toBe(false);
  });
});
