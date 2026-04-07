/**
 * Editor component for the Bibliography block.
 */

import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	InspectorControls,
	BlockControls,
} from '@wordpress/block-editor';
import {
	BaseControl,
	Button,
	PanelBody,
	Placeholder,
	SelectControl,
	TextControl,
	ToggleControl,
	ToolbarButton,
	ToolbarGroup,
} from '@wordpress/components';
import {
	useState,
	useRef,
	useCallback,
	useEffect,
	useMemo,
} from '@wordpress/element';
import { EditorCanvasNotices } from './components/editor-canvas-notices';
import { CitationEntryBody } from './components/citation-entry-body';
import { useBlockNotices } from './hooks/use-block-notices';
import { useCitationEditorState } from './hooks/use-citation-editor-state';
import { useEntryFocus } from './hooks/use-entry-focus';
import { copyTextToClipboard } from './lib/clipboard';
import {
	getDisplayText,
	getHeadingPlaceholder,
	getListSemantics,
	getSelectableStyles,
	getStyleDefinition,
} from './lib/formatting';
import { partitionDuplicateCitations } from './lib/deduplicate';
import { SUPPORTED_INPUT_MESSAGE } from './lib/input-support';
import {
	createEmptyManualEntryFields,
	createManualCitation,
	MANUAL_ENTRY_TYPE_OPTIONS,
	validateManualEntry,
} from './lib/manual-entry';
import {
	buildPlainTextBibliographyContent,
	downloadBibtexExport,
	downloadCslJsonExport,
	downloadRisExport,
} from './lib/export';
import { sortCitations } from './lib/sorter';
import { StructuredCitationEditor } from './components/structured-citation-editor';
import {
	ChevronDownIcon,
	ChevronUpIcon,
	ManualEntryIcon,
	PasteImportIcon,
} from './lib/wp-icons';

const WARNING_MESSAGES = {
	'review-metadata-incomplete': __(
		'Imported metadata may be incomplete. Verify before publishing.',
		'scholarly-bibliography'
	),
};

const CITATION_FORM_LABEL = __('Add citations', 'scholarly-bibliography');
const PASTE_IMPORT_TAB_LABEL = __('Paste / Import', 'scholarly-bibliography');
const MANUAL_ENTRY_TAB_LABEL = __('Manual Entry', 'scholarly-bibliography');
const PASTE_IMPORT_LINK_LABEL = __('Paste / Import', 'scholarly-bibliography');
const MANUAL_ENTRY_LINK_LABEL = __('Manual Entry', 'scholarly-bibliography');
const PASTE_IMPORT_FORM_TITLE = __('Add citations', 'scholarly-bibliography');
const MANUAL_ENTRY_FORM_TITLE = __(
	'Add citation manually',
	'scholarly-bibliography'
);

function pluralize(count, singular, plural = `${singular}s`) {
	return `${count} ${count === 1 ? singular : plural}`;
}

function buildParseResultMessage({
	addedCount,
	duplicateCount,
	errorCount,
	reviewWarningCount,
	truncated,
	retainedUnparsedItems,
}) {
	const parts = [];

	if (addedCount > 0) {
		parts.push(`Added ${pluralize(addedCount, 'citation')}.`);
	} else if (duplicateCount > 0 || errorCount > 0 || truncated) {
		parts.push('No new citations added.');
	}

	if (duplicateCount > 0) {
		parts.push(`Skipped ${pluralize(duplicateCount, 'duplicate')}.`);
	}

	if (errorCount > 0) {
		parts.push(`Couldn't parse ${pluralize(errorCount, 'item')}.`);
	}

	if (truncated) {
		parts.push('Only the first 50 items were processed.');
	}

	if (reviewWarningCount > 0) {
		parts.push(
			`Review ${pluralize(
				reviewWarningCount,
				'imported record'
			)} before publishing.`
		);
	}

	if (retainedUnparsedItems) {
		parts.push('Unparsed items remain in the form.');
	}

	return parts.join(' ');
}

export default function Edit({ attributes, setAttributes }) {
	const {
		citations,
		citationStyle,
		headingText,
		outputJsonLd = true,
		outputCoins = false,
		outputCslJson = false,
	} = attributes;
	const selectableStyles = useMemo(() => getSelectableStyles(), []);
	const manualTypeOptions = useMemo(() => MANUAL_ENTRY_TYPE_OPTIONS, []);
	const blockProps = useBlockProps();
	const headingPlaceholder = getHeadingPlaceholder(citationStyle);
	const listStyleDefinition = getStyleDefinition(citationStyle);
	const ListTag = getListSemantics(citationStyle);
	const listClassName = `scholarly-bibliography-list scholarly-bibliography-list-${
		listStyleDefinition.listType === 'ol' ? 'numeric' : 'unordered'
	} scholarly-bibliography-list-${citationStyle}`;
	const [inputValue, setInputValue] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isFormOpen, setIsFormOpen] = useState(true);
	const [activeAddMode, setActiveAddMode] = useState('paste');
	const [manualFields, setManualFields] = useState(() =>
		createEmptyManualEntryFields()
	);
	const sortedCitations = useMemo(
		() => sortCitations(citations, citationStyle),
		[citationStyle, citations]
	);
	const citationsRef = useRef(citations);
	const { announce, clearNotice, currentNotice, noticeVersion } =
		useBlockNotices();
	const { noticeRef, pasteZoneRef, queueFocus, setEntryRef } = useEntryFocus({
		citations,
		noticeVersion,
	});
	const {
		editText,
		editingId,
		getEntryLabel,
		getStructuredFieldId,
		handleCitationStyleChange,
		handleEditConfirm,
		handleEditKeyDown,
		handleEditStart,
		handleResetAutoFormat,
		handleStructuredEditCancel,
		handleStructuredEditSave,
		handleStructuredEditStart,
		handleStructuredFieldChange,
		setEditText,
		structuredEditingId,
		structuredFields,
	} = useCitationEditorState({
		announce,
		citationStyle,
		citationsRef,
		clearNotice,
		queueFocus,
		setAttributes,
	});

	useEffect(() => {
		citationsRef.current = citations;
	}, [citations]);

	useEffect(() => {
		const sortedIds = sortedCitations.map((citation) => citation.id);
		const currentIds = citations.map((citation) => citation.id);

		if (
			sortedIds.length === currentIds.length &&
			sortedIds.every((id, index) => id === currentIds[index])
		) {
			return;
		}

		citationsRef.current = sortedCitations;
		setAttributes({ citations: sortedCitations });
	}, [citations, setAttributes, sortedCitations]);

	const updatePasteInput = useCallback(
		(nextValue, { syncDom = false } = {}) => {
			setInputValue(nextValue);

			if (
				syncDom &&
				pasteZoneRef.current &&
				pasteZoneRef.current.value !== nextValue
			) {
				pasteZoneRef.current.value = nextValue;
			}
		},
		[pasteZoneRef]
	);

	const handleParse = useCallback(async () => {
		if (!inputValue.trim()) {
			return;
		}

		setIsLoading(true);
		clearNotice();

		try {
			const { parsePastedInput } = await import('./lib/parser');
			const {
				entries,
				errors,
				truncated,
				remainingInput = '',
			} = await parsePastedInput(inputValue, citationStyle, {
				deferFormatting: true,
			});
			const { uniqueEntries, duplicateEntries } =
				partitionDuplicateCitations(entries, citationsRef.current);
			const retainedUnparsedItems = Boolean(remainingInput.trim());

			if (uniqueEntries.length > 0) {
				const { formatBibliographyEntries } = await import(
					'./lib/formatting/csl'
				);
				const formattedTexts = await formatBibliographyEntries(
					uniqueEntries.map((citation) => citation.csl),
					citationStyle
				);
				const formattedUniqueEntries = uniqueEntries.map(
					(entry, index) => ({
						...entry,
						formattedText: formattedTexts[index],
					})
				);
				const updated = sortCitations(
					[...citationsRef.current, ...formattedUniqueEntries],
					citationStyle
				);
				const reviewWarningCount = uniqueEntries.filter(
					(entry) => (entry.parseWarnings || []).length > 0
				).length;
				const firstNewEntry = updated.find((citation) =>
					formattedUniqueEntries.some(
						(entry) => entry.id === citation.id
					)
				);

				citationsRef.current = updated;
				setAttributes({ citations: updated });

				const message = buildParseResultMessage({
					addedCount: uniqueEntries.length,
					duplicateCount: duplicateEntries.length,
					errorCount: errors.length,
					reviewWarningCount,
					truncated,
					retainedUnparsedItems,
				});
				announce(
					reviewWarningCount > 0 ||
						duplicateEntries.length > 0 ||
						errors.length > 0 ||
						truncated
						? 'info'
						: 'success',
					message,
					reviewWarningCount > 0 ||
						duplicateEntries.length > 0 ||
						errors.length > 0 ||
						truncated
						? {}
						: { type: 'snackbar' }
				);

				if (
					duplicateEntries.length > 0 ||
					errors.length > 0 ||
					truncated ||
					reviewWarningCount > 0
				) {
					queueFocus({ type: 'notice' });
				} else if (firstNewEntry) {
					queueFocus({ type: 'entry', id: firstNewEntry.id });
				}
			} else if (duplicateEntries.length > 0) {
				announce(
					'info',
					buildParseResultMessage({
						addedCount: 0,
						duplicateCount: duplicateEntries.length,
						errorCount: errors.length,
						reviewWarningCount: 0,
						truncated,
						retainedUnparsedItems,
					})
				);
				queueFocus({ type: 'notice' });
			} else if (errors.length > 0) {
				announce('info', errors[0]);
				queueFocus({ type: 'notice' });
			} else {
				announce('info', SUPPORTED_INPUT_MESSAGE);
				queueFocus({ type: 'notice' });
			}

			updatePasteInput(remainingInput, { syncDom: true });
		} catch (err) {
			announce(
				'error',
				'Something went wrong while parsing. Please try again.'
			);
			queueFocus({ type: 'notice' });
		} finally {
			setIsLoading(false);
		}
	}, [
		inputValue,
		citationStyle,
		setAttributes,
		announce,
		clearNotice,
		queueFocus,
		updatePasteInput,
	]);

	const handleDelete = useCallback(
		(id) => {
			const currentCitations = citationsRef.current;
			const deletedIndex = currentCitations.findIndex((c) => c.id === id);
			const entry = currentCitations[deletedIndex];

			if (!entry) {
				return;
			}

			const updated = currentCitations.filter((c) => c.id !== id);
			citationsRef.current = updated;
			setAttributes({ citations: updated });

			announce('success', 'Citation removed.', { type: 'snackbar' });

			if (!updated.length) {
				queueFocus({ type: 'paste' });
				return;
			}

			const nextEntry =
				updated[deletedIndex] || updated[deletedIndex - 1];

			if (nextEntry) {
				queueFocus({ type: 'entry', id: nextEntry.id });
			}
		},
		[setAttributes, announce, queueFocus]
	);

	const handleInputChange = useCallback(
		(valueOrEvent) => {
			const nextValue =
				typeof valueOrEvent === 'string'
					? valueOrEvent
					: valueOrEvent?.target?.value || '';

			updatePasteInput(nextValue);
			if (currentNotice) {
				clearNotice();
			}
		},
		[clearNotice, currentNotice, updatePasteInput]
	);

	const handleInputFocus = useCallback(() => {
		// Notice is cleared on typing (handleInputChange), not on focus,
		// to avoid a race where programmatic focus after parse clears
		// the notice that was just announced.
	}, []);

	const handlePasteInputKeyDown = useCallback((event) => {
		const isUndoRedoShortcut =
			(event.metaKey || event.ctrlKey) &&
			['z', 'Z', 'y', 'Y'].includes(event.key);

		if (isUndoRedoShortcut) {
			event.stopPropagation();
		}
	}, []);

	const handleAddModeChange = useCallback(
		(mode) => {
			setActiveAddMode(mode);
			clearNotice();
		},
		[clearNotice]
	);

	const handleManualFieldChange = useCallback(
		(field, value) => {
			setManualFields((currentFields) => ({
				...currentFields,
				[field]: value,
			}));
			if (currentNotice) {
				clearNotice();
			}
		},
		[clearNotice, currentNotice]
	);

	const handleManualClear = useCallback(() => {
		setManualFields(createEmptyManualEntryFields());
		clearNotice();

		if (pasteZoneRef.current?.focus) {
			pasteZoneRef.current.focus();
		}
	}, [clearNotice, pasteZoneRef]);

	const handleManualAdd = useCallback(async () => {
		const validationMessage = validateManualEntry(manualFields);

		if (validationMessage) {
			announce('warning', validationMessage);
			queueFocus({ type: 'notice' });
			return;
		}

		try {
			const entry = await createManualCitation(
				manualFields,
				citationStyle
			);
			const updated = sortCitations(
				[...citationsRef.current, entry],
				citationStyle
			);

			citationsRef.current = updated;
			setAttributes({ citations: updated });
			setManualFields(createEmptyManualEntryFields(manualFields.type));
			announce('success', 'Added 1 citation.', { type: 'snackbar' });
			queueFocus({ type: 'entry', id: entry.id });
		} catch (error) {
			announce(
				'error',
				'Something went wrong while adding the citation. Please try again.'
			);
			queueFocus({ type: 'notice' });
		}
	}, [announce, citationStyle, manualFields, queueFocus, setAttributes]);

	const handleCopyBibliography = useCallback(async () => {
		if (!citationsRef.current.length) {
			return;
		}

		try {
			await copyTextToClipboard(
				buildPlainTextBibliographyContent(
					citationsRef.current,
					citationStyle
				).trimEnd()
			);
			announce('success', 'Copied bibliography.', {
				type: 'snackbar',
			});
		} catch (error) {
			announce('error', 'Could not copy bibliography in this browser.');
			queueFocus({ type: 'notice' });
		}
	}, [announce, citationStyle, queueFocus]);

	const handleDownloadCslJson = useCallback(() => {
		if (!citationsRef.current.length) {
			return;
		}

		try {
			downloadCslJsonExport(citationsRef.current, citationStyle);
			announce('success', 'Downloaded CSL-JSON export.', {
				type: 'snackbar',
			});
		} catch (error) {
			announce(
				'error',
				'Could not download CSL-JSON export in this browser.'
			);
			queueFocus({ type: 'notice' });
		}
	}, [announce, citationStyle, queueFocus]);

	const handleDownloadBibtex = useCallback(async () => {
		if (!citationsRef.current.length) {
			return;
		}

		try {
			await downloadBibtexExport(citationsRef.current, citationStyle);
			announce('success', 'Downloaded BibTeX export.', {
				type: 'snackbar',
			});
		} catch (error) {
			announce(
				'error',
				'Could not download BibTeX export in this browser.'
			);
			queueFocus({ type: 'notice' });
		}
	}, [announce, citationStyle, queueFocus]);

	const handleDownloadRis = useCallback(() => {
		if (!citationsRef.current.length) {
			return;
		}

		try {
			downloadRisExport(citationsRef.current, citationStyle);
			announce('success', 'Downloaded RIS export.', {
				type: 'snackbar',
			});
		} catch (error) {
			announce('error', 'Could not download RIS export in this browser.');
			queueFocus({ type: 'notice' });
		}
	}, [announce, citationStyle, queueFocus]);

	const handleCopyCitation = useCallback(
		async (citation) => {
			try {
				await copyTextToClipboard(getDisplayText(citation));
				announce('success', 'Copied citation.', {
					type: 'snackbar',
				});
			} catch (error) {
				announce('error', 'Could not copy citation in this browser.');
				queueFocus({ type: 'notice' });
			}
		},
		[announce, queueFocus]
	);

	const isHeuristicCitation = useCallback(
		(citation) => citation.inputFormat === 'freetext',
		[]
	);

	const getCitationWarnings = useCallback(
		(citation) =>
			(citation.parseWarnings || [])
				.map((warningCode) => WARNING_MESSAGES[warningCode])
				.filter(Boolean),
		[]
	);

	const isStructuredEditable = useCallback(
		(citation) =>
			isHeuristicCitation(citation) ||
			getCitationWarnings(citation).length > 0,
		[getCitationWarnings, isHeuristicCitation]
	);

	const handleEntryActivate = useCallback(
		(citation) => {
			if (
				editingId === citation.id ||
				structuredEditingId === citation.id
			) {
				return;
			}

			if (isStructuredEditable(citation)) {
				handleStructuredEditStart(citation.id);
				return;
			}

			handleEditStart(citation.id);
		},
		[
			editingId,
			handleEditStart,
			handleStructuredEditStart,
			isStructuredEditable,
			structuredEditingId,
		]
	);

	const getEntryClassName = (citation) => {
		if (structuredEditingId === citation.id) {
			return 'scholarly-bibliography-entry is-structured-editing';
		}

		if (editingId === citation.id) {
			return 'scholarly-bibliography-entry is-inline-editing';
		}

		return 'scholarly-bibliography-entry';
	};

	const renderAddForm = (showHeader = true) => (
		<>
			{showHeader ? (
				<div className="scholarly-bibliography-form-header">
					<p className="scholarly-bibliography-form-title">
						{activeAddMode === 'paste'
							? PASTE_IMPORT_FORM_TITLE
							: MANUAL_ENTRY_FORM_TITLE}
					</p>
					<Button
						variant="link"
						size="small"
						className="scholarly-bibliography-mode-link"
						onClick={() =>
							handleAddModeChange(
								activeAddMode === 'paste' ? 'manual' : 'paste'
							)
						}
					>
						{activeAddMode === 'paste'
							? MANUAL_ENTRY_LINK_LABEL
							: PASTE_IMPORT_LINK_LABEL}
					</Button>
				</div>
			) : (
				<div className="scholarly-bibliography-form-header scholarly-bibliography-form-header-compact">
					<Button
						variant="link"
						size="small"
						className="scholarly-bibliography-mode-link"
						onClick={() =>
							handleAddModeChange(
								activeAddMode === 'paste' ? 'manual' : 'paste'
							)
						}
					>
						{activeAddMode === 'paste'
							? MANUAL_ENTRY_LINK_LABEL
							: PASTE_IMPORT_LINK_LABEL}
					</Button>
				</div>
			)}
			{activeAddMode === 'paste' ? (
				<>
					<BaseControl
						id="scholarly-bibliography-paste-input"
						label={CITATION_FORM_LABEL}
						hideLabelFromVision
						className="scholarly-bibliography-textarea"
					>
						{/* Keep this as a native uncontrolled textarea so browser undo/redo
							behaves normally before submission. */}
						<textarea
							ref={pasteZoneRef}
							id="scholarly-bibliography-paste-input"
							aria-label={CITATION_FORM_LABEL}
							className="scholarly-bibliography-native-textarea"
							defaultValue={inputValue}
							onChange={handleInputChange}
							onFocus={handleInputFocus}
							onKeyDown={handlePasteInputKeyDown}
							placeholder={__(
								'Add DOI(s), BibTeX entries, and citations in supported styles for books, articles, chapters, and webpages. Separate multiple formatted citations with a blank line.',
								'scholarly-bibliography'
							)}
							rows={4}
							disabled={isLoading}
						/>
					</BaseControl>
					<div className="scholarly-bibliography-form-actions">
						<Button
							variant="primary"
							className="scholarly-bibliography-parse-button"
							onClick={handleParse}
							disabled={isLoading || !inputValue.trim()}
						>
							{isLoading
								? __('Resolving…', 'scholarly-bibliography')
								: __('Add', 'scholarly-bibliography')}
						</Button>
					</div>
				</>
			) : (
				<StructuredCitationEditor
					citation={{ id: 'manual-entry' }}
					fields={manualFields}
					fieldDefinitions={manualFieldDefinitions}
					firstFieldRef={pasteZoneRef}
					getStructuredFieldId={getStructuredFieldId}
					onFieldChange={handleManualFieldChange}
					onSave={handleManualAdd}
					onCancel={handleManualClear}
					onCancelLabel={__('Clear', 'scholarly-bibliography')}
					showTypeSelector
					submitLabel={__('Add', 'scholarly-bibliography')}
					typeOptions={manualTypeOptions}
					onTypeChange={(value) =>
						handleManualFieldChange('type', value)
					}
				/>
			)}
		</>
	);

	const manualFieldDefinitions = useMemo(
		() => [
			{
				key: 'authors',
				label: __('Author(s)', 'scholarly-bibliography'),
			},
			{
				key: 'title',
				label: __('Title', 'scholarly-bibliography'),
			},
			{
				key: 'containerTitle',
				label: __('Container', 'scholarly-bibliography'),
			},
			{
				key: 'publisher',
				label: __('Publisher', 'scholarly-bibliography'),
			},
			{
				key: 'year',
				label: __('Year', 'scholarly-bibliography'),
			},
			{
				key: 'page',
				label: __('Pages', 'scholarly-bibliography'),
			},
			{
				key: 'doi',
				label: __('DOI', 'scholarly-bibliography'),
			},
			{
				key: 'url',
				label: __('URL', 'scholarly-bibliography'),
			},
		],
		[]
	);

	return (
		<div {...blockProps}>
			<BlockControls>
				<ToolbarGroup>
					<ToolbarButton
						icon={PasteImportIcon}
						label={PASTE_IMPORT_TAB_LABEL}
						isPressed={activeAddMode === 'paste'}
						onClick={() => handleAddModeChange('paste')}
					/>
					<ToolbarButton
						icon={ManualEntryIcon}
						label={MANUAL_ENTRY_TAB_LABEL}
						isPressed={activeAddMode === 'manual'}
						onClick={() => handleAddModeChange('manual')}
					/>
				</ToolbarGroup>
			</BlockControls>
			<InspectorControls>
				<PanelBody
					title={
						citations.length
							? `${__('Settings', 'scholarly-bibliography')} (${
									citations.length
							  } ${
									citations.length === 1
										? __('source', 'scholarly-bibliography')
										: __(
												'sources',
												'scholarly-bibliography'
										  )
							  })`
							: __('Settings', 'scholarly-bibliography')
					}
				>
					<SelectControl
						label={__('Citation Style', 'scholarly-bibliography')}
						value={citationStyle}
						options={selectableStyles}
						onChange={handleCitationStyleChange}
						help={__(
							'Changing styles reformats auto-generated citations and keeps manual overrides intact.',
							'scholarly-bibliography'
						)}
					/>
					<TextControl
						label={__('Visible Heading', 'scholarly-bibliography')}
						value={headingText}
						onChange={(value) =>
							setAttributes({ headingText: value })
						}
						placeholder={headingPlaceholder}
						help={__(
							'Optional heading shown above the bibliography on the site front end when at least one citation exists.',
							'scholarly-bibliography'
						)}
					/>
					<ToggleControl
						label={__('Output JSON-LD', 'scholarly-bibliography')}
						checked={outputJsonLd}
						onChange={(value) =>
							setAttributes({ outputJsonLd: value })
						}
						help={__(
							'Helps search engines and other tools understand the bibliography.',
							'scholarly-bibliography'
						)}
					/>
					<ToggleControl
						label={__('Output COinS', 'scholarly-bibliography')}
						checked={outputCoins}
						onChange={(value) =>
							setAttributes({ outputCoins: value })
						}
						help={__(
							'Lets Zotero and similar tools detect citations on the page.',
							'scholarly-bibliography'
						)}
					/>
					<ToggleControl
						label={__('Output CSL-JSON', 'scholarly-bibliography')}
						checked={outputCslJson}
						onChange={(value) =>
							setAttributes({ outputCslJson: value })
						}
						help={__(
							'Makes citation data reusable by scholarly tools and services.',
							'scholarly-bibliography'
						)}
					/>
				</PanelBody>
				<PanelBody title={__('Exports', 'scholarly-bibliography')}>
					<Button
						variant="secondary"
						onClick={handleCopyBibliography}
						disabled={!citations.length}
					>
						{__('Copy bibliography', 'scholarly-bibliography')}
					</Button>
					<p>
						{__(
							'Copies the current bibliography as plain text in the current order and style.',
							'scholarly-bibliography'
						)}
					</p>
					<Button
						variant="secondary"
						onClick={handleDownloadCslJson}
						disabled={!citations.length}
					>
						{__('Download CSL-JSON', 'scholarly-bibliography')}
					</Button>
					<p>
						{__(
							'Downloads the current bibliography as structured citation data.',
							'scholarly-bibliography'
						)}
					</p>
					<Button
						variant="secondary"
						onClick={handleDownloadBibtex}
						disabled={!citations.length}
					>
						{__('Download BibTeX', 'scholarly-bibliography')}
					</Button>
					<p>
						{__(
							'Downloads the current bibliography as BibTeX for reference-manager and scholarly-writing workflows.',
							'scholarly-bibliography'
						)}
					</p>
					<Button
						variant="secondary"
						onClick={handleDownloadRis}
						disabled={!citations.length}
					>
						{__('Download RIS', 'scholarly-bibliography')}
					</Button>
					<p>
						{__(
							'Downloads the current bibliography as RIS for citation managers and import/export workflows.',
							'scholarly-bibliography'
						)}
					</p>
				</PanelBody>
			</InspectorControls>

			{/* Heading */}
			{headingText ? (
				<p className="scholarly-bibliography-heading scholarly-bibliography-heading-preview">
					{headingText}
				</p>
			) : null}

			{/* Add form */}
			<div className="scholarly-bibliography-paste-zone">
				{sortedCitations.length === 0 ? (
					<Placeholder
						label={CITATION_FORM_LABEL}
						instructions={SUPPORTED_INPUT_MESSAGE}
						notices={
							<EditorCanvasNotices
								currentNotice={currentNotice}
								noticeRef={noticeRef}
								onDismiss={clearNotice}
							/>
						}
						className="scholarly-bibliography-placeholder"
					>
						{renderAddForm(false)}
					</Placeholder>
				) : (
					<>
						<div className="scholarly-bibliography-form-toggle-row">
							<Button
								className="scholarly-bibliography-form-toggle"
								icon={
									isFormOpen ? ChevronUpIcon : ChevronDownIcon
								}
								label={
									isFormOpen
										? __(
												'Hide citation form',
												'scholarly-bibliography'
										  )
										: __(
												'Show citation form',
												'scholarly-bibliography'
										  )
								}
								showTooltip
								onClick={() => setIsFormOpen((open) => !open)}
								aria-expanded={isFormOpen}
								variant="tertiary"
								size="small"
							/>
						</div>
						{isFormOpen && renderAddForm()}
						<EditorCanvasNotices
							currentNotice={currentNotice}
							noticeRef={noticeRef}
							onDismiss={clearNotice}
						/>
					</>
				)}
			</div>

			{/* Citation list */}
			{sortedCitations.length > 0 && (
				<ListTag className={listClassName} aria-busy={isLoading}>
					{sortedCitations.map((citation) => (
						<li
							key={citation.id}
							ref={(node) => setEntryRef(citation.id, node)}
							className={getEntryClassName(citation)}
							tabIndex={-1}
						>
							<CitationEntryBody
								citation={citation}
								citationWarnings={getCitationWarnings(citation)}
								editText={editText}
								editingId={editingId}
								getEntryLabel={getEntryLabel}
								getStructuredFieldId={getStructuredFieldId}
								handleDelete={handleDelete}
								handleCopyCitation={handleCopyCitation}
								handleEntryActivate={() =>
									handleEntryActivate(citation)
								}
								handleEditConfirm={handleEditConfirm}
								handleEditKeyDown={handleEditKeyDown}
								handleEditStart={handleEditStart}
								handleResetAutoFormat={handleResetAutoFormat}
								handleStructuredEditCancel={
									handleStructuredEditCancel
								}
								handleStructuredEditSave={
									handleStructuredEditSave
								}
								handleStructuredEditStart={
									handleStructuredEditStart
								}
								handleStructuredFieldChange={
									handleStructuredFieldChange
								}
								isStructuredEditable={isStructuredEditable(
									citation
								)}
								onEditTextChange={setEditText}
								structuredEditingId={structuredEditingId}
								structuredFields={structuredFields}
							/>
						</li>
					))}
				</ListTag>
			)}
		</div>
	);
}
