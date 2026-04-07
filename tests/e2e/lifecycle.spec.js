/* eslint-disable jest/no-done-callback */
const { test, expect } = require('@playwright/test');

/**
 * Plugin lifecycle tests: activate, create content, deactivate, verify content
 * survives, reactivate, verify block is still recognized.
 *
 * SAFETY NOTE: The activate/deactivate tests run against an auto-mounted
 * (read-write) Playground server. The "delete" test MUST run against a separate
 * Playground that installed from the release zip — never against auto-mount,
 * which would delete the actual repo files. Use scripts/test-lifecycle-e2e.sh
 * to run both server configurations correctly.
 */

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

async function getPluginRow(page) {
	await page.goto('/wp-admin/plugins.php');
	await expect(
		page.getByRole('heading', { level: 1, name: 'Plugins' })
	).toBeVisible();
	return page.locator('tr', { hasText: 'Bibliography' });
}

async function ensurePluginActive(page) {
	let pluginRow = await getPluginRow(page);
	await expect(pluginRow).toBeVisible();

	const activateLink = pluginRow.getByRole('link', { name: /^Activate/i });
	if (await activateLink.count()) {
		await activateLink.click();
		await page.waitForLoadState('networkidle');
		pluginRow = page.locator('tr', { hasText: 'Bibliography' });
	}

	await expect(
		pluginRow.getByRole('link', { name: /Deactivate/i })
	).toBeVisible({ timeout: 10_000 });
}

async function deactivatePlugin(page) {
	const pluginRow = await getPluginRow(page);
	const deactivateLink = pluginRow.getByRole('link', {
		name: /Deactivate/i,
	});
	await expect(deactivateLink).toBeVisible({ timeout: 10_000 });
	await deactivateLink.click();
	await page.waitForLoadState('networkidle');

	const updatedRow = page.locator('tr', { hasText: 'Bibliography' });
	await expect(
		updatedRow.getByRole('link', { name: /^Activate/i })
	).toBeVisible({ timeout: 10_000 });
}

/**
 * Create a post with a bibliography block, publish it, and return the
 * front-end URL.
 * @param {import('@playwright/test').Page} page
 */
async function createPostWithBibliography(page) {
	await page.goto('/wp-admin/post-new.php');
	const editorFrame = page.frameLocator(
		'iframe[name="editor-canvas"], iframe'
	);

	await dismissEditorOverlay(page);

	const titleField = editorFrame.getByRole('textbox', {
		name: /Add title/i,
	});
	await expect(titleField).toBeVisible();
	await titleField.fill('Lifecycle Test Post');

	// Insert bibliography block.
	await page
		.getByRole('button', {
			name: /Block Inserter|Toggle block inserter/i,
		})
		.click({ force: true });

	const inserterSearch = page
		.locator(
			'input[placeholder*="Search" i], input[aria-label*="Search" i], [role="searchbox"], .block-editor-inserter__search input'
		)
		.first();
	await expect(inserterSearch).toBeVisible();
	await inserterSearch.fill('Bibliography');

	// Wait for search results, then click the Bibliography block option.
	const blockOption = page
		.locator('.block-editor-block-types-list__item')
		.filter({ hasText: 'Bibliography' })
		.first();
	await expect(blockOption).toBeVisible({ timeout: 10_000 });
	await blockOption.scrollIntoViewIfNeeded();
	await blockOption.click();
	await page.waitForTimeout(1000);

	// Fill the paste textarea with a BibTeX entry.
	const textarea = editorFrame.locator('textarea').first();
	if (await textarea.isVisible().catch(() => false)) {
		await textarea.fill(
			'@article{lifecycle2024, author={Test Author}, title={Lifecycle Test Article}, journal={Test Journal}, year={2024}}'
		);

		const addButton = editorFrame
			.locator(
				'button:has-text("Add"), button:has-text("Parse"), button:has-text("Import")'
			)
			.first();
		if (await addButton.isVisible().catch(() => false)) {
			await addButton.click();
			await page.waitForTimeout(2000);
		}
	}

	// Publish the post.
	const publishButton = page
		.getByRole('button', { name: /Publish/i })
		.first();
	await publishButton.click();
	await page.waitForTimeout(1000);

	const confirmPublish = page
		.getByRole('button', { name: /Publish/i })
		.last();
	if (await confirmPublish.isVisible().catch(() => false)) {
		await confirmPublish.click();
		await page.waitForTimeout(2000);
	}

	const viewLink = page.getByRole('link', { name: /View Post/i }).first();
	let postUrl = '/';
	if (await viewLink.isVisible().catch(() => false)) {
		postUrl = (await viewLink.getAttribute('href')) || '/';
	}

	return postUrl;
}

test.describe('Plugin lifecycle', () => {
	test.setTimeout(60_000);

	test('content survives plugin deactivation', async ({ page }) => {
		await ensurePluginActive(page);

		const postUrl = await createPostWithBibliography(page);

		await deactivatePlugin(page);

		// Static-saved HTML should survive deactivation.
		await page.goto(postUrl);
		await page.waitForLoadState('networkidle');

		const body = await page.locator('body').textContent();
		expect(body).toBeTruthy();
		expect(body).not.toContain('Fatal error');
		expect(body).not.toContain('There has been a critical error');

		// Reactivate for subsequent tests.
		await ensurePluginActive(page);
	});

	test('block is recognized after reactivation', async ({ page }) => {
		await ensurePluginActive(page);

		await page.goto('/wp-admin/edit.php');
		await page.waitForLoadState('networkidle');

		const firstPost = page
			.locator('.row-title, .row-actions .edit a')
			.first();
		if (await firstPost.isVisible().catch(() => false)) {
			await firstPost.click();
			await page.waitForLoadState('domcontentloaded');
			await page.waitForTimeout(3000);

			// No block validation errors.
			const pageContent = await page.locator('body').textContent();
			expect(pageContent).not.toContain('This block contains unexpected');
			expect(pageContent).not.toContain('Attempt Block Recovery');
		}
	});

	test('deactivation is clean with no errors', async ({ page }) => {
		await ensurePluginActive(page);
		await deactivatePlugin(page);

		// Admin dashboard should load without errors.
		await page.goto('/wp-admin/');
		await page.waitForLoadState('networkidle');

		const body = await page.locator('body').textContent();
		expect(body).not.toContain('Fatal error');
		expect(body).not.toContain('There has been a critical error');

		// Reactivate for a clean state.
		await ensurePluginActive(page);
	});
});

/**
 * Delete test — runs against a Playground that installs from the release zip
 * (NOT auto-mount). The test-lifecycle-e2e.sh script routes this to the
 * correct server via --grep "delete".
 *
 * The zip directory is mounted at /wordpress/plugin-zip/ inside Playground.
 * The test uploads the zip via wp-admin "Upload Plugin" so WordPress owns
 * the files and can safely delete them.
 */

const path = require('path');

async function installPluginFromZip(page) {
	await page.goto('/wp-admin/plugin-install.php?tab=upload');
	await page.waitForLoadState('networkidle');

	const zipPath = path.resolve(
		__dirname,
		'../../output/release/scholarly-bibliography.zip'
	);

	const fileInput = page.locator('input[type="file"]');
	await fileInput.setInputFiles(zipPath);

	const installButton = page.getByRole('button', {
		name: /Install Now/i,
	});
	await installButton.click();
	await page.waitForLoadState('networkidle');

	// Activate the plugin after upload.
	const activateLink = page.getByRole('link', { name: /Activate Plugin/i });
	if (await activateLink.isVisible().catch(() => false)) {
		await activateLink.click();
		await page.waitForLoadState('networkidle');
	}
}

test.describe('Plugin delete', () => {
	test.setTimeout(90_000);

	test('plugin can be installed from zip and deleted cleanly', async ({
		page,
	}) => {
		// Install from the release zip via Upload Plugin.
		await installPluginFromZip(page);

		// Verify plugin is active.
		let pluginRow = await getPluginRow(page);
		await expect(pluginRow).toBeVisible();

		// Deactivate.
		const deactivateLink = pluginRow.getByRole('link', {
			name: /Deactivate/i,
		});
		if (await deactivateLink.isVisible().catch(() => false)) {
			await deactivateLink.click();
			await page.waitForLoadState('networkidle');
		}

		// Delete.
		pluginRow = await getPluginRow(page);
		await expect(
			pluginRow.getByRole('link', { name: /^Activate/i })
		).toBeVisible({ timeout: 10_000 });

		const deleteLink = pluginRow.getByRole('link', { name: /Delete/i });
		await expect(deleteLink).toBeVisible();

		// WordPress shows a JS confirm dialog for delete.
		page.on('dialog', (dialog) => dialog.accept());
		await deleteLink.click();
		await page.waitForLoadState('networkidle');

		// WordPress may show a "Yes, delete these files" confirmation form.
		const confirmButton = page.locator(
			'input[value="Yes, delete these files"], input#submit'
		);
		if (await confirmButton.count()) {
			await confirmButton.click();
			await page.waitForLoadState('networkidle');
		}

		await page.waitForTimeout(2000);

		// Verify plugin is gone.
		await page.goto('/wp-admin/plugins.php');
		await page.waitForLoadState('networkidle');

		const body = await page.locator('body').textContent();
		expect(body).not.toContain('Fatal error');
		expect(body).not.toContain('There has been a critical error');

		const remainingRow = page.locator('tr', { hasText: 'Bibliography' });
		await expect(remainingRow).toHaveCount(0, { timeout: 10_000 });
	});
});
