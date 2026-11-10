/** A nonce for one Sign in with Apple: what the API gets and what Apple gets. */
export interface AppleNonce {
  /** Sent to the API, which hashes it and compares it with the token's `nonce` claim. */
  raw: string;
  /** Given to Apple, which puts it in the identity token as is. */
  hashed: string;
}

/** A name Apple shared, trimmed; an empty part is left out. */
export interface AppleSharedName {
  firstName?: string;
  lastName?: string;
}

/** 32 random bytes as lowercase hex: 64 characters, inside the API's 32 to 128. */
const NONCE_BYTES = 32;

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/** Random lowercase hex from the platform's secure generator. */
export function randomHex(byteCount: number = NONCE_BYTES): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** SHA-256 of the text (UTF-8) as lowercase hex. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(new Uint8Array(digest));
}

/**
 * A fresh nonce for one sign in. Apple gets the hash and copies it into the
 * identity token; the API gets the raw value and checks the two match, so a
 * token taken from another sign in cannot be replayed here.
 */
export async function createAppleNonce(): Promise<AppleNonce> {
  const raw = randomHex();
  const hashed = await sha256Hex(raw);
  return { raw, hashed };
}

/**
 * The name Apple shared, ready for `POST /auth/apple`: trimmed, empty parts
 * dropped, `null` when there is nothing (Apple sends a name on the first
 * sign in only, and the person may have cleared it in Apple's sheet).
 */
export function appleSharedName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): AppleSharedName | null {
  const name: AppleSharedName = {};
  const first = (firstName ?? '').trim();
  const last = (lastName ?? '').trim();
  if (first) {
    name.firstName = first;
  }
  if (last) {
    name.lastName = last;
  }
  if (!name.firstName && !name.lastName) {
    return null;
  }
  return name;
}
