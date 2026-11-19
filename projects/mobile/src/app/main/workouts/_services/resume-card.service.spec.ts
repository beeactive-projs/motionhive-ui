import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ResumeCardService } from './resume-card.service';

describe('ResumeCardService', () => {
  it('starts with no card on show, and says what the page last told it', () => {
    const service = TestBed.inject(ResumeCardService);
    expect(service.shown()).toBe(false);

    service.set(true);
    expect(service.shown()).toBe(true);

    service.set(false);
    expect(service.shown()).toBe(false);
  });
});
