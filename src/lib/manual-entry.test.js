import {
	buildManualCsl,
	createEmptyManualEntryFields,
	createManualCitation,
	MANUAL_ENTRY_TYPE_OPTIONS,
	validateManualEntry,
} from './manual-entry';

jest.mock('./formatting/csl', () => ({
	formatBibliographyEntry: jest.fn(
		(csl, styleKey) => `${styleKey}:${csl.title || 'Formatted'}`
	),
}));

describe('manual-entry', () => {
	let originalCrypto;

	beforeEach(() => {
		originalCrypto = global.crypto;
		Object.defineProperty(global, 'crypto', {
			configurable: true,
			value: {
				...originalCrypto,
				randomUUID: jest.fn(() => 'manual-uuid'),
			},
		});
	});

	afterEach(() => {
		Object.defineProperty(global, 'crypto', {
			configurable: true,
			value: originalCrypto,
		});
	});

	it('exposes the curated manual-entry type list', () => {
		expect(MANUAL_ENTRY_TYPE_OPTIONS.map((option) => option.value)).toEqual(
			[
				'book',
				'article-journal',
				'chapter',
				'collection',
				'thesis',
				'webpage',
			]
		);
	});

	it('creates empty manual fields with an optional preserved type', () => {
		expect(createEmptyManualEntryFields('book')).toMatchObject({
			type: 'book',
			title: '',
			authors: '',
		});
	});

	it('requires type and title only', () => {
		expect(validateManualEntry({ type: '', title: '' })).toBe(
			'Choose a publication type before adding.'
		);
		expect(validateManualEntry({ type: 'book', title: '' })).toBe(
			'Enter a title before adding.'
		);
		expect(
			validateManualEntry({ type: 'book', title: 'Example' })
		).toBeNull();
	});

	it('maps curated manual types to the expected CSL shapes', () => {
		const expectations = [
			['book', 'author'],
			['article-journal', 'author'],
			['chapter', 'author'],
			['collection', 'editor'],
			['thesis', 'author'],
			['webpage', 'author'],
		];

		for (const [type, contributorKey] of expectations) {
			const csl = buildManualCsl({
				type,
				title: 'Example title',
				authors: 'Smith, Ada; Scholar, Jane',
			});

			expect(csl.type).toBe(type);
			expect(csl.title).toBe('Example title');
			expect(csl[contributorKey]).toEqual([
				{ family: 'Smith', given: 'Ada' },
				{ family: 'Scholar', given: 'Jane' },
			]);
		}
	});

	it('builds sparse manual CSL records with only required data', () => {
		const csl = buildManualCsl({
			type: 'webpage',
			title: 'Only a Title',
		});

		expect(csl).toEqual({
			type: 'webpage',
			title: 'Only a Title',
		});
	});

	it('returns sanitized manual CSL output', () => {
		const csl = buildManualCsl({
			type: 'collection',
			title: 'Edited Volume',
			authors: 'Scholar, Jane',
			doi: '10.1234/edited-volume',
		});

		expect(csl).toEqual({
			type: 'collection',
			title: 'Edited Volume',
			editor: [{ family: 'Scholar', given: 'Jane' }],
			DOI: '10.1234/edited-volume',
		});
	});

	it('ignores invalid years and maps DOI/URL/page fields when present', () => {
		const csl = buildManualCsl({
			type: 'article-journal',
			title: 'Example title',
			year: '20AB',
			page: '117-134',
			doi: '10.1234/example-doi',
			url: 'https://example.com',
		});

		expect(csl).toMatchObject({
			type: 'article-journal',
			title: 'Example title',
			page: '117-134',
			DOI: '10.1234/example-doi',
			URL: 'https://example.com',
		});
		expect(csl).not.toHaveProperty('issued');
	});

	it('creates a full manual citation entry compatible with the save pipeline', async () => {
		const entry = await createManualCitation(
			{
				type: 'book',
				title: 'Example title',
				authors: 'Smith, Ada',
				year: '2024',
			},
			'apa-7'
		);

		expect(entry).toMatchObject({
			id: 'manual-uuid',
			csl: {
				type: 'book',
				title: 'Example title',
				author: [{ family: 'Smith', given: 'Ada' }],
				issued: {
					'date-parts': [[2024]],
				},
			},
			formattedText: 'apa-7:Example title',
			displayOverride: null,
			inputFormat: 'manual',
			parseWarnings: [],
		});
	});
});
