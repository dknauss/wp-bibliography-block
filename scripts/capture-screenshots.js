/* eslint-disable no-console, import/no-extraneous-dependencies, curly */
/**
 * Capture fresh screenshots for the WordPress plugin directory and GitHub README.
 *
 * Usage: PLAYWRIGHT_BASE_URL=http://127.0.0.1:9401 node scripts/capture-screenshots.js
 */

const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:9401';
const OUTPUT_DIR = path.resolve(__dirname, '../.wordpress-org');

const SAMPLE_BIBTEX = [
	'@article{smith2024,',
	'  author = {Smith, Ada and Jones, Brian},',
	'  title = {Advances in Citation Management for Academic Publishing},',
	'  journal = {Journal of Digital Scholarship},',
	'  year = {2024},',
	'  volume = {12},',
	'  number = {3},',
	'  pages = {117--134},',
	'  doi = {10.1234/jds.2024.0042}',
	'}',
	'',
	'@book{williams2023,',
	'  author = {Williams, Carol},',
	'  title = {The Oxford Handbook of Research Methods},',
	'  publisher = {Oxford University Press},',
	'  year = {2023},',
	'  address = {Oxford},',
	'  isbn = {978-0-19-123456-7}',
	'}',
	'',
	'@inbook{chen2022,',
	'  author = {Chen, David},',
	'  title = {Statistical Approaches to Literature Review},',
	'  booktitle = {Methods in Modern Scholarship},',
	'  editor = {Taylor, Elena},',
	'  publisher = {Cambridge University Press},',
	'  year = {2022},',
	'  pages = {45--78}',
	'}',
].join('\n');

async function dismissEditorOverlay(page) {
	for (let attempt = 0; attempt < 5; attempt++) {
		const dialog = page.getByRole('dialog').first();
		const closeBtn = dialog
			.getByRole('button', {
				name: /Close|Dismiss|Got it|Okay|OK|Done|Skip/i,
			})
			.first();

		if (
			(await dialog.isVisible().catch(() => false)) &&
			(await closeBtn.isVisible().catch(() => false))
		) {
			await closeBtn.click({ force: true });
			await dialog
				.waitFor({ state: 'hidden', timeout: 5000 })
				.catch(() => {});
		}
		await page.keyboard.press('Escape').catch(() => {});

		const overlay = page.locator('.components-modal__screen-overlay');
		if (!(await overlay.count())) return;
		await overlay
			.first()
			.waitFor({ state: 'hidden', timeout: 2000 })
			.catch(() => {});
	}
}

async function ensurePluginActive(page) {
	await page.goto(`${BASE_URL}/wp-admin/plugins.php`);
	await page.waitForLoadState('networkidle');
	const row = page.locator('tr', { hasText: 'Bibliography' });
	const activateLink = row.getByRole('link', { name: /^Activate/i });
	if (await activateLink.count()) {
		await activateLink.click();
		await page.waitForLoadState('networkidle');
	}
}

(async () => {
	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: { width: 1280, height: 900 },
	});
	const page = await context.newPage();

	await ensurePluginActive(page);

	// Navigate to new post.
	await page.goto(`${BASE_URL}/wp-admin/post-new.php`);
	const editorFrame = page.frameLocator(
		'iframe[name="editor-canvas"], iframe'
	);
	await dismissEditorOverlay(page);
	await editorFrame
		.getByRole('textbox', { name: /Add title/i })
		.waitFor({ state: 'visible', timeout: 15000 });

	// Set a title.
	await editorFrame
		.getByRole('textbox', { name: /Add title/i })
		.fill('Sample Bibliography');

	// --- Screenshot 1: Block in the inserter ---
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
	await inserterSearch.waitFor({ state: 'visible' });
	await inserterSearch.fill('Bibliography');
	// Wait for results to fully load.
	const blockOption = page
		.locator('.block-editor-block-types-list__item')
		.filter({ hasText: 'Bibliography' })
		.first();
	await blockOption.waitFor({ state: 'visible', timeout: 10000 });
	await page.waitForTimeout(500);
	await page.screenshot({ path: `${OUTPUT_DIR}/screenshot-1.png` });
	console.log('Screenshot 1: Block inserter');

	// Insert the block.
	await blockOption.scrollIntoViewIfNeeded();
	await blockOption.click();
	await page.waitForTimeout(2000);

	// Close the inserter panel.
	const closeInserter = page
		.getByRole('button', {
			name: /Block Inserter|Toggle block inserter/i,
		})
		.first();
	if (await closeInserter.isVisible().catch(() => false)) {
		await closeInserter.click();
		await page.waitForTimeout(500);
	}

	// --- Screenshot 2: Empty paste/import form ---
	await page.screenshot({ path: `${OUTPUT_DIR}/screenshot-2.png` });
	console.log('Screenshot 2: Paste/import form (empty state)');

	// Paste BibTeX and add citations.
	const textarea = editorFrame.locator('textarea').first();
	await textarea.waitFor({ state: 'visible', timeout: 5000 });
	await textarea.fill(SAMPLE_BIBTEX);
	await page.waitForTimeout(500);

	const addButton = editorFrame
		.locator(
			'button:has-text("Add"), button:has-text("Parse"), button:has-text("Import")'
		)
		.first();
	await addButton.click();
	// Wait for citations to be parsed and rendered.
	await page.waitForTimeout(4000);

	// --- Screenshot 3: Editor with populated citations and manual entry form ---
	// Switch to manual entry to show the form.
	let manualTab = editorFrame
		.getByRole('button', { name: /Manual Entry/i })
		.first();
	if (!(await manualTab.isVisible().catch(() => false))) {
		manualTab = page.getByRole('button', { name: /Manual Entry/i }).first();
	}
	if (await manualTab.isVisible().catch(() => false)) {
		await manualTab.click();
		await page.waitForTimeout(1000);
	}
	await page.screenshot({ path: `${OUTPUT_DIR}/screenshot-3.png` });
	console.log('Screenshot 3: Manual entry form with existing citations');

	// Switch back to paste/import for the sidebar screenshot.
	let pasteTab = editorFrame
		.getByRole('button', { name: /Paste.*Import/i })
		.first();
	if (!(await pasteTab.isVisible().catch(() => false))) {
		pasteTab = page.getByRole('button', { name: /Paste.*Import/i }).first();
	}
	if (await pasteTab.isVisible().catch(() => false)) {
		await pasteTab.click();
		await page.waitForTimeout(500);
	}

	// --- Screenshot 4: Block settings sidebar ---
	// Open the settings panel (right sidebar).
	const settingsButton = page
		.getByRole('button', { name: /^Settings$/i })
		.first();
	if (await settingsButton.isVisible().catch(() => false)) {
		await settingsButton.click();
		await page.waitForTimeout(500);
	}

	// Switch to Block tab in the settings sidebar.
	const blockTab = page.locator(
		'.edit-post-sidebar__panel-tabs button, [aria-label="Block"]'
	);
	for (let i = 0; i < (await blockTab.count()); i++) {
		const text = await blockTab.nth(i).textContent();
		if (/block/i.test(text)) {
			await blockTab.nth(i).click();
			await page.waitForTimeout(500);
			break;
		}
	}

	await page.screenshot({ path: `${OUTPUT_DIR}/screenshot-4.png` });
	console.log('Screenshot 4: Block settings sidebar with citations');

	// --- Publish the post ---
	const publishButton = page
		.getByRole('button', { name: /^Publish$/i })
		.first();
	await publishButton.click();
	await page.waitForTimeout(1500);

	// Handle the confirmation panel.
	const confirmPublish = page.locator(
		'.editor-post-publish-panel__header-publish-button button, button.editor-post-publish-button'
	);
	for (let i = 0; i < (await confirmPublish.count()); i++) {
		const text = await confirmPublish.nth(i).textContent();
		if (/publish/i.test(text)) {
			await confirmPublish.nth(i).click();
			break;
		}
	}
	await page.waitForTimeout(3000);

	// Find the view post link.
	const viewLinks = page.locator('a');
	let postUrl = null;
	const viewCount = await viewLinks.count();
	for (let i = 0; i < viewCount; i++) {
		const text = await viewLinks
			.nth(i)
			.textContent()
			.catch(() => '');
		const href = await viewLinks
			.nth(i)
			.getAttribute('href')
			.catch(() => '');
		if (/view\s*post/i.test(text) && href) {
			postUrl = href.startsWith('http')
				? href
				: `${BASE_URL}/${href.replace(/^\//, '')}`;
			break;
		}
	}

	// Fallback: find the post via the REST API.
	if (!postUrl) {
		await page.goto(`${BASE_URL}/wp-json/wp/v2/posts?per_page=1`);
		const responseText = await page.locator('body').textContent();
		try {
			const posts = JSON.parse(responseText);
			if (posts.length > 0 && posts[0].link) {
				postUrl = posts[0].link;
			}
		} catch {
			// Ignore parse errors.
		}
	}

	// --- Screenshot 5: Front-end rendered bibliography ---
	if (postUrl) {
		await page.goto(postUrl);
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);
		await page.screenshot({ path: `${OUTPUT_DIR}/screenshot-5.png` });
		console.log('Screenshot 5: Front-end bibliography');
	} else {
		// Last resort: go to the site homepage.
		await page.goto(BASE_URL);
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);
		await page.screenshot({ path: `${OUTPUT_DIR}/screenshot-5.png` });
		console.log(
			'Screenshot 5: Homepage (could not find published post URL)'
		);
	}

	await browser.close();
	console.log(`\nAll screenshots saved to ${OUTPUT_DIR}/`);
})();
