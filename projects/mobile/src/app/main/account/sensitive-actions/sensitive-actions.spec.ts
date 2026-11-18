import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { SensitiveActions } from './sensitive-actions';

describe('SensitiveActions', () => {
  it('opens the delete account page, which explains before anything happens', () => {
    const navigateByUrl = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigateByUrl } }] });
    const page = TestBed.runInInjectionContext(() => new SensitiveActions());

    page.openDelete();

    expect(navigateByUrl).toHaveBeenCalledWith('/tabs/more/account/delete');
  });
});
