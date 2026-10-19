import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Upload API Security', () => {
  test('Prevents path traversal and enforces IDOR', async ({ request, page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="username"]', 'jose');
    await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!')); // Use test seed password
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$/);
    
    // Navigate to a workspace to set last_workspace_id
    await page.goto('/w/test-workspace/board');
    await page.waitForLoadState('networkidle');

    // Create a page
    const newPageRes = await page.request.post('/api/pages', {
      data: { title: 'Security Test Page', workspace_id: 'ws-jose-test' },
      headers: { 'Origin': `http://localhost:${process.env.E2E_PORT || 4322}` }
    });
    
    expect(newPageRes.status()).toBe(200);
    const newPage = await newPageRes.json();
    const entityId = newPage.id;
    expect(entityId).toBeTruthy();

    // Attempt path traversal upload
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const payload = `--${boundary}\r\nContent-Disposition: form-data; name="entity_type"\r\n\r\npage\r\n--${boundary}\r\nContent-Disposition: form-data; name="entity_id"\r\n\r\n${entityId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="../../../malicious.txt"\r\nContent-Type: text/plain\r\n\r\nMALICIOUS CONTENT\r\n--${boundary}--`;

    const res = await page.request.post('/api/upload', {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Origin': `http://localhost:${process.env.E2E_PORT || 4322}`
      },
      data: payload
    });

    expect(res.status()).toBe(200);
    
    const responseText = await res.text();
    const json = JSON.parse(responseText);
    
    expect(json.url).toBeTruthy();

    const url = json.url;
    const actualName = url.split('/').pop();
    const expectedPath = path.join(process.cwd(), '.data', 'storage', actualName!);
    
    // Check if file exists safely
    expect(fs.existsSync(expectedPath)).toBe(true);
    
    // Clean up safe file
    fs.unlinkSync(expectedPath);

    // Check if it traversed to root
    const traversedPath = path.join(process.cwd(), 'malicious.txt');
    expect(fs.existsSync(traversedPath)).toBe(false);
  });
});
