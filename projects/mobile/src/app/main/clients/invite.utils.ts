import { SIGNUP_URL, isValidEmail } from 'core';

/**
 * The invite page's own vocabulary: how long an invitation stands, where its
 * link lands, and the two questions the search field has to answer — "is this
 * an address?" and "what state is this row in?".
 *
 * There is no mode here any more. The page has one field, and what the coach
 * types decides the door: a name lists people, an address offers to email
 * them. `isEmailQuery` and `inviteEmail` are that decision, split so a
 * half-typed address can say what is wrong with it instead of silently
 * offering nothing.
 *
 * Address validation itself lives in core (`email.utils`), because the BE's
 * `@IsEmail()` is the real arbiter and the web dialog has to agree with it.
 */

/**
 * Stated in the page's copy; the BE owns the real TTL and sets it to 30 days
 * (`expiresAt` on the created request, and again on every resend). This said
 * 14 once, so the sheet promised one thing and the Requests row — which
 * renders the server's own `expiresAt` — said another about the same
 * invitation.
 */
export const INVITE_EXPIRY_DAYS = 30;

/**
 * Length ceiling on the note that goes out with an email invitation, and the
 * field's `maxlength`. Named rather than inline so the two cannot drift: a
 * server limit below it rejects a note the coach was told was fine, and one
 * above it makes the counter decoration. Same contract as `NOTES_MAX_LENGTH`.
 */
export const INVITE_MESSAGE_MAX_LENGTH = 500;

/**
 * Where an email invite's link lands. Built on the web app's address, never
 * `window.location` — inside the WebView that is `capacitor://localhost`.
 */
export function inviteLink(token: string): string {
  return `${SIGNUP_URL}?token=${encodeURIComponent(token)}`;
}

/**
 * Whether what is typed is an attempt at an address rather than a name.
 *
 * Deliberately loose: it only has to decide whether to show the email section
 * at all. `ana@` is an attempt and gets the section plus the reason it is not
 * valid yet; `ana popescu` is not, and gets no email door however long it
 * grows. The `@` must have a local part before it, so `@motionhive` reads as
 * a handle rather than a broken address.
 */
export function isEmailQuery(query: string): boolean {
  const term = query.trim();
  if (/\s/.test(term)) return false;
  return term.indexOf('@') >= 1;
}

/**
 * The address to invite, or null while it is not one yet.
 *
 * Trimmed but never lowercased: the BE normalises, and a UI that rewrites what
 * someone typed looks like it misheard them. The 254-character ceiling comes
 * from `isValidEmail`, so this can never offer an address `@IsEmail()` refuses.
 */
export function inviteEmail(query: string): string | null {
  const term = query.trim();
  return isValidEmail(term) ? term : null;
}

/** Where a result row is in its one-tap send. */
export const InviteRowStates = {
  Idle: 'idle',
  Sending: 'sending',
  Invited: 'invited',
} as const;

export type InviteRowState = (typeof InviteRowStates)[keyof typeof InviteRowStates];

/**
 * The state of one result row.
 *
 * `Invited` outranks `Sending` on purpose: a response landing after the set
 * has been written would otherwise put a row that is demonstrably done back
 * into "Sending" and leave it there.
 */
export function inviteRowState(
  userId: string,
  invited: ReadonlySet<string>,
  sending: string | null,
): InviteRowState {
  if (invited.has(userId)) return InviteRowStates.Invited;
  if (sending === userId) return InviteRowStates.Sending;
  return InviteRowStates.Idle;
}

/**
 * The API refusing an invitation because one is already outstanding.
 *
 * Worth telling apart from a real failure: the row should settle on "Invited",
 * which is the truth, rather than staying on a button that will keep failing.
 * It matters because the people search may not exclude PENDING relationships,
 * so an already-invited person can come back in a later result set.
 */
export function isDuplicateInvite(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: unknown }).status === 409
  );
}
