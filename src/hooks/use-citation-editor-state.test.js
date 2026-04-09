import { act, renderHook } from '@testing-library/react';
import { useCitationEditorState } from './use-citation-editor-state';

// Mock @wordpress/element → React hooks.
jest.mock(
	'@wordpress/element',
	() => {
		const React = require('react');
		return {
			useCallback: React.useCallback,
			useRef: React.useRef,
			useState: React.useState,
		};
	},
	{ virtual: true }
);

// Stub formatting utilities — only the shapes matter here.
jest.mock('../lib/formatting', () => ({
	getAutoFormattedText: jest.fn((citation) => citation.formattedText || ''),
	getDisplayText: jest.fn(
		(citation) => citation.displayOverride || citation.formattedText || ''
	),
	getStyleDefinition: jest.fn(() => ({
		label: 'Chicago Notes-Bibliography',
	})),
}));

jest.mock('../lib/manual-entry', () => ({
	normalizeDoiValue: jest.fn((v) => v || null),
	normalizeUrlValue: jest.fn((v) => v || null),
	validateIdentifierFields: jest.fn(() => null),
}));

jest.mock('../lib/sorter', () => ({
	sortCitations: jest.fn((citations) => citations),
}));

// Intercept the dynamic import('../lib/formatting/csl') used inside the hook.
// Variable must be prefixed with `mock` so Jest's hoisting transform allows
// it to be referenced inside the jest.mock() factory.
let mockFormatBibliographyEntry;

jest.mock('../lib/formatting/csl', () => ({
	get formatBibliographyEntry() {
		return mockFormatBibliographyEntry;
	},
	formatBibliographyEntries: jest.fn((items) =>
		items.map(() => 'Reformatted entry')
	),
}));

// --- Test helpers ---

function makeCitation(overrides = {}) {
	return {
		id: 'cit-1',
		formattedText: 'Smith. A Book. 2024.',
		displayOverride: null,
		parseWarnings: [],
		csl: {
			type: 'book',
			title: 'A Book',
			author: [{ family: 'Smith', given: 'Ada' }],
			issued: { 'date-parts': [[2024]] },
		},
		...overrides,
	};
}

function makeHookArgs(citations = [makeCitation()]) {
	const citationsRef = { current: citations };
	const setAttributes = jest.fn((update) => {
		if (update.citations) {
			citationsRef.current = update.citations;
		}
	});
	const announce = jest.fn();
	const clearNotice = jest.fn();
	const queueFocus = jest.fn();

	return {
		announce,
		clearNotice,
		citationsRef,
		queueFocus,
		setAttributes,
		citationStyle: 'chicago-notes-bibliography',
	};
}

// --- Inline text editing ---

describe('handleEditStart / handleEditConfirm / handleEditCancel', () => {
	it('starts editing by setting editingId and editText', () => {
		const args = makeHookArgs();
		const { result } = renderHook(() => useCitationEditorState(args));

		act(() => result.current.handleEditStart('cit-1'));

		expect(result.current.editingId).toBe('cit-1');
		expect(result.current.editText).toBe('Smith. A Book. 2024.');
		expect(args.announce).toHaveBeenCalledWith(
			'info',
			'Editing citation. Press Escape to cancel.'
		);
	});

	it('does nothing when handleEditStart is called with an unknown id', () => {
		const args = makeHookArgs();
		const { result } = renderHook(() => useCitationEditorState(args));

		act(() => result.current.handleEditStart('nonexistent'));

		expect(result.current.editingId).toBeNull();
	});

	it('confirms edit and writes displayOverride when text differs from auto-format', () => {
		const args = makeHookArgs();
		const { result } = renderHook(() => useCitationEditorState(args));

		act(() => result.current.handleEditStart('cit-1'));
		act(() => result.current.setEditText('Smith. A Book (Revised). 2024.'));
		act(() => result.current.handleEditConfirm());

		expect(args.setAttributes).toHaveBeenCalledWith(
			expect.objectContaining({
				citations: expect.arrayContaining([
					expect.objectContaining({
						id: 'cit-1',
						displayOverride: 'Smith. A Book (Revised). 2024.',
					}),
				]),
			})
		);
		expect(result.current.editingId).toBeNull();
	});

	it('clears displayOverride when confirmed text matches auto-formatted text', () => {
		const citation = makeCitation({ displayOverride: 'Old override' });
		const args = makeHookArgs([citation]);
		const { result } = renderHook(() => useCitationEditorState(args));

		// getAutoFormattedText returns citation.formattedText by default.
		act(() => result.current.handleEditStart('cit-1'));
		act(() => result.current.setEditText('Smith. A Book. 2024.')); // matches formattedText
		act(() => result.current.handleEditConfirm());

		const saved = args.setAttributes.mock.calls[0][0].citations[0];
		expect(saved.displayOverride).toBeNull();
	});

	it('cancels editing and clears state without saving (via Escape key)', () => {
		const args = makeHookArgs();
		const { result } = renderHook(() => useCitationEditorState(args));

		act(() => result.current.handleEditStart('cit-1'));
		act(() => result.current.setEditText('Changed text'));
		act(() =>
			result.current.handleEditKeyDown({
				key: 'Escape',
				preventDefault: jest.fn(),
			})
		);

		expect(result.current.editingId).toBeNull();
		expect(result.current.editText).toBe('');
		expect(args.setAttributes).not.toHaveBeenCalled();
	});

	it('triggers confirm on Enter and cancel on Escape via handleEditKeyDown', () => {
		const args = makeHookArgs();
		const { result } = renderHook(() => useCitationEditorState(args));

		act(() => result.current.handleEditStart('cit-1'));

		const preventDefault = jest.fn();

		act(() =>
			result.current.handleEditKeyDown({
				key: 'Escape',
				preventDefault,
			})
		);
		expect(preventDefault).toHaveBeenCalled();
		expect(result.current.editingId).toBeNull();

		act(() => result.current.handleEditStart('cit-1'));
		act(() =>
			result.current.handleEditKeyDown({
				key: 'Enter',
				preventDefault,
			})
		);
		expect(result.current.editingId).toBeNull();
	});
});

// --- Structured edit save — async race condition ---

describe('handleStructuredEditSave race condition', () => {
	beforeEach(() => {
		// Default: resolve immediately so normal saves work.
		mockFormatBibliographyEntry = jest.fn(() =>
			Promise.resolve('Formatted entry')
		);
	});

	it('commits updated citation when no cancel occurs during save', async () => {
		const args = makeHookArgs();
		const { result } = renderHook(() => useCitationEditorState(args));

		act(() => result.current.handleStructuredEditStart('cit-1'));
		act(() =>
			result.current.handleStructuredFieldChange('title', 'Updated Title')
		);

		await act(() => result.current.handleStructuredEditSave());

		expect(args.setAttributes).toHaveBeenCalledWith(
			expect.objectContaining({ citations: expect.any(Array) })
		);
		expect(result.current.structuredEditingId).toBeNull();
	});

	it('does not commit when cancel fires while formatBibliographyEntry is pending', async () => {
		// Create the promise once so resolveFormat is set synchronously by the
		// Promise constructor, regardless of when the mock is actually called.
		let resolveFormat;
		const pendingFormat = new Promise((resolve) => {
			resolveFormat = resolve;
		});
		mockFormatBibliographyEntry = jest.fn(() => pendingFormat);

		const args = makeHookArgs();
		const { result } = renderHook(() => useCitationEditorState(args));

		act(() => result.current.handleStructuredEditStart('cit-1'));

		// Start save (async, will block on formatBibliographyEntry).
		let savePromise;
		act(() => {
			savePromise = result.current.handleStructuredEditSave();
		});

		// Cancel while format is still pending — nulls structuredEditingIdRef.
		act(() => result.current.handleStructuredEditCancel());

		// Resolve the format and let the save finish.
		resolveFormat('Late formatted entry');
		await act(async () => savePromise);

		expect(args.setAttributes).not.toHaveBeenCalled();
	});

	it('does not commit when cancel fires between formatBibliographyEntry resolving and setAttributes', async () => {
		let resolveFormat;
		const pendingFormat = new Promise((resolve) => {
			resolveFormat = resolve;
		});
		mockFormatBibliographyEntry = jest.fn(() => pendingFormat);

		const args = makeHookArgs();
		const { result } = renderHook(() => useCitationEditorState(args));

		act(() => result.current.handleStructuredEditStart('cit-1'));

		let savePromise;
		act(() => {
			savePromise = result.current.handleStructuredEditSave();
		});

		act(() => result.current.handleStructuredEditCancel());

		resolveFormat('Formatted');
		await act(async () => savePromise);

		expect(args.setAttributes).not.toHaveBeenCalled();
	});
});

// --- Structured field change ---

describe('handleStructuredFieldChange', () => {
	it('updates individual structured fields without replacing others', () => {
		const args = makeHookArgs();
		const { result } = renderHook(() => useCitationEditorState(args));

		act(() => result.current.handleStructuredEditStart('cit-1'));
		act(() =>
			result.current.handleStructuredFieldChange('title', 'New Title')
		);
		act(() =>
			result.current.handleStructuredFieldChange('publisher', 'MIT Press')
		);

		expect(result.current.structuredFields.title).toBe('New Title');
		expect(result.current.structuredFields.publisher).toBe('MIT Press');
	});
});

// --- resetEditingState ---

describe('resetEditingState', () => {
	it('clears both inline and structured editing state simultaneously', () => {
		const args = makeHookArgs();
		const { result } = renderHook(() => useCitationEditorState(args));

		act(() => result.current.handleEditStart('cit-1'));
		act(() => result.current.handleStructuredEditStart('cit-1'));
		act(() => result.current.resetEditingState());

		expect(result.current.editingId).toBeNull();
		expect(result.current.editText).toBe('');
		expect(result.current.structuredEditingId).toBeNull();
		expect(result.current.structuredFields).toEqual({});
	});
});
