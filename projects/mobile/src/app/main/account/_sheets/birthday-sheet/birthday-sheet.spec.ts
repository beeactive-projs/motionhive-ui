import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';
import { BirthdaySheet } from './birthday-sheet';

describe('BirthdaySheet', () => {
  let saved: WritableSignal<string | null>;
  let reply: Subject<void>;
  let updateAboutYou: ReturnType<typeof vi.fn>;
  let success: ReturnType<typeof vi.fn>;
  let failure: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    saved = signal<string | null>(null);
    reply = new Subject<void>();
    updateAboutYou = vi.fn(() => reply.asObservable());
    success = vi.fn();
    failure = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AccountStore, useValue: { birthDate: saved, updateAboutYou } },
        { provide: FeedbackService, useValue: { success, error: failure } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(BirthdaySheet, { set: { template: '', imports: [] } });
  });

  function opened(): BirthdaySheet {
    const fixture = TestBed.createComponent(BirthdaySheet);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('starts on the saved day, and saves only another one', () => {
    saved.set('1992-03-14');
    const sheet = opened();

    expect(sheet.draft()).toBe('1992-03-14');
    expect(sheet.hasSaved()).toBe(true);
    expect(sheet.canSave()).toBe(false);

    sheet.draft.set('1990-01-02');
    expect(sheet.canSave()).toBe(true);
  });

  it('has nothing to save or remove until a day is picked', () => {
    const sheet = opened();
    expect(sheet.canSave()).toBe(false);
    expect(sheet.hasSaved()).toBe(false);
  });

  it('saves the picked day and closes', () => {
    const sheet = opened();
    sheet.draft.set('1992-03-14');

    sheet.save();
    expect(updateAboutYou).toHaveBeenCalledWith({ birthDate: '1992-03-14' });
    expect(sheet.saving()).toBe(true);

    reply.next();
    expect(sheet.open()).toBe(false);
    expect(success).toHaveBeenCalledWith('accountSheets.birthday.toast.updated');
  });

  it('removes the birthday', () => {
    saved.set('1992-03-14');
    const sheet = opened();

    sheet.remove();
    expect(updateAboutYou).toHaveBeenCalledWith({ birthDate: null });
    reply.next();
    expect(success).toHaveBeenCalledWith('accountSheets.birthday.toast.removed');
  });

  it('stays open with the day picked when the save fails', () => {
    const sheet = opened();
    sheet.draft.set('1992-03-14');

    sheet.save();
    reply.error(new Error('500'));

    expect(sheet.open()).toBe(true);
    expect(sheet.saving()).toBe(false);
    expect(sheet.draft()).toBe('1992-03-14');
    expect(failure).toHaveBeenCalled();
  });
});
