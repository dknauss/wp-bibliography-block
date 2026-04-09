import {
	DEFAULT_CITATION_STYLE,
	getListSemantics,
	getSelectableStyles,
	getStyleDefinition,
} from './style-registry';

describe('style registry', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('returns the default Chicago definition for unknown style keys', () => {
		const warnSpy = jest
			.spyOn(console, 'warn')
			.mockImplementation(() => {});

		expect(getStyleDefinition('unknown-style').key).toBe(
			DEFAULT_CITATION_STYLE
		);
		expect(warnSpy).toHaveBeenCalledWith(
			`Unknown citation style "unknown-style". Falling back to ${DEFAULT_CITATION_STYLE}.`
		);
	});

	it('maps author-date and numeric styles to the right list semantics', () => {
		expect(getListSemantics('chicago-author-date')).toBe('ul');
		expect(getListSemantics('apa-7')).toBe('ul');
		expect(getListSemantics('chicago-notes-bibliography')).toBe('ul');
		expect(getListSemantics('ieee')).toBe('ol');
		expect(getListSemantics('vancouver')).toBe('ol');
	});

	it('exposes all currently enabled styles for selection', () => {
		expect(getSelectableStyles()).toEqual([
			{
				label: 'Chicago Notes-Bibliography',
				value: 'chicago-notes-bibliography',
			},
			{
				label: 'Chicago Author-Date',
				value: 'chicago-author-date',
			},
			{
				label: 'APA 7',
				value: 'apa-7',
			},
			{
				label: 'MLA 9',
				value: 'mla-9',
			},
			{
				label: 'Harvard',
				value: 'harvard',
			},
			{
				label: 'IEEE',
				value: 'ieee',
			},
			{
				label: 'Vancouver',
				value: 'vancouver',
			},
			{
				label: 'OSCOLA',
				value: 'oscola',
			},
			{
				label: 'ABNT',
				value: 'abnt',
			},
		]);
	});
});
