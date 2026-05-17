import jwt from 'jsonwebtoken';
import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Auth shim for the e2e suite — skips the login UI by seeding
 * `localStorage` directly with a valid JWT + user object. Matches the
 * shape `TokenService.setUser/setAccessToken` writes during a real login.
 */

const API_REPO = '/Users/ionutbutnaru/Documents/mystuff/beeactive-api';

function readJwtSecret(): string {
  const envPath = path.join(API_REPO, '.env');
  const env = fs.readFileSync(envPath, 'utf-8');
  const m = env.match(/^JWT_SECRET=(.+)$/m);
  if (!m) throw new Error('JWT_SECRET not found in API .env');
  return m[1].trim();
}

export interface SeededUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export const INSTRUCTOR_FIXTURE: SeededUser = {
  id: '2762e1d6-8a6d-4fc4-9aa0-2ff24106018c',
  email: 'instructor@motionhive.fit',
  firstName: 'Test',
  lastName: 'Instructor',
  roles: ['INSTRUCTOR', 'USER'],
};

export const USER_FIXTURE: SeededUser = {
  id: '570ea197-4ac0-4e58-a8c1-bff06c6f945f',
  email: 'user@motionhive.fit',
  firstName: 'Test',
  lastName: 'User',
  roles: ['USER'],
};

export function mintToken(user: SeededUser): string {
  const secret = readJwtSecret();
  return jwt.sign({ sub: user.id, email: user.email }, secret, {
    expiresIn: '2h',
  });
}

/**
 * Seed localStorage so `AuthService.checkAuthStatus()` rehydrates as a
 * logged-in instructor on first nav.
 *
 * Must be called via `page.addInitScript` BEFORE the first `page.goto`,
 * because Angular reads from localStorage during app bootstrap.
 */
export async function loginAs(page: Page, user: SeededUser) {
  return seedAuth(page, user);
}

export async function loginAsUser(page: Page) {
  return seedAuth(page, USER_FIXTURE);
}

export async function loginAsInstructor(page: Page, user: SeededUser = INSTRUCTOR_FIXTURE) {
  return seedAuth(page, user);
}

async function seedAuth(page: Page, user: SeededUser) {
  const token = mintToken(user);
  const userPayload = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles,
    permissions: [],
    isEmailVerified: true,
  };
  await page.addInitScript(
    ({ token, userPayload, roles }) => {
      localStorage.setItem('motionhive_access_token', token);
      localStorage.setItem('motionhive_refresh_token', token);
      localStorage.setItem('motionhive_user', JSON.stringify(userPayload));
      localStorage.setItem('motionhive_roles', JSON.stringify(roles));
      localStorage.setItem('motionhive_permissions', JSON.stringify([]));
    },
    { token, userPayload, roles: user.roles },
  );
}
