/* eslint-disable jest/no-done-callback */
const { test, expect } = require('@playwright/test');

async function ensurePluginActivated(page) {
	await page.goto('/wp-admin/plugins.php');
	await expect(
		page.getByRole('heading', { level: 1, name: 'Plugins' })
	).toBeVisible();

	const pluginRow = page.locator('tr', {
		hasText: 'Scholarly Bibliography',
	});

	await expect(pluginRow).toBeVisible();

	const activateLink = pluginRow.getByRole('link', { name: 'Activate' });

	if (await activateLink.count()) {
		await activateLink.click();
		await page.waitForLoadState('networkidle');
	}

	await expect(pluginRow).toContainText('Scholarly Bibliography');
	await expect(
		pluginRow.getByRole('link', { name: /Activate|Deactivate/i }).first()
	).toBeVisible();
}

test('plugin is active in WordPress Playground', async ({ page }) => {
	await ensurePluginActivated(page);

	await expect(
		page.locator('tr', { hasText: 'Scholarly Bibliography' })
	).toBeVisible();
});

test('bibliography block is discoverable in the editor inserter', async ({
	page,
}) => {
	await ensurePluginActivated(page);
	await page.goto('/wp-admin/post-new.php');
	const editorFrame = page.frameLocator(
		'iframe[name="editor-canvas"], iframe'
	);

	const closeWelcomeButton = page.getByRole('button', { name: 'Close' });

	if (await closeWelcomeButton.count()) {
		await closeWelcomeButton.click();
	}

	await expect(
		editorFrame.getByRole('textbox', { name: /Add title/i })
	).toBeVisible();
	await page.getByRole('button', { name: 'Block Inserter' }).click();
	await page.getByRole('searchbox').fill('Bibliography');
	await expect(page.getByText('Bibliography')).toBeVisible();
});
