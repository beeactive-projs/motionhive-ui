import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Genders } from 'core';
import type { Gender } from 'core';

import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';
import { GenderSheet } from './gender-sheet';

function setup(current: Gender | null) {
  const reply = new Subject<void>();
  const updateAboutYou = vi.fn(() => reply.asObservable());
  const success = vi.fn();
  const failure = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: AccountStore, useValue: { gender: signal(current), updateAboutYou } },
      { provide: FeedbackService, useValue: { success, error: failure } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const sheet = TestBed.runInInjectionContext(() => new GenderSheet());
  return { sheet, reply, updateAboutYou, success, failure };
}

describe('GenderSheet', () => {
  it("offers the owner's three choices, in order", () => {
    const { sheet } = setup(null);
    expect(sheet.options()).toEqual([
      { value: 'MALE', label: 'enum.gender.MALE' },
      { value: 'FEMALE', label: 'enum.gender.FEMALE' },
      { value: 'PREFER_NOT_TO_SAY', label: 'enum.gender.PREFER_NOT_TO_SAY' },
    ]);
    expect(sheet.selected()).toBeNull();
  });

  it('saves the pick', () => {
    const { sheet, reply, updateAboutYou, success } = setup(null);
    sheet.onPicked('FEMALE');
    expect(updateAboutYou).toHaveBeenCalledWith({ gender: 'FEMALE' });
    reply.next();
    expect(success).toHaveBeenCalledWith('accountSheets.gender.toast.updated');
  });

  it('ignores a value it does not know', () => {
    const { sheet, updateAboutYou } = setup(null);
    sheet.onPicked('OTHER');
    expect(updateAboutYou).not.toHaveBeenCalled();
  });

  it('removes it, and says so when that fails', () => {
    const { sheet, reply, updateAboutYou, failure } = setup(Genders.Male);
    sheet.onCleared();
    expect(updateAboutYou).toHaveBeenCalledWith({ gender: null });
    reply.error(new Error('500'));
    expect(failure).toHaveBeenCalled();
  });
});
