import { useBlockProps } from '@wordpress/block-editor';
import { buildCoins } from './lib/coins';
import {
	getDisplaySegments,
	getListSemantics,
	splitTextIntoLinkParts,
	getStyleDefinition,
} from './lib/formatting';
import { buildJsonLdString, buildCslJsonString } from './lib/jsonld';
import { sortCitations } from './lib/sorter';

export function renderBibliographySave(
	attributes,
	{
		sortEntries = true,
		headingTag = 'p',
		entryTag = 'cite',
		linkVisibleUrls = true,
		ariaLabel = null,
	} = {}
) {
	const {
		citationStyle,
		citations,
		headingText,
		outputJsonLd = true,
		outputCoins = false,
		outputCslJson = false,
	} = attributes;

	if (!citations || citations.length === 0) {
		return null;
	}

	const blockProps = useBlockProps.save();
	const renderedCitations = sortEntries
		? sortCitations(citations, citationStyle)
		: citations;
	const cslArray = renderedCitations.map((c) => c.csl);
	const styleDefinition = getStyleDefinition(citationStyle);
	const ListTag = getListSemantics(citationStyle);
	const listClassName = `scholarly-bibliography-list scholarly-bibliography-list-${
		styleDefinition.listType === 'ol' ? 'numeric' : 'unordered'
	} scholarly-bibliography-list-${citationStyle}`;
	const HeadingTag = headingTag;
	const EntryTag = entryTag;

	return (
		<section
			{...blockProps}
			role="doc-bibliography"
			aria-label={ariaLabel || headingText || 'Bibliography'}
		>
			{headingText ? (
				<HeadingTag className="scholarly-bibliography-heading">
					{headingText}
				</HeadingTag>
			) : null}
			<ListTag className={listClassName}>
				{renderedCitations.map((citation) => {
					const displaySegments = getDisplaySegments(citation);
					const coinsTitle = outputCoins
						? buildCoins(citation.csl)
						: null;

					return (
						<li
							key={citation.id}
							role="doc-biblioentry"
							id={`ref-${citation.id}`}
							lang={citation.csl.language || undefined}
						>
							<EntryTag className="scholarly-bibliography-entry-text">
								{displaySegments.map((segment, index) => {
									const content = linkVisibleUrls
										? splitTextIntoLinkParts(
												segment.text
										  ).map((part, partIndex) =>
												part.link ? (
													<a
														key={`${citation.id}-${index}-${partIndex}`}
														href={part.href}
														rel="nofollow noopener noreferrer"
													>
														{part.text}
													</a>
												) : (
													part.text
												)
										  )
										: segment.text;

									return segment.italic ? (
										<i key={`${citation.id}-${index}`}>
											{content}
										</i>
									) : (
										content
									);
								})}
							</EntryTag>
							{outputCoins ? (
								<span
									className="Z3988"
									aria-hidden="true"
									title={coinsTitle}
								/>
							) : null}
						</li>
					);
				})}
			</ListTag>

			{outputJsonLd ? (
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: buildJsonLdString(cslArray),
					}}
				/>
			) : null}

			{outputCslJson ? (
				<script
					type="application/vnd.citationstyles.csl+json"
					dangerouslySetInnerHTML={{
						__html: buildCslJsonString(cslArray),
					}}
				/>
			) : null}
		</section>
	);
}
