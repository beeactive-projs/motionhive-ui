import { describe, expect, it } from 'vitest';

import { apiErrorMessage } from './api-error.utils';

/** The shape an Angular HttpErrorResponse arrives in. */
const http = (status: number, body?: unknown, message = 'Http failure response') => ({
  status,
  error: body,
  message,
});

describe('apiErrorMessage', () => {
  it("keeps the backend's own message for a 4xx, which is written for a person", () => {
    expect(apiErrorMessage(http(400, { message: 'Name is required' }), 'x')).toBe(
      'Name is required',
    );
    expect(apiErrorMessage(http(404, { message: 'Program not found.' }), 'x')).toBe(
      'Program not found.',
    );
  });

  it('shows the first of class-validator\'s list, not the array', () => {
    const body = { message: ['name must be longer', 'weeks must be a number'] };
    expect(apiErrorMessage(http(400, body), 'x')).toBe('name must be longer');
  });

  // A throttle comes back as "ThrottlerException: Too Many Requests" — true,
  // and useless to the person who saw it. This is the case that prompted
  // the status map.
  it('replaces a 429 with copy that says what to do', () => {
    const body = { message: 'ThrottlerException: Too Many Requests' };
    expect(apiErrorMessage(http(429, body), 'x')).toMatch(/give it a moment/i);
  });

  it('never surfaces a server error body to the user', () => {
    expect(apiErrorMessage(http(500, { message: 'TypeError: x is undefined' }), 'x')).toMatch(
      /our side/i,
    );
    expect(apiErrorMessage(http(504), 'x')).toMatch(/too long/i);
  });

  it('names being offline as being offline', () => {
    expect(apiErrorMessage(http(0), 'x')).toMatch(/offline/i);
  });

  it("prefers the caller's fallback over the HTTP layer's own text", () => {
    // "Http failure response for …: 0 Unknown Error" is never worth reading.
    expect(apiErrorMessage(http(418, undefined, 'Http failure response for /x'), 'Could not save'))
      .toBe('Could not save');
    expect(apiErrorMessage(undefined, 'Could not save')).toBe('Could not save');
  });
});
