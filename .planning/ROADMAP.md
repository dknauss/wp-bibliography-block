# Roadmap

## Active phases

1. MVP stabilization and spec alignment
2. Enhanced input support
3. Multi-style foundation and Chicago default realignment
4. Core multi-style bibliography support
5. Remaining specialized style support
6. Structured editing
7. In-text citation integration

## Phase detail

### 3. Multi-style foundation and Chicago default realignment

-   Confirm the intended default style as **Chicago Notes-Bibliography**
-   Keep **Chicago Author-Date** as a supported alternate Chicago mode
-   Update spec, README, tests, fixtures, and UI copy to stop assuming Author-Date as the baseline
-   Make style family behavior first-class in the style registry:
    -   `notes`
    -   `author-date`
    -   `numeric`
-   Verify bibliography sort behavior by style family
-   Verify formatter wiring for bundled Chicago templates

### 4. Core multi-style bibliography support

Ship and validate the most important broadly used bibliography styles:

-   Chicago Notes-Bibliography
-   Chicago Author-Date
-   APA 7
-   MLA 9
-   Harvard
-   Vancouver
-   IEEE

Acceptance goals:

-   selectable styles in the editor
-   style-specific bibliography formatting
-   style-specific list semantics (`ul` vs `ol`)
-   style-specific sorting where needed
-   style switching that preserves `displayOverride`
-   save output remains static and valid across style changes
-   keep save/output behavior valid across the full core style set
-   add remaining spec-strength tests, especially around:
    -   corporate-author sorting edge cases
    -   lang omission/save behavior in more combinations
    -   review-record DOI fixtures
-   document the current supported input/style matrix so expectations are clear while multi-style support expands

### 5. Remaining specialized style support

Add styles that are important but more specialized or region/domain specific:

-   OSCOLA
-   ABNT

Acceptance goals:

-   style-specific bibliography parity for common source types
-   tests and fixtures for legal and regional edge cases
-   no regression in existing core-style behavior

## Style-track priorities

### Default / primary style

1. Chicago Notes-Bibliography

### Core supported styles

2. Chicago Author-Date
3. APA 7
4. MLA 9
5. Harvard
6. Vancouver
7. IEEE

### Specialized / follow-on styles

8. OSCOLA
9. ABNT

## Product direction notes

-   The plugin should be treated as a **multi-style scholarly bibliography platform**, not a Chicago-only formatter.
-   Style behavior includes more than visible citation text:
    -   bibliography formatting
    -   sort rules
    -   list semantics
    -   future inline citation mode
    -   validation expectations
-   The default-style migration should proceed only after the docs/spec/test baseline clearly reflects the intended Chicago Notes-Bibliography default.

## Export backlog

Future export work should prioritize practical download/use cases over additional invisible metadata layers:

Completed:

1. **CSL-JSON export**
2. **BibTeX export**
3. **RIS export**

These exports would complement the existing metadata-output toggles by giving users tangible bibliography data files they can download and reuse directly.

## Performance hardening track

Grounded in the 2026-04-04 Xdebug/profile review:

Completed on 2026-04-04 / 2026-04-05:

-   batched duplicate editor-side CSL formatting requests behind a shared formatter path
-   deferred eager formatting during paste/import so parsing can finish before formatting work begins
-   added a repeatable local benchmark harness (`npm run benchmark:perf`) with cold-cache import/style-switch/manual-entry timings

Ongoing performance watchpoints:

1. keep `build/index.asset.php` lean
2. rerun the benchmark harness after major formatter or parser changes
3. use caller-owned / opt-in formatting responsibility as the default model for any new parser-adjacent work

### Citation-citeproc investigation and load-strategy reduction

The next performance-planning task is explicitly an investigation phase, not an immediate rewrite. It should:

-   build a module inventory for `citation-citeproc.js`
-   document every runtime path that triggers it
-   identify which paths could defer citeproc later
-   identify which non-final interactions might avoid citeproc entirely
-   decide whether load-strategy tuning is sufficient before considering deeper formatter architecture changes

The expected outcome is a recommendation memo, not a premature library swap.

Investigation outcome on 2026-04-05:

-   `citation-citeproc.js` is effectively the upstream `citeproc_commonjs.js` payload
-   caller-owned / opt-in formatting responsibility has now landed in `parsePastedInput()` as the default behavior
-   deeper formatter architecture changes are not justified yet

## WordPress.org asset follow-up

Completed:

-   added WordPress.org banner assets from the approved banner image in `.wordpress-org/`

Planned next:

-   generate editor/frontend screenshots in a browser-capable session for the plugin directory listing

## Compatibility and runtime coverage backlog

Completed:

-   expanded the GitHub Actions runtime matrix across additional Apache/Nginx/PHP/WordPress combinations
-   added a SQLite single-site runtime smoke lane with the same artifact capture used for MySQL lanes

Planned next:

-   add multisite runtime smoke coverage so at least one network-install lane is exercised in CI

## wp.org submission track

Items required before the plugin directory submission is complete:

1. **Verify Codecov badge** — CI condition was fixed (`secrets.CODECOV_TOKEN`); confirm badge resolves after next push to main.
2. **Debug Playground block registration** — block does not appear in the Playground block editor; likely a runtime JS error; requires a browser-capable session (`/Users/danknauss/bin/claude-playwright`).
3. **Generate plugin-directory screenshots** — editor and frontend screenshots needed for the wp.org listing; requires a browser-capable session.
4. **Submit to wp.org** — upload `bibliography-block.zip` from the v1.0.0 GitHub Release.

## Code quality backlog

Identified in the 2026-04-08 post-release review. All are non-blocking improvements deferred from the 1.0.0 sweep:

### Consolidate `getPrimaryIdentifierValue`

Identical implementation is copy-pasted across three files:

-   `src/lib/coins.js:89`
-   `src/lib/jsonld.js:19`
-   `src/lib/export.js:63`

Extract to a shared utility (e.g. `src/lib/csl-utils.js`) and import from there. Add a single test for the shared function.

### Upgrade format cache from FIFO to LRU

`FORMAT_CACHE` in `src/lib/formatting/csl.js` evicts the oldest-inserted entry regardless of access recency. A frequently accessed entry can be evicted while stale entries survive. Replace with a simple LRU eviction policy (track access order on get).

### Reconcile `getYear` sentinel values

Two private `getYear` implementations with different semantics for missing dates:

-   `src/lib/sorter.js` returns `Infinity` (correct for sort-last behavior)
-   `src/lib/export.js` returns `undefined` (correct for output suppression)

Same name, different contracts. Document the distinction explicitly or rename one to make the intent clear at the call site.

## Backlog / architecture investigations

### Translation backlog

Completed interface locale files:

-   fr_FR
-   de_DE
-   nl_NL
-   sv_SE
-   es_ES
-   it_IT
-   pt_PT
-   pl_PL
-   ru_RU
-   ja
-   zh_CN
-   ko_KR
-   sr_RS
-   hr
-   pt_BR
-   hi_IN
-   bn_BD
-   ta_IN
-   te

Recommended next locale backlog, prioritizing broad WordPress usage after the current shipped set:

-   ar
-   tr_TR
-   id_ID
-   he_IL
-   vi
-   uk
-   ro_RO
-   cs_CZ

### Option B: citation child blocks

Explore a future architecture where each citation becomes a child block instead of an item in a parent `citations` array.

Potential benefits:

-   more Gutenberg-native item selection and toolbars
-   block-editor history/undo may align better with citation-level delete/edit actions
-   clearer List View representation for individual citations

Known costs and risks:

-   major data-model refactor
-   parent/child coordination for sorting, deduplication, and style switching
-   save/migration complexity for JSON-LD, COinS, CSL-JSON, and static bibliography output
-   likely requires a dedicated migration phase rather than an incremental UI tweak

Status:

-   backlog only
-   do not start before current single-block UX, sorting, and multi-style behavior are stable

### Input workflow progress

Completed in manual-entry v1:

-   added an alternate **Manual entry** mode alongside the default paste/import flow
-   kept paste/import as the default path; manual entry remains a secondary input path
-   shipped v1 with the current 8 structured fields plus a required Publication Type selector
-   used this curated v1 type list: book, journal article, chapter, edited collection, thesis / dissertation, webpage
-   required only title + type in v1; all other fields remain optional
-   created canonical CSL directly from the manual form, then formatted, sorted, and style-switched through the existing citation pipeline

Follow-on hardening:

-   add broader save-path/output coverage for manual citations where helpful
-   evaluate bundle-size impact from manual-entry formatting imports and optimize if needed

### Editor and formatting maintainability follow-ups

Track the following as non-blocking cleanup / maintainability work:

-   evaluate whether module-scope `__()` calls should be moved behind functions for better test portability and i18n initialization safety
-   reduce prop drilling into `CitationEntryBody`, likely by grouping callbacks/state or introducing a narrower editing/actions interface
-   review corporate-author sorting behavior for records that include both `family` and `literal`, and add fixture coverage if needed
-   evaluate a later semantic enhancement to wrap visible bibliography authors individually in HTML; JSON-LD and CSL-JSON already preserve separate author objects, while COinS currently flattens to first-author fields only
-   keep the current native Gutenberg notification split: block-local inline notices for contextual validation and mixed-result feedback, with block-local snackbars reserved for pure success states
-   low-priority follow-up: periodically verify accessibility of the citation-row interaction model (click-to-edit, row action reveal, focus recovery) as Gutenberg/editor behavior evolves
-   low-priority follow-up: reconsider global snackbars for pure success-only cases if future UX testing shows they improve clarity without weakening block-local validation feedback

### Metadata output progress

Completed:

-   kept **JSON-LD** enabled by default
-   made **COinS** opt-in
-   made **CSL-JSON** opt-in
-   exposed metadata layers as explicit user-selectable output controls

### Completed hardening work (2026-04-03 / 2026-04-04)

-   enabled Harvard, Vancouver, IEEE, and MLA 9 as selectable core styles
-   shipped per-entry Copy citation actions in the editor
-   shipped a Copy bibliography action in the editor
-   shipped read-only bibliography REST endpoints for programmatic access
-   added formatter coverage for Harvard, Vancouver, IEEE, and MLA 9
-   shipped OSCOLA as the first remaining specialized legal style
-   shipped ABNT as the current specialized regional style
-   added save-path coverage for manually entered citations and metadata-layer toggles
-   optimized manual-entry formatting import so the main editor entrypoint stays small

-   synced `SPEC.md`, `README.md`, QA checklists, and planning docs with the current implementation
-   reduced persisted citation payload for new entries by dropping `inputRaw`, `parsedAt`, and `parseConfidence`
-   improved batch DOI performance with bounded-concurrency parsing while preserving stable result ordering
-   tightened CSL field validation for additional scalar and structured fields
-   improved JSON-LD typing for literal-only corporate/institutional authors so they can emit `Organization`
