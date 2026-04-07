import '@testing-library/jest-dom';
import React from 'react';
import {
	render,
	screen,
	waitFor,
	fireEvent,
	createEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Edit from './edit';
import { parsePastedInput } from './lib/parser';
import {
	buildPlainTextBibliographyContent,
	downloadBibtexExport,
	downloadCslJsonExport,
	downloadRisExport,
} from './lib/export';
import { copyTextToClipboard } from './lib/clipboard';
import {
	formatBibliographyEntries,
	formatBibliographyEntry,
} from './lib/formatting/csl';

jest.mock(
	'@wordpress/i18n',
	() => ({
		__: (text) => text,
	}),
	{ virtual: true }
);

jest.mock(
	'@wordpress/notices',
	() => ({
		store: 'core/notices',
	}),
	{ virtual: true }
);

jest.mock(
	'@wordpress/data',
	() =>
		require('./test-utils/wordpress-data-notices-mock').createWordpressDataNoticesMock(),
	{ virtual: true }
);

jest.mock(
	'@wordpress/block-editor',
	() => {
		const ReactLocal = require('react');

		return {
			useBlockProps: () => ({
				className: 'wp-block-scholarly-bibliography',
			}),
			InspectorControls: ({ children }) =>
				ReactLocal.createElement(ReactLocal.Fragment, null, children),
			BlockControls: ({ children }) =>
				ReactLocal.createElement(ReactLocal.Fragment, null, children),
		};
	},
	{ virtual: true }
);

jest.mock(
	'@wordpress/components',
	() => {
		const ReactLocal = require('react');

		return {
			PanelBody: ({ title, children }) =>
				ReactLocal.createElement(
					'section',
					null,
					ReactLocal.createElement('h2', null, title),
					children
				),
			SelectControl: ({ label, value, options, onChange, help }) =>
				ReactLocal.createElement(
					ReactLocal.Fragment,
					null,
					ReactLocal.createElement(
						'label',
						null,
						label,
						ReactLocal.createElement(
							'select',
							{
								'aria-label': label,
								value,
								onChange: (event) =>
									onChange?.(event.target.value),
							},
							options.map((option) =>
								ReactLocal.createElement(
									'option',
									{
										key: option.value,
										value: option.value,
									},
									option.label
								)
							)
						)
					),
					help ? ReactLocal.createElement('p', null, help) : null
				),
			Placeholder: ({
				label,
				instructions,
				notices,
				className,
				children,
			}) =>
				ReactLocal.createElement(
					'section',
					{ className },
					label ? ReactLocal.createElement('h2', null, label) : null,
					instructions
						? ReactLocal.createElement('p', null, instructions)
						: null,
					notices || null,
					children
				),
			Notice: ({ status = 'info', onRemove, children, className }) =>
				ReactLocal.createElement(
					'div',
					{
						role: 'status',
						className: `${
							className || ''
						} components-notice is-${status}`.trim(),
					},
					children,
					onRemove
						? ReactLocal.createElement(
								'button',
								{
									type: 'button',
									'aria-label': 'Dismiss',
									onClick: onRemove,
								},
								'Dismiss'
						  )
						: null
				),
			Snackbar: ({ onRemove, children, className }) =>
				ReactLocal.createElement(
					'div',
					{
						role: 'status',
						className: `${
							className || ''
						} components-snackbar`.trim(),
					},
					children,
					onRemove
						? ReactLocal.createElement(
								'button',
								{
									type: 'button',
									'aria-label': 'Dismiss',
									onClick: onRemove,
								},
								'Dismiss'
						  )
						: null
				),
			BaseControl: ({ label, children }) =>
				ReactLocal.createElement('label', null, label, children),
			Button: ({ label, className, onClick, children, ...rest }) =>
				ReactLocal.createElement(
					'button',
					{
						type: 'button',
						className,
						'aria-label': label,
						'aria-expanded': rest['aria-expanded'],
						disabled: rest.disabled,
						onClick,
					},
					children || 'icon'
				),
			TextControl: ({ label, value, disabled }) =>
				ReactLocal.createElement('input', {
					'aria-label': label,
					value,
					disabled,
					readOnly: true,
					onChange: () => {},
				}),
			ToggleControl: ({ label, checked, onChange, help }) =>
				ReactLocal.createElement(
					ReactLocal.Fragment,
					null,
					ReactLocal.createElement(
						'label',
						null,
						ReactLocal.createElement('input', {
							type: 'checkbox',
							'aria-label': label,
							checked,
							onChange: (event) =>
								onChange?.(event.target.checked),
						}),
						label
					),
					help ? ReactLocal.createElement('p', null, help) : null
				),
			ToolbarGroup: ({ children }) =>
				ReactLocal.createElement('div', null, children),
			ToolbarButton: ({ label, isPressed, onClick, icon }) =>
				ReactLocal.createElement(
					'button',
					{
						type: 'button',
						'aria-label': label,
						'aria-pressed': isPressed ? 'true' : 'false',
						onClick,
					},
					icon ? ReactLocal.createElement(icon) : label
				),
		};
	},
	{ virtual: true }
);

jest.mock(
	'@wordpress/icons',
	() => ({
		chevronDown: 'chevron-down',
		chevronUp: 'chevron-up',
	}),
	{ virtual: true }
);

jest.mock('./lib/wp-icons', () => {
	const ReactLocal = require('react');
	const MockIcon = () =>
		ReactLocal.createElement('span', { 'aria-hidden': 'true' });

	return {
		ChevronDownIcon: MockIcon,
		ChevronUpIcon: MockIcon,
		PasteImportIcon: MockIcon,
		ManualEntryIcon: MockIcon,
		StructuredEditIcon: MockIcon,
		EditIcon: MockIcon,
		CopyIcon: MockIcon,
		ResetIcon: MockIcon,
		DeleteIcon: MockIcon,
		ConfirmIcon: MockIcon,
		CancelIcon: MockIcon,
	};
});
jest.mock(
	'@wordpress/element',
	() => {
		const ReactLocal = require('react');
		const ReactDOMLocal = require('react-dom');

		return {
			createElement: ReactLocal.createElement,
			createPortal: ReactDOMLocal.createPortal,
			Fragment: ReactLocal.Fragment,
			useState: ReactLocal.useState,
			useRef: ReactLocal.useRef,
			useCallback: ReactLocal.useCallback,
			useEffect: ReactLocal.useEffect,
			useMemo: ReactLocal.useMemo,
		};
	},
	{ virtual: true }
);

jest.mock('./lib/parser', () => ({
	parsePastedInput: jest.fn(),
	validateAndSanitizeCsl: jest.fn((csl) => csl),
}));

jest.mock('./lib/export', () => ({
	buildPlainTextBibliographyContent: jest.fn(
		() => 'Alpha citation\nBeta citation\n'
	),
	downloadBibtexExport: jest.fn(),
	downloadCslJsonExport: jest.fn(),
	downloadRisExport: jest.fn(),
}));

jest.mock('./lib/clipboard', () => ({
	copyTextToClipboard: jest.fn(),
}));

jest.mock('./lib/formatting/csl', () => {
	const getFormattedCitation = (item) =>
		item.title || item['container-title'] || 'Formatted citation';

	return {
		__esModule: true,
		formatBibliographyEntries: jest.fn((cslItems) =>
			cslItems.map(getFormattedCitation)
		),
		formatBibliographyEntry: jest.fn(getFormattedCitation),
	};
});

jest.mock('./lib/formatting', () => ({
	getAutoFormattedText: jest.fn(
		(citation) =>
			citation.formattedText || citation.csl.title || 'Formatted citation'
	),
	getDisplayText: jest.fn(
		(citation) =>
			citation.displayOverride ||
			citation.formattedText ||
			citation.csl.title ||
			'Formatted citation'
	),
	getDisplaySegments: jest.fn((citation) => [
		{
			text:
				citation.displayOverride ||
				citation.formattedText ||
				citation.csl.title ||
				'Formatted citation',
			italic: false,
		},
	]),
	getStyleDefinition: jest.fn((styleKey) => {
		const labels = {
			'chicago-notes-bibliography': 'Chicago Notes-Bibliography',
			'chicago-author-date': 'Chicago Author-Date',
			'apa-7': 'APA 7',
			'mla-9': 'MLA 9',
			harvard: 'Harvard',
			ieee: 'IEEE',
			vancouver: 'Vancouver',
			oscola: 'OSCOLA',
			abnt: 'ABNT',
		};

		return {
			key: styleKey,
			label: labels[styleKey] || 'Chicago Notes-Bibliography',
		};
	}),
	getSelectableStyles: jest.fn(() => [
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
	]),
	getHeadingPlaceholder: jest.fn((styleKey) => {
		const placeholders = {
			'chicago-notes-bibliography': 'Bibliography',
			'chicago-author-date': 'References',
			'apa-7': 'References',
			'mla-9': 'Works Cited',
			harvard: 'References',
			ieee: 'References',
			vancouver: 'References',
			oscola: 'Bibliography',
			abnt: 'Referências',
		};

		return placeholders[styleKey] || 'Bibliography';
	}),
	getListSemantics: jest.fn((styleKey) =>
		['ieee', 'vancouver'].includes(styleKey) ? 'ol' : 'ul'
	),
}));

function EditHarness({
	initialCitations = [],
	initialStyle = 'chicago-notes-bibliography',
	initialHeadingText = '',
	initialOutputJsonLd = true,
	initialOutputCoins = false,
	initialOutputCslJson = false,
}) {
	const [attributes, setAttributes] = React.useState({
		citationStyle: initialStyle,
		headingText: initialHeadingText,
		outputJsonLd: initialOutputJsonLd,
		outputCoins: initialOutputCoins,
		outputCslJson: initialOutputCslJson,
		citations: initialCitations,
	});

	return (
		<Edit
			attributes={attributes}
			setAttributes={(nextAttributes) =>
				setAttributes((previousAttributes) => ({
					...previousAttributes,
					...nextAttributes,
				}))
			}
		/>
	);
}

function createCitation({
	id,
	family,
	year,
	title,
	rendered = title,
	formattedText = rendered,
	displayOverride = null,
	inputFormat = 'doi',
	parseConfidence,
	type = 'article-journal',
	containerTitle,
	publisher,
	page,
	doi,
	parseWarnings = [],
}) {
	return {
		id,
		csl: {
			type,
			title,
			rendered,
			...(containerTitle
				? {
						'container-title': containerTitle,
				  }
				: {}),
			...(publisher
				? {
						publisher,
				  }
				: {}),
			...(page
				? {
						page,
				  }
				: {}),
			...(doi
				? {
						DOI: doi,
				  }
				: {}),
			author: family
				? [
						{
							family,
						},
				  ]
				: [],
			issued: year
				? {
						'date-parts': [[year]],
				  }
				: undefined,
		},
		formattedText,
		displayOverride,
		inputRaw: title,
		inputFormat,
		parseConfidence,
		parseWarnings,
		parsedAt: '2026-03-31T00:00:00Z',
	};
}

describe('Edit focus management', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		buildPlainTextBibliographyContent.mockReset();
		buildPlainTextBibliographyContent.mockReturnValue(
			'Alpha citation\nBeta citation\n'
		);
		downloadBibtexExport.mockReset();
		downloadCslJsonExport.mockReset();
		downloadRisExport.mockReset();
		copyTextToClipboard.mockReset();
		require('@wordpress/data').__unstableResetNotices();
	});

	it('shows DOI/BibTeX-only guidance when parsing fails without entries', async () => {
		parsePastedInput.mockResolvedValue({
			entries: [],
			errors: [],
			truncated: false,
		});

		render(<EditHarness />);

		expect(
			screen.getByPlaceholderText(
				'Add DOI(s), BibTeX entries, and citations in supported styles for books, articles, chapters, and webpages. Separate multiple formatted citations with a blank line.'
			)
		).toBeInTheDocument();

		await userEvent.type(
			screen.getByLabelText('Add citations'),
			'Some free-text citation'
		);
		await userEvent.click(screen.getByRole('button', { name: 'Add' }));

		expect(await screen.findByRole('status')).toHaveTextContent(
			'Paste a DOI, BibTeX entry, or supported citation for a book, article, chapter, or webpage. Separate multiple formatted citations with a blank line.'
		);
	});

	it('does not replay pasted citation text in parse failure feedback', async () => {
		parsePastedInput.mockResolvedValue({
			entries: [],
			errors: [
				'Paste a DOI, BibTeX entry, or supported citation for a book, article, chapter, or webpage. Separate multiple formatted citations with a blank line.',
			],
			truncated: false,
			remainingInput: 'Private Draft Citation',
		});

		render(<EditHarness />);

		await userEvent.type(
			screen.getByLabelText('Add citations'),
			'Private Draft Citation'
		);
		await userEvent.click(screen.getByRole('button', { name: 'Add' }));

		const status = await screen.findByRole('status');

		expect(status).toHaveTextContent(
			'Paste a DOI, BibTeX entry, or supported citation for a book, article, chapter, or webpage. Separate multiple formatted citations with a blank line.'
		);
		expect(status).not.toHaveTextContent('Private Draft Citation');
		expect(screen.getByLabelText('Add citations')).toHaveValue(
			'Private Draft Citation'
		);
	});

	it('retains unparsed items in the add form after a partial paste succeeds', async () => {
		parsePastedInput.mockResolvedValue({
			entries: [
				createCitation({
					id: 'entry-a',
					family: 'Alpha',
					year: 2024,
					title: 'Alpha citation',
				}),
			],
			errors: [
				'Paste a DOI, BibTeX entry, or supported citation for a book, article, chapter, or webpage. Separate multiple formatted citations with a blank line.',
			],
			truncated: false,
			remainingInput: 'Unparsed citation chunk',
		});

		render(<EditHarness />);

		await userEvent.type(
			screen.getByLabelText('Add citations'),
			'Alpha citation\nBad chunk'
		);
		await userEvent.click(screen.getByRole('button', { name: 'Add' }));

		expect(await screen.findByRole('status')).toHaveTextContent(
			"Added 1 citation. Couldn't parse 1 item. Unparsed items remain in the form."
		);
		expect(screen.getByLabelText('Add citations')).toHaveValue(
			'Unparsed citation chunk'
		);
	});

	it('moves focus to the first newly added entry after a successful parse', async () => {
		parsePastedInput.mockResolvedValue({
			entries: [
				createCitation({
					id: 'entry-b',
					family: 'Zulu',
					year: 2025,
					title: 'Zulu citation',
				}),
				createCitation({
					id: 'entry-a',
					family: 'Alpha',
					year: 2024,
					title: 'Alpha citation',
				}),
			],
			errors: [],
			truncated: false,
		});

		render(<EditHarness />);

		await userEvent.type(
			screen.getByLabelText('Add citations'),
			'10.1234/example-doi'
		);
		await userEvent.click(screen.getByRole('button', { name: 'Add' }));

		const firstEntry = await screen.findByText('Alpha citation');

		await waitFor(() => {
			expect(firstEntry.closest('li')).toHaveFocus();
		});
	});

	it('re-sorts existing loaded citations into bibliography order', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'marks',
						family: 'Marks',
						year: 2023,
						title: 'The Book by Design',
					}),
					createCitation({
						id: 'borel',
						family: 'Borel',
						year: 2023,
						title: 'The Chicago Guide to Fact-Checking',
					}),
				]}
			/>
		);

		const entries = screen.getAllByRole('listitem');

		expect(entries[0]).toHaveTextContent(
			'The Chicago Guide to Fact-Checking'
		);
		expect(entries[1]).toHaveTextContent('The Book by Design');
	});

	it('allows selecting APA style before any citations are added', async () => {
		render(<EditHarness />);

		await userEvent.selectOptions(
			screen.getByLabelText('Citation Style'),
			'apa-7'
		);

		expect(await screen.findByRole('status')).toHaveTextContent(
			'Style changed to APA 7.'
		);
		expect(screen.getByLabelText('Citation Style')).toHaveValue('apa-7');
	});

	it('renders notices inline within the block UI', async () => {
		render(<EditHarness />);

		await userEvent.selectOptions(
			screen.getByLabelText('Citation Style'),
			'apa-7'
		);

		const notice = await screen.findByRole('status');
		const blockRoot = document.querySelector(
			'.wp-block-scholarly-bibliography'
		);

		expect(blockRoot).toContainElement(notice);
	});

	it('defaults metadata output toggles to JSON-LD on and COinS / CSL-JSON off', () => {
		render(<EditHarness />);

		expect(screen.getByLabelText('Output JSON-LD')).toBeChecked();
		expect(screen.getByLabelText('Output COinS')).not.toBeChecked();
		expect(screen.getByLabelText('Output CSL-JSON')).not.toBeChecked();
	});

	it('downloads a CSL-JSON export from the inspector when citations are present', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'citation-1',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', { name: 'Download CSL-JSON' })
		);

		expect(downloadCslJsonExport).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ id: 'citation-1' }),
			]),
			'chicago-notes-bibliography'
		);
		expect(await screen.findByRole('status')).toHaveTextContent(
			'Downloaded CSL-JSON export.'
		);
	});

	it('disables the CSL-JSON export button when there are no citations', () => {
		render(<EditHarness />);

		expect(
			screen.getByRole('button', { name: 'Download CSL-JSON' })
		).toBeDisabled();
	});

	it('downloads a BibTeX export from the inspector when citations are present', async () => {
		downloadBibtexExport.mockResolvedValue('blob:bib');

		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'citation-1',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', { name: 'Download BibTeX' })
		);

		await waitFor(() => {
			expect(downloadBibtexExport).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ id: 'citation-1' }),
				]),
				'chicago-notes-bibliography'
			);
		});
		expect(await screen.findByRole('status')).toHaveTextContent(
			'Downloaded BibTeX export.'
		);
	});

	it('disables the BibTeX export button when there are no citations', () => {
		render(<EditHarness />);

		expect(
			screen.getByRole('button', { name: 'Download BibTeX' })
		).toBeDisabled();
	});

	it('downloads an RIS export from the inspector when citations are present', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'citation-1',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', { name: 'Download RIS' })
		);

		expect(downloadRisExport).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ id: 'citation-1' }),
			]),
			'chicago-notes-bibliography'
		);
		expect(await screen.findByRole('status')).toHaveTextContent(
			'Downloaded RIS export.'
		);
	});

	it('disables the RIS export button when there are no citations', () => {
		render(<EditHarness />);

		expect(
			screen.getByRole('button', { name: 'Download RIS' })
		).toBeDisabled();
	});

	it('copies the visible citation text from the row action', async () => {
		copyTextToClipboard.mockResolvedValue(true);

		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'citation-1',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
						displayOverride: 'Edited display citation',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', {
				name: 'Copy citation: Alpha 2024',
			})
		);

		expect(copyTextToClipboard).toHaveBeenCalledWith(
			'Edited display citation'
		);
		expect(await screen.findByRole('status')).toHaveTextContent(
			'Copied citation.'
		);
	});

	it('stops Gutenberg-level undo propagation inside the add-citations textarea', () => {
		render(<EditHarness />);

		const textarea = screen.getByLabelText('Add citations');
		const event = createEvent.keyDown(textarea, {
			key: 'z',
			metaKey: true,
		});

		event.stopPropagation = jest.fn();

		fireEvent(textarea, event);

		expect(event.stopPropagation).toHaveBeenCalled();
	});

	it('does not stop propagation for ordinary textarea keys', () => {
		render(<EditHarness />);

		const textarea = screen.getByLabelText('Add citations');
		const event = createEvent.keyDown(textarea, {
			key: 'a',
		});

		event.stopPropagation = jest.fn();
		fireEvent(textarea, event);

		expect(event.stopPropagation).not.toHaveBeenCalled();
	});

	it('defaults to Paste / Import mode and can switch modes from the toolbar or fallback link', async () => {
		render(<EditHarness />);

		expect(
			screen.getByRole('button', { name: 'Paste / Import' })
		).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByLabelText('Add citations')).toBeInTheDocument();
		expect(
			screen.queryByLabelText('Publication Type')
		).not.toBeInTheDocument();

		await userEvent.click(
			screen.getAllByRole('button', { name: 'Manual Entry' })[0]
		);

		expect(
			screen.getAllByRole('button', { name: 'Manual Entry' })[0]
		).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByLabelText('Publication Type')).toBeInTheDocument();
		expect(screen.getByLabelText('Author(s)')).toBeInTheDocument();
		expect(screen.getByLabelText('Title')).toBeInTheDocument();
		expect(
			screen.getAllByRole('button', { name: 'Paste / Import' }).length
		).toBeGreaterThan(0);

		await userEvent.click(
			screen.getAllByRole('button', { name: 'Paste / Import' })[0]
		);

		expect(screen.getByLabelText('Add citations')).toBeInTheDocument();
		expect(
			screen.getAllByRole('button', { name: 'Manual Entry' })[0]
		).toBeInTheDocument();
	});

	it('adds a manual citation with only type and title, then focuses the new entry', async () => {
		render(<EditHarness initialStyle="apa-7" />);

		await userEvent.click(
			screen.getAllByRole('button', { name: 'Manual Entry' })[0]
		);
		await userEvent.selectOptions(
			screen.getByLabelText('Publication Type'),
			'book'
		);
		await userEvent.type(screen.getByLabelText('Title'), 'Manual Book');
		await userEvent.click(screen.getByRole('button', { name: 'Add' }));

		await waitFor(() => {
			expect(screen.getByText('Manual Book').closest('li')).toHaveFocus();
		});

		expect(screen.getByRole('status')).toHaveTextContent(
			'Added 1 citation.'
		);
		expect(screen.getByLabelText('Publication Type')).toHaveValue('book');
		expect(screen.getByLabelText('Title')).toHaveValue('');
	});

	it('shows a validation notice for incomplete manual entries and focuses the notice', async () => {
		render(<EditHarness />);

		await userEvent.click(
			screen.getAllByRole('button', { name: 'Manual Entry' })[0]
		);
		await userEvent.selectOptions(
			screen.getByLabelText('Publication Type'),
			'book'
		);
		await userEvent.click(screen.getByRole('button', { name: 'Add' }));

		expect(await screen.findByRole('status')).toHaveTextContent(
			'Enter a title before adding.'
		);

		await waitFor(() => {
			expect(
				screen
					.getByRole('status')
					.closest('.scholarly-bibliography-editor-notices')
			).toHaveFocus();
		});
	});

	it('sorts manual entries with existing citations and reformats them on style change', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-z',
						family: 'Zulu',
						year: 2024,
						title: 'Zulu citation',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getAllByRole('button', { name: 'Manual Entry' })[0]
		);
		await userEvent.selectOptions(
			screen.getByLabelText('Publication Type'),
			'article-journal'
		);
		await userEvent.type(screen.getByLabelText('Author(s)'), 'Alpha, Ada');
		await userEvent.type(screen.getByLabelText('Title'), 'Alpha citation');
		await userEvent.click(screen.getByRole('button', { name: 'Add' }));

		await waitFor(() => {
			const entries = screen.getAllByRole('listitem');
			expect(entries[0]).toHaveTextContent('Alpha citation');
			expect(entries[1]).toHaveTextContent('Zulu citation');
		});

		await userEvent.selectOptions(
			screen.getByLabelText('Citation Style'),
			'apa-7'
		);

		await waitFor(() => {
			expect(screen.getByText('Alpha citation')).toBeInTheDocument();
		});
	});

	it('allows toggling metadata output layers in block settings', async () => {
		render(<EditHarness />);

		await userEvent.click(screen.getByLabelText('Output COinS'));
		await userEvent.click(screen.getByLabelText('Output CSL-JSON'));

		expect(screen.getByLabelText('Output COinS')).toBeChecked();
		expect(screen.getByLabelText('Output CSL-JSON')).toBeChecked();
		expect(screen.getByLabelText('Output JSON-LD')).toBeChecked();
	});

	it('clears the current notice when typing into the add form again', async () => {
		render(<EditHarness />);

		await userEvent.selectOptions(
			screen.getByLabelText('Citation Style'),
			'apa-7'
		);

		expect(await screen.findByRole('status')).toHaveTextContent(
			'Style changed to APA 7.'
		);

		await userEvent.type(screen.getByLabelText('Add citations'), '10.1234');

		await waitFor(() => {
			expect(screen.queryByRole('status')).not.toBeInTheDocument();
		});
	});

	it('reformats citations when the selected style changes and preserves display overrides', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
						formattedText:
							'chicago-notes-bibliography:Alpha citation',
					}),
					createCitation({
						id: 'entry-b',
						family: 'Bravo',
						year: 2025,
						title: 'Bravo citation',
						formattedText:
							'chicago-notes-bibliography:Bravo citation',
						displayOverride: 'Manual Bravo',
						inputFormat: 'freetext',
					}),
				]}
			/>
		);

		await userEvent.selectOptions(
			screen.getByLabelText('Citation Style'),
			'apa-7'
		);

		expect(await screen.findByRole('status')).toHaveTextContent(
			'Style changed to APA 7. Reformatted 2 citations.'
		);
		expect(screen.getByText('Alpha citation')).toBeInTheDocument();
		expect(screen.getByText('Manual Bravo')).toBeInTheDocument();
		expect(formatBibliographyEntries).toHaveBeenCalledWith(
			[
				expect.objectContaining({
					title: 'Alpha citation',
				}),
				expect.objectContaining({
					title: 'Bravo citation',
				}),
			],
			'apa-7'
		);

		await userEvent.click(
			screen.getByRole('button', {
				name: 'Reset edits',
			})
		);

		await waitFor(() => {
			expect(screen.getByText('Bravo citation')).toBeInTheDocument();
		});
	});

	it('uses singular wording when one citation is reformatted during a style change', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
						formattedText:
							'chicago-notes-bibliography:Alpha citation',
					}),
				]}
			/>
		);

		await userEvent.selectOptions(
			screen.getByLabelText('Citation Style'),
			'apa-7'
		);

		expect(await screen.findByRole('status')).toHaveTextContent(
			'Style changed to APA 7. Reformatted 1 citation.'
		);
	});

	it('skips duplicate citations that are already present in the block', async () => {
		parsePastedInput.mockResolvedValue({
			entries: [
				createCitation({
					id: 'entry-b',
					family: 'Alpha',
					year: 2024,
					title: 'Alpha citation',
					doi: '10.1234/example-doi',
				}),
			],
			errors: [],
			truncated: false,
		});

		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
						doi: '10.1234/example-doi',
					}),
				]}
			/>
		);

		await userEvent.type(
			screen.getByLabelText('Add citations'),
			'10.1234/example-doi'
		);
		await userEvent.click(screen.getByRole('button', { name: 'Add' }));

		expect(await screen.findByRole('status')).toHaveTextContent(
			'No new citations added. Skipped 1 duplicate.'
		);
		expect(screen.getAllByText('Alpha citation')).toHaveLength(1);
	});

	it('skips duplicate citations within the same pasted batch', async () => {
		parsePastedInput.mockResolvedValue({
			entries: [
				createCitation({
					id: 'entry-a',
					family: 'Alpha',
					year: 2024,
					title: 'Alpha citation',
					doi: '10.1234/example-doi',
				}),
				createCitation({
					id: 'entry-b',
					family: 'Alpha',
					year: 2024,
					title: 'Alpha citation',
					doi: '10.1234/example-doi',
				}),
			],
			errors: [],
			truncated: false,
		});

		render(<EditHarness />);

		await userEvent.type(
			screen.getByLabelText('Add citations'),
			'10.1234/example-doi\n10.1234/example-doi'
		);
		await userEvent.click(screen.getByRole('button', { name: 'Add' }));

		expect(await screen.findByRole('status')).toHaveTextContent(
			'Added 1 citation. Skipped 1 duplicate.'
		);
		expect(screen.getAllByText('Alpha citation')).toHaveLength(1);
	});

	it('moves focus to the notice for partial parse results', async () => {
		parsePastedInput.mockResolvedValue({
			entries: [
				createCitation({
					id: 'entry-a',
					family: 'Alpha',
					year: 2024,
					title: 'Alpha citation',
				}),
			],
			errors: ['Could not resolve one DOI.'],
			truncated: false,
		});

		render(<EditHarness />);

		await userEvent.type(
			screen.getByLabelText('Add citations'),
			'10.1234/example-doi'
		);
		await userEvent.click(screen.getByRole('button', { name: 'Add' }));

		await waitFor(() => {
			expect(
				screen
					.getByRole('status')
					.closest('.scholarly-bibliography-editor-notices')
			).toHaveFocus();
		});
	});

	it('moves focus to the next entry after deleting a citation', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
					}),
					createCitation({
						id: 'entry-b',
						family: 'Bravo',
						year: 2025,
						title: 'Bravo citation',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', { name: 'Delete citation: Alpha 2024' })
		);

		await waitFor(() => {
			expect(
				screen.getByText('Bravo citation').closest('li')
			).toHaveFocus();
		});
	});

	it('moves focus back to the add-citations textarea after deleting the last citation', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', { name: 'Delete citation: Alpha 2024' })
		);

		await waitFor(() => {
			expect(screen.getByLabelText('Add citations')).toHaveFocus();
		});
	});

	it('does not show a visible Undo button after deletion', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
					}),
					createCitation({
						id: 'entry-b',
						family: 'Bravo',
						year: 2025,
						title: 'Bravo citation',
					}),
				]}
			/>
		);

		expect(
			screen.queryByRole('button', { name: 'Undo' })
		).not.toBeInTheDocument();

		await userEvent.click(
			screen.getByRole('button', { name: 'Delete citation: Alpha 2024' })
		);

		expect(screen.getByRole('status')).toHaveTextContent(
			'Citation removed.'
		);

		expect(
			screen.queryByRole('button', { name: 'Undo' })
		).not.toBeInTheDocument();
	});

	it('does not show a confidence pill for low-confidence free-text entries', () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						title: 'Responses API',
						type: 'webpage',
						inputFormat: 'freetext',
						parseConfidence: 'low',
					}),
				]}
			/>
		);

		expect(screen.queryByText('Review')).not.toBeInTheDocument();
	});

	it('supports structured field editing and reset for heuristic free-text entries', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Smith',
						title: 'Learning Blocks',
						type: 'article-journal',
						containerTitle: 'Journal of WordPress Studies',
						page: '117-134',
						doi: '10.1234/example-doi',
						year: 2024,
						inputFormat: 'freetext',
						parseConfidence: 'low',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', {
				name: 'Edit fields for Smith 2024',
			})
		);

		const authorInput = screen.getByLabelText('Author(s)');
		fireEvent.change(authorInput, {
			target: {
				value: 'Smith, Ada; Scholar, Jane',
			},
		});

		const titleInput = screen.getByLabelText('Title');
		fireEvent.change(titleInput, {
			target: {
				value: 'Learning Blocks Revised',
			},
		});

		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		await waitFor(() => {
			expect(
				screen.getByText('Learning Blocks Revised')
			).toBeInTheDocument();
		});

		await userEvent.click(
			screen.getByRole('button', {
				name: 'Edit citation: Smith 2024',
			})
		);

		const displayInput = screen.getByLabelText('Editing: Smith 2024');
		fireEvent.change(displayInput, {
			target: {
				value: 'Manual override',
			},
		});
		fireEvent.keyDown(displayInput, { key: 'Enter' });

		expect(screen.getByText('Manual override')).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole('button', {
				name: 'Reset edits',
			})
		);

		await waitFor(() => {
			expect(
				screen.getByText('Learning Blocks Revised')
			).toBeInTheDocument();
		});
	});

	it('cancels structured field editing with Escape', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Smith',
						title: 'Learning Blocks',
						type: 'article-journal',
						containerTitle: 'Journal of WordPress Studies',
						year: 2024,
						inputFormat: 'freetext',
						parseConfidence: 'low',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', {
				name: 'Edit fields for Smith 2024',
			})
		);

		const titleInput = screen.getByLabelText('Title');
		fireEvent.keyDown(titleInput, { key: 'Escape' });

		await waitFor(() => {
			expect(
				screen.getByText('Learning Blocks').closest('li')
			).toHaveFocus();
		});

		expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
	});

	it('shows an Author(s) field in structured editing and uses it when saving', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Smith',
						title: 'Learning Blocks',
						type: 'article-journal',
						year: 2024,
						inputFormat: 'freetext',
						parseConfidence: 'low',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', {
				name: 'Edit fields for Smith 2024',
			})
		);

		const authorInput = screen.getByLabelText('Author(s)');
		expect(authorInput).toHaveValue('Smith');

		fireEvent.change(authorInput, {
			target: {
				value: 'Smith, Ada; Scholar, Jane',
			},
		});

		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		await waitFor(() => {
			expect(formatBibliographyEntry).toHaveBeenCalledWith(
				expect.objectContaining({
					author: [
						{ family: 'Smith', given: 'Ada' },
						{ family: 'Scholar', given: 'Jane' },
					],
				}),
				'chicago-notes-bibliography'
			);
		});
	});

	it('shows review warnings and structured field editing for flagged DOI records', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-review',
						family: 'King',
						year: 2025,
						title: 'Review record title',
						type: 'article-journal',
						containerTitle: 'Administrative Science Quarterly',
						doi: '10.1177/00018392251368878',
						inputFormat: 'doi',
						parseWarnings: ['review-metadata-incomplete'],
					}),
				]}
			/>
		);

		expect(
			screen.getByText(
				'Imported metadata may be incomplete. Verify before publishing.'
			)
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', {
				name: 'Edit fields for King 2025',
			})
		).toBeInTheDocument();
	});

	it('surfaces review-needed records in the top notice after parsing', async () => {
		parsePastedInput.mockResolvedValue({
			entries: [
				createCitation({
					id: 'entry-review',
					family: 'King',
					year: 2025,
					title: 'Review record title',
					type: 'article-journal',
					containerTitle: 'Administrative Science Quarterly',
					doi: '10.1177/00018392251368878',
					inputFormat: 'doi',
					parseWarnings: ['review-metadata-incomplete'],
				}),
			],
			errors: [],
			truncated: false,
		});

		render(<EditHarness />);

		await userEvent.type(
			screen.getByLabelText('Add citations'),
			'https://doi.org/10.1177/00018392251368878'
		);
		await userEvent.click(screen.getByRole('button', { name: 'Add' }));

		expect(await screen.findByRole('status')).toHaveTextContent(
			'Added 1 citation. Review 1 imported record before publishing.'
		);
	});

	it('does not create resettable edits when saving an unchanged citation', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', { name: 'Edit citation: Alpha 2024' })
		);

		const input = screen.getByLabelText('Editing: Alpha 2024');
		fireEvent.keyDown(input, { key: 'Enter' });

		await waitFor(() => {
			expect(
				screen.getByText('Alpha citation').closest('li')
			).toHaveFocus();
		});

		expect(
			screen.queryByRole('button', { name: 'Reset edits' })
		).not.toBeInTheDocument();
	});

	it('opens structured field editing when a structured-editable citation row is clicked', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Smith',
						title: 'Learning Blocks',
						type: 'article-journal',
						year: 2024,
						inputFormat: 'freetext',
						parseConfidence: 'low',
					}),
				]}
			/>
		);

		await userEvent.click(screen.getByText('Learning Blocks'));

		expect(screen.getByLabelText('Author(s)')).toBeInTheDocument();
		expect(screen.getByLabelText('Title')).toBeInTheDocument();
	});

	it('opens plain edit mode when a non-structured citation row is clicked', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
						inputFormat: 'doi',
					}),
				]}
			/>
		);

		await userEvent.click(screen.getByText('Alpha citation'));

		expect(
			screen.getByLabelText('Editing: Alpha 2024')
		).toBeInTheDocument();
	});

	it('restores focus to the entry after confirming or cancelling an edit', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', { name: 'Edit citation: Alpha 2024' })
		);

		const input = screen.getByLabelText('Editing: Alpha 2024');
		fireEvent.change(input, {
			target: {
				value: 'Updated citation',
			},
		});
		fireEvent.keyDown(input, { key: 'Enter' });

		await waitFor(() => {
			expect(
				screen.getByText('Updated citation').closest('li')
			).toHaveFocus();
		});

		expect(
			screen.queryAllByText('Editing citation. Press Escape to cancel.')
		).toHaveLength(0);

		await userEvent.click(
			screen.getByRole('button', { name: 'Edit citation: Alpha 2024' })
		);

		const secondInput = screen.getByLabelText('Editing: Alpha 2024');
		fireEvent.keyDown(secondInput, { key: 'Escape' });

		await waitFor(() => {
			expect(
				screen.getByText('Updated citation').closest('li')
			).toHaveFocus();
		});

		expect(
			screen.queryAllByText('Editing citation. Press Escape to cancel.')
		).toHaveLength(0);
	});

	it('does not blank the citation when Escape is followed by blur during inline editing', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Alpha',
						year: 2024,
						title: 'Alpha citation',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', { name: 'Edit citation: Alpha 2024' })
		);

		const input = screen.getByLabelText('Editing: Alpha 2024');
		fireEvent.change(input, {
			target: {
				value: '',
			},
		});
		fireEvent.keyDown(input, { key: 'Escape' });
		fireEvent.blur(input);

		await waitFor(() => {
			expect(screen.getByText('Alpha citation')).toBeInTheDocument();
		});

		expect(
			screen.queryByRole('button', { name: 'Reset edits' })
		).not.toBeInTheDocument();
	});

	it('restores focus to the entry after confirming or cancelling structured field edits', async () => {
		render(
			<EditHarness
				initialCitations={[
					createCitation({
						id: 'entry-a',
						family: 'Smith',
						title: 'Learning Blocks',
						type: 'article-journal',
						year: 2024,
						inputFormat: 'freetext',
						parseConfidence: 'low',
					}),
				]}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', {
				name: 'Edit fields for Smith 2024',
			})
		);

		const titleInput = screen.getByLabelText('Title');
		fireEvent.change(titleInput, {
			target: {
				value: 'Learning Blocks Revised',
			},
		});

		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		await waitFor(() => {
			expect(
				screen.getByText('Learning Blocks Revised').closest('li')
			).toHaveFocus();
		});

		await userEvent.click(
			screen.getByRole('button', {
				name: 'Edit fields for Smith 2024',
			})
		);

		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		await waitFor(() => {
			expect(
				screen.getByText('Learning Blocks Revised').closest('li')
			).toHaveFocus();
		});
	});
});
