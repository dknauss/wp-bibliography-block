/**
 * Input format detection and citation-js orchestration.
 *
 * Splits pasted input into individual entries, detects DOIs and BibTeX,
 * and resolves them to CSL-JSON via citation-js.
 */

import { Cite } from '@citation-js/core';
import '@citation-js/plugin-doi';
import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-csl';
import { createCitationId } from './citation-id';
import { DEFAULT_CITATION_STYLE } from './formatting';
import { parseFreeTextCitation } from './free-text-parser';
import { SUPPORTED_INPUT_MESSAGE } from './input-support';

const DOI_ONLY_REGEX =
	/^(?:(?:https?:\/\/)?(?:dx\.)?doi\.org\/|(?:https?:\/\/)?doi:)?10\.\d{4,}\/[^\s]+$/i;
const BIBTEX_REGEX = /@\w+\{/;
const MAX_ENTRIES_PER_PASTE = 50;
const MAX_INPUT_SIZE = 1024 * 1024; // 1 MB
const PARSE_CONCURRENCY = 4;
const LATEX_DOCUMENT_PATTERN =
	/\\documentclass\b|\\begin\{document\}|\\printbibliography\b|\\addbibresource\b|\\(?:auto|foot|paren|text)?cite\w*\{/u;
const KNOWN_CSL_TYPES = new Set([
	'article',
	'article-journal',
	'article-magazine',
	'article-newspaper',
	'bill',
	'book',
	'broadcast',
	'chapter',
	'classic',
	'collection',
	'dataset',
	'document',
	'entry',
	'entry-dictionary',
	'entry-encyclopedia',
	'event',
	'figure',
	'graphic',
	'hearing',
	'interview',
	'legal_case',
	'legislation',
	'magazine',
	'manuscript',
	'map',
	'motion_picture',
	'musical_score',
	'pamphlet',
	'paper-conference',
	'patent',
	'post',
	'post-weblog',
	'personal_communication',
	'report',
	'review',
	'review-book',
	'software',
	'song',
	'speech',
	'standard',
	'thesis',
	'treaty',
	'webpage',
]);
const STRING_FIELDS = new Set([
	'title',
	'container-title',
	'publisher',
	'page',
	'volume',
	'issue',
	'DOI',
	'URL',
	'language',
	'edition',
	'medium',
	'genre',
	'publisher-place',
	'event-place',
	'reviewed-title',
]);
const STRING_OR_STRING_ARRAY_FIELDS = new Set(['ISBN', 'ISSN']);
const NAME_LIST_FIELDS = new Set(['author', 'editor', 'reviewed-author']);

function normalizeDoiInput(value) {
	return value
		.trim()
		.replace(/[).,;:\s]+$/u, '')
		.replace(/^(?:https?:\/\/)?doi:/iu, '');
}

function isPlainObject(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}

	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function sanitizeScalar(value) {
	if (
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return value;
	}

	return undefined;
}

function sanitizeCslValue(value, depth = 0) {
	if (depth > 10) {
		return undefined;
	}

	if (Array.isArray(value)) {
		return value
			.map((item) => sanitizeCslValue(item, depth + 1))
			.filter((item) => item !== undefined);
	}

	if (isPlainObject(value)) {
		return Object.entries(value).reduce(
			(accumulator, [key, nestedValue]) => {
				if (['__proto__', 'constructor', 'prototype'].includes(key)) {
					return accumulator;
				}

				const sanitizedValue = sanitizeCslValue(nestedValue, depth + 1);

				if (sanitizedValue !== undefined) {
					accumulator[key] = sanitizedValue;
				}

				return accumulator;
			},
			{}
		);
	}

	return sanitizeScalar(value);
}

function sanitizeAuthor(author) {
	if (!isPlainObject(author)) {
		throw new Error('Invalid CSL author entry.');
	}

	const sanitizedAuthor = sanitizeCslValue(author);

	for (const key of ['family', 'given', 'literal', 'ORCID']) {
		if (
			Object.prototype.hasOwnProperty.call(sanitizedAuthor, key) &&
			typeof sanitizedAuthor[key] !== 'string'
		) {
			throw new Error(`Invalid CSL author field: ${key}.`);
		}
	}

	return sanitizedAuthor;
}

function sanitizeNameList(names, field) {
	if (!Array.isArray(names)) {
		throw new Error(`Invalid CSL ${field} list.`);
	}

	return names.map(sanitizeAuthor);
}

function normalizeDatePart(part) {
	if (typeof part === 'number' && Number.isInteger(part)) {
		return part;
	}

	if (typeof part === 'string' && /^\d+$/.test(part)) {
		return Number(part);
	}

	return undefined;
}

function sanitizeIssued(issued) {
	if (!isPlainObject(issued)) {
		throw new Error('Invalid CSL issued value.');
	}

	const sanitizedIssued = sanitizeCslValue(issued);

	if (
		!Array.isArray(sanitizedIssued['date-parts']) ||
		!sanitizedIssued['date-parts'].length
	) {
		throw new Error('Invalid CSL issued date-parts.');
	}

	const dateParts = sanitizedIssued['date-parts']
		.map((datePart) => {
			if (!Array.isArray(datePart)) {
				return null;
			}

			const normalizedDatePart = datePart
				.map(normalizeDatePart)
				.filter((part) => part !== undefined);

			return normalizedDatePart.length ? normalizedDatePart : null;
		})
		.filter(Boolean);

	if (!dateParts.length) {
		throw new Error('Invalid CSL issued date-parts.');
	}

	sanitizedIssued['date-parts'] = dateParts;

	return sanitizedIssued;
}

function stripHtmlTags(text) {
	let result = text;
	let previous;
	do {
		previous = result;
		result = result.replace(/<[^>]*>/gu, '');
	} while (result !== previous);
	return result;
}

function sanitizeStringField(value, field) {
	if (typeof value !== 'string') {
		throw new Error(`Invalid CSL ${field}.`);
	}

	return stripHtmlTags(value);
}

function sanitizeStringOrStringArrayField(value, field) {
	if (typeof value === 'string') {
		return stripHtmlTags(value);
	}

	if (
		Array.isArray(value) &&
		value.every((item) => typeof item === 'string')
	) {
		return value.map(stripHtmlTags);
	}

	throw new Error(`Invalid CSL ${field}.`);
}

function normalizeWhitespace(value) {
	return (value || '').trim().replace(/\s+/gu, ' ');
}

function stripTrailingReviewExtras(title) {
	return title
		.replace(
			/\.\s+[A-Z][^.]*,\s*\d{4}\.\s+\d+\s+pp\.\s+(?:[$£€]\s*)?\d+[^.]*\.?$/u,
			''
		)
		.replace(/\.\s+\d+\s+pp\.\s+(?:[$£€]\s*)?\d+[^.]*\.?$/u, '')
		.trim();
}

function stripRepeatedReviewTitle(title) {
	const words = title.split(/\s+/u).filter(Boolean);

	if (words.length < 6) {
		return title;
	}

	let secondIndex = -1;

	for (
		let probeLength = Math.min(10, words.length - 1);
		probeLength >= 4 && secondIndex === -1;
		probeLength--
	) {
		const probe = words.slice(0, probeLength).join(' ');
		secondIndex = title.indexOf(probe, probe.length);
	}

	if (secondIndex === -1) {
		return title;
	}

	return title
		.slice(0, secondIndex)
		.replace(/\s+[A-Z][a-z]+[A-Z][\s\S]*$/u, '')
		.trim();
}

function getReviewedAuthorFamilyNames(reviewedAuthors) {
	return reviewedAuthors
		.split(/\band\b|,/iu)
		.map((name) => name.trim().replace(/\.$/u, '').split(/\s+/u).pop())
		.filter(Boolean);
}

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function stripDuplicatedReviewAuthorMarkers(title, reviewedAuthors) {
	const familyNames = getReviewedAuthorFamilyNames(reviewedAuthors);

	for (const familyName of familyNames) {
		const duplicateMarkerMatch = title.match(
			new RegExp(`\\s+${escapeRegExp(familyName)}[A-Z]`, 'u')
		);

		if (duplicateMarkerMatch?.index) {
			return title.slice(0, duplicateMarkerMatch.index).trim();
		}
	}

	return title;
}

function normalizeReviewRecordTitle(title) {
	const normalizedTitle = normalizeWhitespace(title);
	const titleWithoutReviewExtras = stripTrailingReviewExtras(normalizedTitle);
	const sentenceMatch = titleWithoutReviewExtras.match(
		/^(?<reviewedAuthors>.+?\b[\p{Lu}][\p{L}'’.-]+)\.\s+(?<reviewedTitle>.+)$/u
	);

	if (!sentenceMatch?.groups) {
		return titleWithoutReviewExtras.replace(/\.$/u, '');
	}

	const cleanedReviewedTitle = stripDuplicatedReviewAuthorMarkers(
		stripRepeatedReviewTitle(sentenceMatch.groups.reviewedTitle),
		sentenceMatch.groups.reviewedAuthors
	);

	return `${sentenceMatch.groups.reviewedAuthors}. ${cleanedReviewedTitle}`
		.trim()
		.replace(/\.$/u, '');
}

function getReviewMetadataWarnings(inputFormat, originalCsl, normalizedCsl) {
	if (
		inputFormat === 'doi' &&
		normalizedCsl.type === 'article-journal' &&
		normalizedCsl['container-title'] &&
		typeof originalCsl.title === 'string' &&
		typeof normalizedCsl.title === 'string' &&
		originalCsl.title !== normalizedCsl.title &&
		!normalizedCsl.page
	) {
		return ['review-metadata-incomplete'];
	}

	return [];
}

function normalizeResolvedCsl(csl, inputFormat) {
	const normalizedCsl = {
		...csl,
	};

	if (
		normalizedCsl.type === 'article-journal' &&
		typeof normalizedCsl.title === 'string' &&
		normalizedCsl['container-title'] &&
		(/\b\d+\s+pp\./u.test(normalizedCsl.title) ||
			/[$£€]\s*\d+/u.test(normalizedCsl.title) ||
			/[a-z][A-Z][a-z]/u.test(normalizedCsl.title))
	) {
		normalizedCsl.title = normalizeReviewRecordTitle(normalizedCsl.title);
	}

	return {
		csl: normalizedCsl,
		parseWarnings: getReviewMetadataWarnings(
			inputFormat,
			csl,
			normalizedCsl
		),
	};
}

/**
 * Validate and sanitize a CSL-JSON object for safe storage and rendering.
 *
 * @param {Object} csl CSL-JSON object.
 * @return {Object} Sanitized CSL-JSON object.
 * @throws {Error} If the CSL object is invalid.
 *
 * @since 0.1.0
 */
export function validateAndSanitizeCsl(csl) {
	if (!isPlainObject(csl)) {
		throw new Error('Invalid CSL object.');
	}

	const sanitizedCsl = sanitizeCslValue(csl);

	if (!KNOWN_CSL_TYPES.has(sanitizedCsl.type)) {
		throw new Error('Invalid CSL type.');
	}

	if (
		Object.prototype.hasOwnProperty.call(sanitizedCsl, 'title') &&
		typeof sanitizedCsl.title !== 'string'
	) {
		throw new Error('Invalid CSL title.');
	}

	for (const field of NAME_LIST_FIELDS) {
		if (Object.prototype.hasOwnProperty.call(sanitizedCsl, field)) {
			sanitizedCsl[field] = sanitizeNameList(sanitizedCsl[field], field);
		}
	}

	if (Object.prototype.hasOwnProperty.call(sanitizedCsl, 'issued')) {
		sanitizedCsl.issued = sanitizeIssued(sanitizedCsl.issued);
	}

	if (Object.prototype.hasOwnProperty.call(sanitizedCsl, 'accessed')) {
		sanitizedCsl.accessed = sanitizeIssued(sanitizedCsl.accessed);
	}

	for (const field of STRING_FIELDS) {
		if (Object.prototype.hasOwnProperty.call(sanitizedCsl, field)) {
			sanitizedCsl[field] = sanitizeStringField(
				sanitizedCsl[field],
				field
			);
		}
	}

	for (const field of STRING_OR_STRING_ARRAY_FIELDS) {
		if (Object.prototype.hasOwnProperty.call(sanitizedCsl, field)) {
			sanitizedCsl[field] = sanitizeStringOrStringArrayField(
				sanitizedCsl[field],
				field
			);
		}
	}

	return sanitizedCsl;
}

/**
 * Detect the format of a single chunk of text.
 *
 * @param {string} chunk Trimmed text segment.
 * @return {Object|null} { format: 'doi'|'bibtex', value: string } or null.
 */
function detectFormat(chunk) {
	if (DOI_ONLY_REGEX.test(chunk)) {
		return { format: 'doi', value: chunk };
	}

	if (BIBTEX_REGEX.test(chunk)) {
		return { format: 'bibtex', value: chunk };
	}

	return { format: 'freetext', value: chunk };
}

function createDetectedItem(format, value, rawValue = value) {
	return {
		format,
		value,
		rawValue,
	};
}

function looksLikeStandaloneCitationLine(line) {
	const normalizedLine = line.trim();

	if (!normalizedLine) {
		return false;
	}

	if (detectFormat(normalizedLine).format === 'doi') {
		return true;
	}

	return /(?:\.|[)!?]|https?:\/\/\S+)$/u.test(normalizedLine);
}

function splitChunkIntoDetectedItems(chunk) {
	if (BIBTEX_REGEX.test(chunk)) {
		return chunk
			.split(/(?=@\w+\{)/)
			.map((entry) => entry.trim())
			.filter(Boolean)
			.map((entry) => createDetectedItem('bibtex', entry, entry));
	}

	const lines = chunk
		.split(/\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	if (!lines.length) {
		return [];
	}

	const allLinesAreDois =
		lines.length > 1 &&
		lines.every((line) => detectFormat(line).format === 'doi');

	if (allLinesAreDois) {
		return lines.map((line) => createDetectedItem('doi', line, line));
	}

	const allLinesLookStandalone =
		lines.length > 1 && lines.every(looksLikeStandaloneCitationLine);

	if (allLinesLookStandalone) {
		return lines.map((line) => {
			const detectedLine = detectFormat(line);
			return createDetectedItem(
				detectedLine.format,
				detectedLine.value,
				line
			);
		});
	}

	const normalizedChunk = lines.join(' ');
	const detectedChunk = detectFormat(normalizedChunk);

	return [
		createDetectedItem(
			detectedChunk.format,
			detectedChunk.value,
			chunk.trim()
		),
	];
}

const PARSER_BACKENDS = {
	doi: async (value) => {
		const cite = await Cite.async(normalizeDoiInput(value));

		return {
			cslItems: cite.get({ type: 'json' }),
		};
	},
	bibtex: async (value) => {
		const cite = await Cite.async(normalizeBibtexInput(value));

		return {
			cslItems: cite.get({ type: 'json' }),
		};
	},
	freetext: async (value) => {
		const parsedCitation = parseFreeTextCitation(value);

		if (!parsedCitation) {
			throw new Error(SUPPORTED_INPUT_MESSAGE);
		}

		return {
			cslItems: [parsedCitation.csl],
		};
	},
};

const BIBTEX_ENTRY_TYPE_ALIASES = {
	artikel: 'article',
	buch: 'book',
	inbuch: 'inbook',
	insammlung: 'incollection',
};

function normalizeBibtexInput(value) {
	return value.replace(
		/^(\s*)@([a-z-]+)\s*\{/iu,
		(match, leadingWhitespace, entryType) => {
			const normalizedEntryType =
				BIBTEX_ENTRY_TYPE_ALIASES[entryType.toLowerCase()] || entryType;

			return `${leadingWhitespace}@${normalizedEntryType}{`;
		}
	);
}

async function mapWithConcurrency(items, concurrency, mapper) {
	const results = new Array(items.length);
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < items.length) {
			const currentIndex = nextIndex;
			nextIndex += 1;
			results[currentIndex] = await mapper(
				items[currentIndex],
				currentIndex
			);
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, () =>
			worker()
		)
	);

	return results;
}

function formatUnsupportedInputError() {
	return SUPPORTED_INPUT_MESSAGE;
}

function formatLatexDocumentError() {
	return 'This looks like LaTeX, not a bibliography entry. Paste a DOI, BibTeX entry, or supported citation instead.';
}

function formatBackendParseError(format, err) {
	if (
		err?.message &&
		/^(Invalid CSL|CSL item must|CSL root must)/u.test(err.message)
	) {
		return err.message;
	}

	if (format === 'doi') {
		return "Couldn't parse the DOI. Check it and try again.";
	}

	if (format === 'bibtex') {
		return "Couldn't parse the BibTeX entry. Check it and try again.";
	}

	return "Couldn't parse the citation. Check it and try again.";
}

/**
 * Parse pasted input into an array of CSL-JSON citation objects.
 *
 * @param {string}  input                     Raw pasted text.
 * @param {string}  styleKey                  Style key for derived formatting.
 * @param {Object}  [options={}]              Parse options.
 * @param {boolean} [options.deferFormatting] When true (default), leave
 *                                            `formattedText` empty so callers
 *                                            can decide if and when to format.
 *                                            When false, format entries inside
 *                                            the parser for legacy/explicit
 *                                            call sites.
 * @return {Promise<Object>} { entries: Array, errors: Array, truncated: boolean }
 *
 * @since 0.1.0
 */
export async function parsePastedInput(
	input,
	styleKey = DEFAULT_CITATION_STYLE,
	{ deferFormatting = true } = {}
) {
	const errors = [];
	let truncated = false;

	if (!input || !input.trim()) {
		return {
			entries: [],
			errors: [],
			truncated: false,
			remainingInput: '',
		};
	}

	if (input.length > MAX_INPUT_SIZE) {
		return {
			entries: [],
			errors: ['The pasted input is too large. Maximum size is 1 MB.'],
			truncated: false,
			remainingInput: input.trim(),
		};
	}

	if (LATEX_DOCUMENT_PATTERN.test(input)) {
		return {
			entries: [],
			errors: [formatLatexDocumentError()],
			truncated: false,
			remainingInput: input.trim(),
		};
	}

	// Split on blank lines first; for multi-line chunks, use conservative
	// line-based heuristics before falling back to a single normalized chunk.
	const chunks = input
		.split(/\n\s*\n/)
		.map((c) => c.trim())
		.filter(Boolean);

	let detected = chunks.flatMap(splitChunkIntoDetectedItems);
	let overflowItems = [];

	if (detected.length > MAX_ENTRIES_PER_PASTE) {
		truncated = true;
		overflowItems = detected.slice(MAX_ENTRIES_PER_PASTE);
		detected = detected.slice(0, MAX_ENTRIES_PER_PASTE);
	}

	const entries = [];
	const remainingSegments = overflowItems.map((item) => item.rawValue);
	const resolvedItems = await mapWithConcurrency(
		detected,
		PARSE_CONCURRENCY,
		async (item) => {
			try {
				const { cslItems } = await PARSER_BACKENDS[item.format](
					item.value
				);

				return {
					item,
					entries: cslItems.map((csl) => {
						const { csl: normalizedCsl, parseWarnings } =
							normalizeResolvedCsl(csl, item.format);
						const sanitizedCsl =
							validateAndSanitizeCsl(normalizedCsl);

						return {
							id: createCitationId(),
							csl: sanitizedCsl,
							formattedText: null,
							displayOverride: null,
							inputFormat: item.format,
							parseWarnings,
						};
					}),
				};
			} catch (err) {
				return {
					item,
					error:
						item.format === 'freetext'
							? formatUnsupportedInputError()
							: formatBackendParseError(item.format, err),
				};
			}
		}
	);

	for (const resolvedItem of resolvedItems) {
		if (resolvedItem.error) {
			errors.push(resolvedItem.error);
			remainingSegments.push(resolvedItem.item.rawValue);
			continue;
		}

		entries.push(...resolvedItem.entries);
	}

	if (!deferFormatting && entries.length) {
		const { formatBibliographyEntries } = await import('./formatting/csl');
		const formattedTexts = await formatBibliographyEntries(
			entries.map((entry) => entry.csl),
			styleKey
		);

		for (const [index, entry] of entries.entries()) {
			entry.formattedText = formattedTexts[index];
		}
	}

	return {
		entries,
		errors,
		truncated,
		remainingInput: remainingSegments.join('\n\n'),
	};
}

/**
 * Maximum number of entries allowed per paste operation.
 *
 * @since 0.1.0
 */
export { MAX_ENTRIES_PER_PASTE };
/**
 * User-facing message for unsupported input types.
 *
 * @since 0.1.0
 */
export { SUPPORTED_INPUT_MESSAGE };
