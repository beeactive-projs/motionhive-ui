import { describe, expect, it } from 'vitest';

import { appleSharedName, createAppleNonce, randomHex, sha256Hex } from './apple-sign-in.utils';

describe('the nonce for Sign in with Apple', () => {
  it('hashes with SHA-256 as lowercase hex, the way the API checks it', async () => {
    // The FIPS 180-2 test vector for "abc".
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('gives the API 64 hex characters and Apple their hash', async () => {
    const nonce = await createAppleNonce();
    expect(nonce.raw).toMatch(/^[0-9a-f]{64}$/);
    expect(nonce.hashed).toBe(await sha256Hex(nonce.raw));
  });

  it('is new for every sign in', () => {
    expect(randomHex()).not.toBe(randomHex());
    expect(randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('the name Apple shared', () => {
  it('is trimmed, and an empty part is left out', () => {
    expect(appleSharedName('  Ana ', '')).toEqual({ firstName: 'Ana' });
    expect(appleSharedName(null, ' Pop')).toEqual({ lastName: 'Pop' });
    expect(appleSharedName('Ana', 'Pop')).toEqual({ firstName: 'Ana', lastName: 'Pop' });
  });

  it('is nothing when Apple gave none', () => {
    expect(appleSharedName('', '  ')).toBeNull();
    expect(appleSharedName(null, undefined)).toBeNull();
  });
});
