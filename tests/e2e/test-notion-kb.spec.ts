import { test, expect } from '@playwright/test';
import db from '../../src/lib/db';

test('Knowledge Base: Create, auto-save and cascading delete', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('input[name="username"]', 'TestUserNotionA');
  await page.fill('input[name="password"]', (process.env.TEST_PASSWORD || 'LocalDevPass123!'));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/);
  
  // Navigate to KB of ws-notion-a
  await page.goto('/w/notion-ws-a/p');
  
  // Click New Page
  await page.click('#btn-new-root-page');
  
  // Should redirect to the new page id
  await page.waitForURL(/\/w\/notion-ws-a\/p\/.+/);
  
  // Change title and content
  const titleInput = page.locator('#editor-title');
  await page.waitForTimeout(500);
  await titleInput.fill('My First Page');
  
  // Se escribe con el teclado, como una persona. Con Editor.js esto se
  // simulaba metiendo HTML a mano en el bloque; con Tiptap el HTML que se
  // escribe es texto y se guarda como texto.
  const editor = page.locator('#page-editor .ProseMirror');
  await editor.click();
  await page.keyboard.type('Hello world <script>alert(1)</script>');

  // Wait for auto-save (debounce is 1s)
  await expect(page.locator('#save-status')).toHaveText(/^(Saved|Guardado)$/, { timeout: 5000 });

  // Verify in DB
  const pages = db.prepare('SELECT * FROM pages WHERE workspace_id = ? ORDER BY created_at DESC').all('ws-notion-a') as any[];
  expect(pages.length).toBe(1);
  expect(pages[0].title).toBe('My First Page');
  const guardado = JSON.parse(pages[0].content_json);
  expect(guardado.format).toBe('tiptap');
  // El texto se guarda como texto, no como HTML que alguien vaya a interpretar.
  expect(JSON.stringify(guardado.doc)).toContain('Hello world <script>alert(1)</script>');
  // Y en la página se ve como texto: no hay ningún <script> dentro del editor.
  await expect(editor.locator('script')).toHaveCount(0);

  // Título con «# » y el menú «/».
  await page.keyboard.press('Enter');
  await page.keyboard.type('# My Header');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/quo');
  await page.keyboard.press('Enter');
  await page.keyboard.type('una cita');

  await expect(page.locator('#save-status')).toHaveText(/^(Saved|Guardado)$/, { timeout: 6000 });

  const updatedPages = db.prepare('SELECT * FROM pages WHERE id = ?').get(pages[0].id) as any;
  const tipos = JSON.parse(updatedPages.content_json).doc.content.map((b: any) => b.type);
  expect(tipos).toContain('heading');
  expect(tipos).toContain('blockquote');

  const parentId = pages[0].id;

  // Add subpage via UI
  // Hover over the tree item and click the add child button
  // Por su clase de árbol y su id, no por el relleno que tuviera (`pl-4`).
  await page.hover(`li.tree-item[data-page-id="${parentId}"] > .tree-row`);
  await page.click(`.add-child-btn[data-parent-id="${parentId}"]`);
  
  // Should redirect to new subpage
  await page.waitForURL((url) => url.toString().includes('/p/') && !url.toString().endsWith(parentId));
  
  // Verify in DB that it is a child
  const subpages = db.prepare('SELECT * FROM pages WHERE parent_page_id = ?').all(parentId) as any[];
  expect(subpages.length).toBe(1);
  
  // Delete parent page using API directly or UI. Let's navigate back to parent and delete it
  await page.goto(`/w/notion-ws-a/p/${parentId}`);
  
  // El borrado ya no usa el `confirm()` del navegador sino el diálogo de la
  // aplicación. El nativo se puede bloquear tras el primer aviso —el navegador
  // ofrece «impedir que esta página cree más diálogos»— y a partir de ahí el
  // botón dejaba de hacer nada sin decirlo, que es lo que se vio en producción.
  await page.click('#btn-delete-page');
  await page.click('#btn-forge-confirm-ok');
  
  // Should redirect back to /p
  await page.waitForURL(/\/w\/notion-ws-a\/p$/);
  
  // Verify DB cascading delete
  const remainingPages = db.prepare('SELECT * FROM pages WHERE workspace_id = ?').all('ws-notion-a') as any[];
  expect(remainingPages.length).toBe(0); // Parent and child should both be gone!
});
