import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('preview supports discovery and accessible studio', async ({page}) => {
 await page.goto('/');
 await expect(page.getByText('Desktop connection unavailable.')).toBeVisible();
 await page.getByRole('button',{name:/The Wildwood/}).click();
 await expect(page.getByRole('heading',{name:'The Wildwood'})).toBeVisible();
 await page.getByRole('button',{name:'Make it mine'}).click();
 await expect(page.getByRole('heading',{name:'Make it yours.'})).toBeVisible();
 await page.getByLabel('Enemy health').fill('1.5');
 await expect(page.getByText('150%')).toBeVisible();
 await page.getByRole('button',{name:'Build my change'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toBeHidden();
 const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
 expect(results.violations).toEqual([]);
});

test('narrow preview navigation and unavailable action', async ({page}) => {
 await page.setViewportSize({width:390,height:844}); await page.goto('/');
 await page.getByRole('button',{name:'Toggle navigation'}).click();
 await page.getByRole('button',{name:'My library'}).click();
 await expect(page.getByRole('heading',{name:'My library.'})).toBeVisible();
 await page.getByRole('button',{name:'Import project'}).click();
 await expect(page.getByRole('status')).toContainText('Desktop connection unavailable');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
