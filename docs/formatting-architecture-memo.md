# Formatting Architecture Memo & Migration Plan

## Decision

Keep the CSL/citeproc stack as the **canonical formatting engine** for the near-term roadmap. Do **not** replace it with a custom Chicago-only formatter now.

The plugin should continue to treat **CSL-JSON as the source of truth** and should continue to route bibliography formatting through a **CSL-backed path** while the project moves toward Phase 3 multi-style support.

## Why

-   Phase 3 in `/Users/danknauss/Developer/GitHub/bibliography-builder/SPEC.md` explicitly commits the project to multiple styles: APA, MLA, Chicago variants, Harvard, IEEE, and Vancouver.
-   A Chicago-only custom formatter would optimize the wrong axis. It would reduce one style’s formatting cost while creating a likely rewrite when multi-style support lands.
-   The initial editor bundle is already small after async splitting. The remaining heavy code is deferred, so the immediate performance problem has been addressed without changing formatting semantics.
-   The project’s strongest long-term invariant is already clear in the spec: **CSL-JSON is authoritative; formatted display text is derived**.

## What changes now

-   Introduce a **formatting subsystem boundary** instead of embedding formatting assumptions directly in parser, editor, and save logic.
-   Introduce a **style registry** keyed by stable style slugs such as `chicago-author-date`, `apa-7`, `mla-9`, `ieee`, and `vancouver`.
-   Treat `formattedText` as a **derived cache** for auto-formatted output, not authoritative citation data.
-   Keep static save, semantic HTML, JSON-LD, COinS, and CSL-JSON output all derived from CSL data rather than user-edited display strings.

## Architecture direction

### Canonical invariants

-   `csl` remains the only canonical citation data model.
-   `citationStyle` is the stable formatting selector.
-   `displayOverride` remains display-only and must not be used to migrate styles or mutate CSL data.
-   Saved output remains static and portable.

### Formatting subsystem boundary

All formatting-related code should converge on an internal contract:

-   `formatBibliographyEntry(csl, styleKey) -> string`
-   `getStyleDefinition(styleKey) -> style metadata`
-   `getListSemantics(styleKey) -> ul|ol`
-   future: `formatInlineCitation(...)`

This boundary is internal only. It exists so the codebase can support:

-   the current CSL backend,
-   future style packs and UI affordances,
-   optional specialized formatters later without rewriting editor/save behavior.

### Style registry

The style registry should remain independent from parser and rendering code. Each style entry should define:

-   stable slug
-   display label
-   formatter backend identifier
-   CSL template identifier
-   list semantics (`ul` vs `ol`)
-   style family (`author-date`, `numeric`, `notes`)
-   future inline citation mode (`parenthetical`, `numeric`, `note`)

This keeps Phase 3 implementation decision-complete without scattering style rules across the UI and save path.

### Derived text handling

`formattedText` is acceptable in MVP as a persisted optimization, but it should be treated as a cache of auto-formatted output. It is **not** a replacement for CSL data and it must not become a second source of truth.

Default stance:

-   keep `csl` authoritative,
-   keep `citationStyle` authoritative for auto-formatting,
-   keep `displayOverride` authoritative only when present,
-   do **not** expand persisted cache shape yet.

When style switching is added, non-overridden entries should be regenerated from CSL-JSON instead of trusting stale cached text.

## Migration path

### 1. MVP stabilization

-   Keep CSL-backed formatting as the only formatter backend in active use.
-   Maintain async loading boundaries so formatting code is not part of the initial editor payload.
-   Route all display decisions through the formatting subsystem rather than direct formatting imports.

### 2. Phase 3 multi-style implementation

-   Add UI for selecting supported styles from the registry.
-   On style change, re-render all non-overridden entries from CSL-JSON.
-   Preserve `displayOverride` until the user explicitly resets it.
-   Switch `<ul>` vs `<ol>` automatically based on style metadata.
-   Keep JSON-LD, COinS, and CSL-JSON derived from canonical CSL data regardless of visible overrides.

### 3. Future hybrid fast paths

If profiling later shows CSL formatting still creates unacceptable UX or bundle costs for a subset of styles:

-   add an optional specialized formatter backend for those styles,
-   keep the same internal formatting contract,
-   require snapshot parity against the canonical CSL backend for any supported style.

That preserves flexibility without committing the architecture to a Chicago-only formatter now.

## Decision checkpoints

Re-evaluate formatter replacement only after all of the following are true:

-   multi-style support exists in production,
-   real profiler data shows CSL formatting remains the dominant bottleneck,
-   the cost is tied to specific styles rather than the general architecture,
-   a specialized formatter can be validated against canonical CSL output with sufficient confidence.

Until then, the recommended default is:

1. keep the CSL backend,
2. strengthen formatter abstraction,
3. implement style registry driven multi-style support,
4. revisit specialized formatters only afterward.

## Required tests and acceptance criteria

-   Same CSL input + same style key produces deterministic formatted output.
-   Style metadata resolves correctly for author-date vs numeric styles.
-   Author-date styles render as `<ul>`.
-   Numeric styles render as `<ol>`.
-   Style switching re-renders all non-overridden citations from CSL-JSON.
-   `displayOverride` survives style changes until explicitly reset.
-   Saved HTML remains block-stable and valid after style changes.
-   JSON-LD / COinS / CSL-JSON remain derived from CSL data and do not change because of display overrides.
-   Any future alternate formatter backend must match canonical CSL output for every style it claims to support.

## Technology options appendix

### `citation-js`

`citation-js` remains the best current runtime fit for this plugin because it already aligns with the existing DOI/BibTeX ingestion flow and the project's CSL-JSON-centered architecture. It is still the recommended near-term path even though its CSL formatting path pulls in the heavier citeproc stack.

Recommendation:

-   keep using it now for parsing and canonical CSL-backed formatting,
-   continue to isolate it behind the internal formatting subsystem boundary.

### `rehype-citation`

`rehype-citation` is best treated as a **reference architecture**, not as a direct runtime replacement. It is useful because it demonstrates practical multi-style citation rendering patterns across author-date, numeric, and note-based styles in a JavaScript publishing pipeline. It is not a drop-in fit for this plugin because this codebase is a WordPress block, not a Markdown/MDX-to-HTML pipeline, and it still relies on the same underlying CSL ecosystem.

Recommendation:

-   use it as a comparative implementation when designing future inline citation and bibliography UX,
-   do not treat it as the primary path for replacing the current formatter backend.

### `astrocite` and other lower-level parsers

`astrocite` is worth tracking as a parsing-side option, but it should be evaluated separately from formatter decisions. A lower-level parser may become useful if the project later wants to swap DOI/BibTeX ingestion components or reduce dependency surface on the parsing side. It does not, by itself, solve the core requirement of style-aware bibliography rendering across APA, MLA, Chicago variants, IEEE, Vancouver, and Harvard.

Recommendation:

-   consider `astrocite` and similar tools only as parsing-side alternatives,
-   do not couple parser replacement with formatter replacement.

### `citeproc-rs`

`citeproc-rs` is the most promising long-term watchlist candidate for replacing `citeproc-js` while preserving the project's CSL-based multi-style architecture. Its stated goal is to provide a Rust implementation of CSL/CSL-M with WebAssembly bindings suitable for JavaScript-based consumers, which makes it strategically much better aligned with this plugin than a custom Chicago-only formatter.

However, it should still be treated as a future candidate rather than an immediate migration target. The project currently describes it as work in progress, and the WebAssembly integration path still appears to carry lifecycle and API maturity considerations.

Recommendation:

-   keep it on the roadmap watchlist as the strongest future formatter-backend replacement candidate,
-   revisit it only after multi-style support exists and profiling shows the canonical CSL path is still the main bottleneck.
