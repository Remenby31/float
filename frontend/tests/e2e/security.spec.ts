import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Run against the production-like Caddy stack, not the Vite development server.
test.skip(process.env.FLOAT_E2E_SECURITY_HEADERS !== '1', 'Enable when testing the deployed Caddy configuration');

test('serves the login page with restrictive browser security headers', async ({ page }) => {
  const response = await page.goto('/login');
  expect(response?.status()).toBe(200);
  const headers = response!.headers();
  expect(headers['content-security-policy']).toContain("script-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('no-referrer');
  await expect(page.getByRole('textbox', { name: 'email' })).toBeVisible();
});

test('rejects tokens signed with the former documented fallback key', async ({ request }) => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: '00000000-0000-0000-0000-000000000000',
    exp: Math.floor(Date.now() / 1000) + 60,
  })}`;
  const signature = createHmac('sha256', 'change-me-in-production').update(unsigned).digest('base64url');
  const response = await request.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${unsigned}.${signature}` },
  });
  expect(response.status()).toBe(401);
});
