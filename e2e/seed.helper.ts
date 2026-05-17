import { test, type APIRequestContext, type APIResponse } from '@playwright/test';

/**
 * Assert a seed POST response is OK, or skip the test if the BE throttler
 * rate-limited us (HTTP 429). The cancel/book/create endpoints share a
 * 100 req/60s window in dev — running multiple Playwright tests back-to-back
 * will eventually hit it. Throwing instead of skipping would create noise
 * that hides real product regressions.
 */
export async function expectSeedOk(
  res: APIResponse,
  what: string = 'seed POST',
): Promise<void> {
  if (res.ok()) return;
  const status = res.status();
  const body = await res.text().catch(() => '');
  if (status === 429) {
    test.skip(true, `${what}: BE throttler (429) — wait a minute and re-run`);
  }
  throw new Error(`${what} failed: HTTP ${status} ${body}`);
}

/**
 * Convenience wrapper: POST to the BE with a JSON body + the instructor
 * JWT, returning the parsed response or skipping on 429.
 */
export async function seedJson<T = unknown>(
  request: APIRequestContext,
  url: string,
  token: string,
  data: Record<string, unknown>,
  what?: string,
): Promise<T> {
  const res = await request.post(url, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  await expectSeedOk(res, what);
  return (await res.json()) as T;
}
