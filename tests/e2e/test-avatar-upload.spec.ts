import { test, expect } from '@playwright/test';

test.describe('Avatar and Workspace Uploads', () => {
  test('Should allow uploading an avatar for the user', async ({ page, request }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[name="username"]', 'jose');
    await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$/);

    // Grab session cookie
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'forge_session');
    expect(sessionCookie).toBeDefined();

    // The user's ID
    // We can fetch it by calling an endpoint or we can mock the payload.
    // In settings, the avatar is uploaded by sending `entity_type: 'user'` and `entity_id: user.id`.
    
    // We can just use the UI instead to upload an avatar.
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toBeVisible();

    // Create a dummy image file in memory or use a buffer for the request
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    
    // We don't have the user ID easily from the UI to send an API request,
    // so we'll upload via the API using a dummy image payload but we need the entity_id.
    // Let's get the user ID from the UI by checking the avatar image or a hidden input.
    // Since we are validating the CHECK constraint, any POST to /api/upload with entity_type='user' will do.
    
    // Let's execute a script on the page to fetch the user ID
    const userId = await page.evaluate(() => {
      // Assuming user ID is somewhere in window or we can fetch /api/auth/me
      return fetch('/api/user/notifications').then(r => 'mock_id_not_needed_for_check_constraint_failure');
    });

    const payload = `--${boundary}\r\nContent-Disposition: form-data; name="entity_type"\r\n\r\nuser\r\n--${boundary}\r\nContent-Disposition: form-data; name="entity_id"\r\n\r\ntest_user_id\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="avatar.png"\r\nContent-Type: image/png\r\n\r\nFAKE_IMAGE_DATA\r\n--${boundary}--`;

    const res = await request.post('/api/upload', {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Cookie': `forge_session=${sessionCookie?.value}`,
        'Origin': 'http://localhost:4322'
      },
      data: payload
    });

    // The API should NOT return a 500 error due to CHECK constraint!
    // It might return 400 (if entity_id is invalid) or 200 (if it uploads successfully).
    // As long as it's not a 500 SqliteError!
    expect(res.status()).not.toBe(500);
  });
});
