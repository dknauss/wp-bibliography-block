/* eslint-disable jest/no-done-callback */
const { test, expect } = require('@playwright/test');

async function ensurePluginActivated(page) {
	await page.goto('/wp-admin/plugins.php');
	await expect(
		page.getByRole('heading', { level: 1, name: 'Plugins' })
	).toBeVisible();

	const pluginRow = page.locator('tr', {
		hasText: 'Bibliography',
	});

	await expect(pluginRow).toBeVisible();

	const activateLink = pluginRow.getByRole('link', { name: 'Activate' });

	if (await activateLink.count()) {
		await activateLink.click();
		await page.waitForLoadState('networkidle');
	}

	await expect(pluginRow).toContainText('Bibliography');
	await expect(
		pluginRow.getByRole('link', { name: /Activate|Deactivate/i }).first()
	).toBeVisible();
}

test('plugin is active in WordPress Playground', async ({ page }) => {
	await ensurePluginActivated(page);

	await expect(page.locator('tr', { hasText: 'Bibliography' })).toBeVisible();
});

async function dismissEditorOverlay(page) {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const dialog = page.getByRole('dialog').first();
		const dialogCloseButton = dialog
			.getByRole('button', {
				name: /Close|Dismiss|Got it|Okay|OK|Done|Skip/i,
			})
			.first();

		if (
			(await dialog.isVisible().catch(() => false)) &&
			(await dialogCloseButton.isVisible().catch(() => false))
		) {
			await dialogCloseButton.click({ force: true });
			await dialog
				.waitFor({ state: 'hidden', timeout: 5000 })
				.catch(() => {});
		}

		await page.keyboard.press('Escape').catch(() => {});

		const overlay = page.locator('.components-modal__screen-overlay');
		if (!(await overlay.count())) {
			return;
		}

		await overlay
			.first()
			.waitFor({ state: 'hidden', timeout: 2000 })
			.catch(() => {});
	}
}

test('bibliography block is discoverable in the editor inserter', async ({
	page,
}) => {
	await ensurePluginActivated(page);
	await page.goto('/wp-admin/post-new.php');
	const editorFrame = page.frameLocator(
		'iframe[name="editor-canvas"], iframe'
	);

	await dismissEditorOverlay(page);

	await expect(
		editorFrame.getByRole('textbox', { name: /Add title/i })
	).toBeVisible();
	await page
		.getByRole('button', { name: 'Block Inserter' })
		.click({ force: true });
	await page.getByRole('searchbox').fill('Bibliography');
	await expect(page.getByText('Bibliography')).toBeVisible();
});
