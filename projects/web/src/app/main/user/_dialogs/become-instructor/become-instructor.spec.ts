import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthStore, ProfileService, TokenService } from 'core';

import { BecomeInstructor } from './become-instructor';

describe('BecomeInstructor', () => {
  // The Overview page it opened on shows sample rows, never the coach's own.
  it("opens a new coach's clients once the profile is made", () => {
    const navigate = vi.fn();
    const user = signal({ id: 'me', roles: ['USER'] });
    TestBed.overrideComponent(BecomeInstructor, { set: { template: '', imports: [] } });
    TestBed.configureTestingModule({
      providers: [
        { provide: ProfileService, useValue: { createInstructorProfile: () => of({}) } },
        { provide: TokenService, useValue: { getUser: () => ({ firstName: 'Ana', lastName: 'Coach' }) } },
        { provide: AuthStore, useValue: { user, setUser: vi.fn() } },
        { provide: Router, useValue: { navigate } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const dialog = TestBed.createComponent(BecomeInstructor).componentInstance;
    dialog.form.patchValue({ displayName: 'Ana Coach' });

    dialog.submit();

    expect(navigate).toHaveBeenCalledWith(['/coaching/clients']);
  });
});
