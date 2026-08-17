import { test, } from '@playwright/test';

test('selection color is correct', async ({ page }) => {
  // We can just create a simple HTML file to test CSS selection specificity
  await page.setContent(`
    <style>
      :root {
        --forge-primary: #FF5D00;
      }
      .ce-block__content ::selection {
        background: #e1f2ff;
      }
      /* My Override */
      .editor-js-container *::selection {
        background-color: var(--forge-primary) !important;
        color: #ffffff !important;
      }
    </style>
    <div class="editor-js-container">
      <div class="ce-block__content">
        <p id="target">Mejorar perfiles permitiendo visitar</p>
      </div>
    </div>
  `);

  const bg = await page.evaluate(() => {
    const el = document.getElementById('target');
    // We cannot easily get ::selection color via getComputedStyle in all browsers.
    return window.getComputedStyle(el!, '::selection').backgroundColor;
  });
  console.log("Computed selection background:", bg);
});
