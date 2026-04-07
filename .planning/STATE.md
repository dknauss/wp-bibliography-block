# Project State

## Current Focus

1. Post-export cleanup and longer-term maintainability backlog.
2. Optional future UX refinements around citation-row interaction and success-message behavior.
3. Broadened runtime compatibility coverage, with multisite smoke still planned.
4. Future API/interoperability backlog.

## Current Priority Order

1. Post-export cleanup and longer-term semantic and maintainability backlog
    - per-author visible HTML wrappers
    - citation child-block architecture option
    - prop-drilling / module-scope i18n cleanup
2. Low-priority UX follow-up
    - periodically re-check row-interaction accessibility
    - reconsider global snackbars for pure success-only cases if it ever improves clarity
3. Runtime compatibility coverage
    - expanded CI/runtime matrix across more PHP, WordPress, Apache, Nginx, and SQLite combinations
    - plan a follow-on multisite smoke lane
4. Future API/interoperability backlog
    - build on shipped copy-citation and bibliography REST access
    - consider richer API fields, discovery, or collection-level endpoints

## Last activity

Recent work completed in the working tree includes:

-   docs/spec/checklist sync across `README.md`, `SPEC.md`, and QA worksheets
-   reduced persisted citation payload for new entries by dropping `inputRaw`, `parsedAt`, and `parseConfidence`
-   bounded-concurrency DOI parsing with stable result ordering
-   tighter CSL validation for additional structured fields
-   JSON-LD corporate-author typing improvements (`Organization` for literal-only institutional authors)
-   metadata output controls verified live on the front end
-   additional spec-strength tests for sorting, `lang`, and review DOI fixtures
-   spec clarification that focus-management behavior is already implemented and tested
-   manual-entry v1 shipped with a second add mode, curated 6-type selector, and the current 8 structured fields plus Publication Type
-   Harvard, Vancouver, IEEE, MLA 9, OSCOLA, and ABNT are now enabled selectable styles, with formatter and save-path coverage
-   manual-entry formatting moved behind async loading so the main editor entrypoint stays small
-   Xdebug trace/profile capture confirms PHP runtime cost is mostly WordPress/theme bootstrap; plugin-specific PHP cost is concentrated in `build/index.asset.php`
-   editor-side CSL formatting now batches duplicate work, paste/import defers formatting until the editor actually needs it, and a repeatable local benchmark harness now records cold-cache timings
-   `parsePastedInput()` is now parse-first by default; callers must opt in explicitly if they want parser-owned formatting, and lint/tests/benchmarks/build all passed after the change
-   native notification follow-up landed: Gutenberg `Notice`/`Snackbar` primitives now handle block-local feedback with success-only snackbars and inline mixed-result validation notices
-   submission-readiness packaging landed: `npm run package:release` creates a clean artifact and Plugin Check passed against the staged release directory with no errors
-   CSL-JSON, BibTeX, and RIS exports now ship in the editor as practical downloadable bibliography-data formats
-   a per-entry copy-citation action now ships in the editor for reusing visible citation text
-   a Copy bibliography action now ships in the editor for copying the current bibliography as plain text
-   read-only REST endpoints now expose bibliography block data at `/wp-json/scholarly-bibliography/v1/posts/<post_id>/bibliographies` and `/wp-json/scholarly-bibliography/v1/posts/<post_id>/bibliographies/<index>`
-   GitHub Actions runtime coverage now spans additional Apache/Nginx/PHP/WordPress combinations and includes a SQLite smoke lane

## Active Concerns

-   The remaining style-expansion focus has shifted away from core bibliography styles now that OSCOLA and ABNT both shipped.
-   The benchmark harness makes it easier to watch regression risk in editor-side formatting and deferred citation chunks over time.
-   Notification behavior is now intentionally split between block-local inline notices for contextual validation and block-local snackbars for pure success messages.
-   Low-priority backlog: periodically re-check row-interaction accessibility and reconsider snackbar-only handling for pure success states if it improves clarity without losing local validation context.
-   Export-format groundwork is now in place, and copy citation, Copy bibliography, plus the read-only bibliography REST endpoints now provide practical next-layer interoperability.
-   Build remains healthy, with `citation-citeproc.js` now the only oversized deferred asset after the style-template reduction pass.
-   The citeproc investigation confirmed that `citation-citeproc.js` is effectively `citeproc_commonjs.js`; narrower load responsibility has now landed, so the remaining question is whether future work should target load strategy only or leave citeproc architecture alone.

## Pending Todos

-   1 pending todo in `.planning/todos/pending`
    - Add multisite runtime smoke coverage

## Roadmap Alignment

The project is currently between:

-   Phase 4: Core multi-style bibliography support
-   Phase 5: Remaining specialized style support
-   follow-on roadmap work around editor/output hardening

In practice, the near-term execution order is:

-   backlog architecture work
-   follow-on multisite runtime coverage
-   future API/interoperability work
