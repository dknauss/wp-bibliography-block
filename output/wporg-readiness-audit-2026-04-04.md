# Bibliography Builder audit — security, performance, and WordPress.org readiness

Date: 2026-04-04
Repo: `/Users/danknauss/Developer/GitHub/wp-bibliography-block`

## Executive summary

Overall, the plugin is in strong shape for a block-only WordPress.org submission from a runtime security perspective:

- no direct PHP attack surface beyond block registration
- no custom REST routes, AJAX handlers, admin forms, or database writes in plugin PHP
- citation text is rendered as React text nodes, not `dangerouslySetInnerHTML`
- JSON-LD and CSL-JSON script blocks escape `<` to prevent script breakout
- COinS values are URL-encoded
- parser-side CSL sanitization blocks prototype-pollution keys and invalid nested shapes

Main remaining concerns are not critical security bugs; they are mostly:

1. **performance hotspots are mostly in WordPress/theme bootstrap, not plugin runtime code**
2. **plugin-specific PHP cost is dominated by parsing `build/index.asset.php` during block registration**
3. **large deferred citation chunks remain in the JS build**
4. **Plugin Check CLI is still unreliable in this local environment, so final wp.org validation should run in wp-admin or CI**

## Environment verification

### Tests

- `npm test -- --runInBand --silent` → **15/15 suites passed, 174/174 tests passed**
- `php -l bibliography-builder.php` → **no syntax errors**

### Xdebug status

Checked against the local Studio site at `http://localhost:8881` after patching Studio's bundled PHP-WASM runtime to enable full Xdebug modes.

Result:

- `xdebug_loaded: true`
- `xdebug_version: 3.5.2-dev`
- `xdebug_mode: debug,develop,trace,profile`
- `xdebug_start_with_request: 1`
- `xdebug_output_dir: /tmp`

Actual trace and cachegrind output was captured and copied into this repo for inspection:

- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/output/xdebug-trace-latest.xt`
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/output/cachegrinds/cachegrind.out.1`
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/output/cachegrinds/cachegrind.out.2`
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/output/cachegrinds/cachegrind.out.3`
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/output/cachegrinds/cachegrind.out.4`
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/output/cachegrinds/cachegrind.out.5`
- `/Users/danknauss/Developer/GitHub/wp-bibliography-block/output/cachegrinds/cachegrind.out.6`

Important limitation: Studio's PHP-WASM runtime is unstable when `trace`/`profile` is enabled for some diagnostic requests. In particular, requests that aggressively manipulated trace files caused the WordPress worker to crash with:

- `Error: null function or function signature mismatch`

inside Studio's `@php-wasm/universal` runtime. So profiling works well enough to gather evidence, but not yet as a robust repeatable benchmark harness.

## Security assessment

### Strengths

#### 1. Strong CSL sanitation before storage and rendering
File: `src/lib/parser.js`

- `sanitizeCslValue()` recursively strips `__proto__`, `constructor`, and `prototype`
- nested values are shape-checked
- date parts are normalized and validated
- author/editor structures are constrained
- scalar/string fields are allowlisted and validated

Relevant lines:
- `src/lib/parser.js:100-151`
- `src/lib/parser.js:154-240`

This is a strong defense against malformed or hostile CSL payloads.

#### 2. Script-block breakout prevention is correct
File: `src/lib/jsonld.js`

- both JSON-LD and CSL-JSON serialization replace `<` with `\u003c`

Relevant lines:
- `src/lib/jsonld.js:129-142`

This is the correct pattern for `dangerouslySetInnerHTML` inside `<script>` tags.

#### 3. Citation text output remains escaped by React
Files:
- `src/save-markup.js`
- `src/lib/formatting/index.js`

The block still avoids `dangerouslySetInnerHTML` for visible citation text. Even URL linking is built from split text segments rendered as React children.

Relevant lines:
- `src/save-markup.js:72-99`
- `src/lib/formatting/index.js:51-96`

#### 4. Front-end URL linking is limited to http/https
File: `src/lib/formatting/index.js`

- linkification uses `URL_PATTERN = /https?:\/\/\S+/gu`
- this avoids accidental `javascript:` or `data:` linkification

Relevant lines:
- `src/lib/formatting/index.js:19-20`
- `src/lib/formatting/index.js:51-96`

### Findings

#### S1. Resolved — manual DOI/URL validation is now in place
Files:
- `src/lib/manual-entry.js`
- `src/hooks/use-citation-editor-state.js`

Manual entry and structured edit now normalize DOI values, require valid `http`/`https` URLs, and block invalid DOI/URL data before saving. This closes the most obvious metadata-quality gap found in the earlier review.

#### S2. Low — JSON-LD type coverage is incomplete for several CSL types
File: `src/lib/jsonld.js:5-13`

`collection`, `review-book`, `article-newspaper`, `article-magazine`, and other supported types fall back to `CreativeWork`.

Not a security issue, but it weakens semantic quality for search/AI consumers.

**Recommendation:** expand `TYPE_MAP` for the shipped supported types.

#### S3. Resolved — submission metadata no longer blocks readiness
Files:
- `bibliography-builder.php`
- `readme.txt`

The plugin header and readme metadata are now populated. This was a submission-readiness gap, not a security vulnerability, and it has been addressed.

## Performance assessment

### Main bottlenecks (code review)

#### P1. Medium — per-entry CSL formatting creates a new `Cite` instance every time
File: `src/lib/formatting/csl.js:85-99`

`formatBibliographyEntry()` does:
- `ensureBuiltinTemplatesRegistered()`
- `new Cite(csl)`
- `cite.format('bibliography', ...)`

This runs repeatedly during:
- paste/import parsing
- manual entry creation
- structured edit saves
- style switches that reformat many entries

This is likely the dominant CPU hotspot in editor workflows.

**Recommendation:**
- add memoization keyed by `(styleKey, stable-csl-hash)`
- or batch-format when style changes instead of per-entry repeated setup

#### P2. Medium — parsing still formats every successful item synchronously during import
File: `src/lib/parser.js:705-745`

You already improved concurrency for backend parsing, but each successful item still immediately calls `formatBibliographyEntry()` inside the resolved item mapper.

That means large paste operations pay for:
1. parsing
2. sanitization
3. formatting

all in the same critical path.

**Recommendation:**
- keep current correctness, but consider deferring `formattedText` generation until after all items are parsed, or memoizing formatter calls

#### P3. Medium — large deferred build chunks remain
Build output:
- `build/55.js` → ~506 KB
- `build/592.js` → ~479 KB
- `build/citation-citeproc.js` → ~364 KB

The main editor bundle is much smaller now (`build/index.js` ~39 KB), which is good. But the citation/formatting async chunks are still large.

**Recommendation:**
- acceptable for now, but keep an eye on citation-js and CSL template additions
- avoid adding more large style/template bundles without measuring impact

#### P4. Low/Medium — saved front-end output can become large for long bibliographies
File: `src/save-markup.js`

Even after making COinS and CSL-JSON opt-in, the plugin still emits:
- full static bibliography HTML
- JSON-LD by default
- optional COinS per entry
- optional CSL-JSON

This is a reasonable product choice, but it increases saved HTML size for large bibliographies.

**Recommendation:**
- keep JSON-LD default on
- current opt-in controls for COinS / CSL-JSON are the right tradeoff

### Xdebug bottleneck status

I was able to gather real Xdebug trace/profile output. The strongest pattern from the captured cachegrind files is that PHP request cost is dominated by WordPress core/theme bootstrap, not by this plugin's own PHP.

Key observations from the captured profiles:

- Front-end style requests are dominated by core/theme bootstrap files such as:
  - `/wordpress/wp-load.php`
  - `/wordpress/wp-settings.php`
  - Twenty Twenty-Five pattern files
- Plugin-specific PHP cost is tiny by comparison and is almost entirely concentrated in:
  - `/internal/symlinks/Users/danknauss/Developer/GitHub/wp-bibliography-block/build/index.asset.php`
- The main plugin file:
  - `/internal/symlinks/Users/danknauss/Developer/GitHub/wp-bibliography-block/bibliography-builder.php`
  contributes only negligible self time

Interpretation:

- There is **no evidence of a meaningful PHP runtime bottleneck inside plugin business logic**
- The only repeatable plugin-specific PHP cost comes from loading the generated block asset metadata file during block registration
- The heavier performance concerns for this plugin remain editor-side JavaScript/citation formatting work, not PHP execution on the front end

## WordPress.org readiness

### Good

- static block output is self-contained
- source code and build artifacts are present in repo
- no obfuscated/minified-only source workflow issue
- no remote asset loading for the plugin UI
- no custom database tables
- no telemetry/tracking behavior found
- no third-party code execution found
- block uses WordPress packages and block.json metadata
- tests are passing locally

### Needs attention before submission

#### W1. Submission metadata is now filled in
Files:
- `bibliography-builder.php`
- `readme.txt`

Current state:
- `Author: Dan Knauss`
- `Contributors: danknauss`
- `Tested up to: 6.9.4`

Before submission, confirm that `Tested up to:` still matches the latest version you have actually verified.

#### W2. Plugin Check CLI is not usable in this local environment right now
Local result:
- `plugin-check` plugin installed successfully
- `wp plugin check ...` crashes in this environment with:
  - `Undefined constant WordPress\Plugin_Check\Checker\Checks\WP_PLUGIN_CHECK_PLUGIN_DIR_PATH`

This looks like a local Plugin Check CLI/bootstrap issue, not evidence of a defect in the plugin itself.

**Recommendation:**
- run Plugin Check from wp-admin or CI instead of relying on this local CLI path
- add a GitHub Action or documented local browser-based check before submission

#### W3. Dependency audit is not fully clean
`npm audit --omit=dev --json` currently reports 9 issues, including 1 high-severity `lodash` advisory.

`npm explain lodash` shows this is coming from the **tooling/dev tree** (`@wordpress/scripts`, testing, stylelint), not from the plugin runtime bundle itself.

**Recommendation:**
- not a blocker for runtime security, but worth cleaning up before public release if possible by updating the build/test toolchain

## Recommended next actions

### Highest priority
1. Fill in `Author:` and `Contributors:` for submission.
2. Update `Tested up to:` to the version you actually verify against before release.
3. Add DOI/URL validation/normalization to manual entry and structured edit.
4. Add formatter memoization or another strategy to reduce repeated `new Cite()` work.

### Strongly recommended
5. Run Plugin Check in a different environment (wp-admin or CI), because the local CLI path is broken.
6. Create a lightweight submission checklist in docs covering:
   - build
   - JS/CSS lint
   - unit tests
   - Plugin Check
   - readme validation
   - tested-up-to / stable tag alignment

### Nice to have
7. Expand JSON-LD type mapping.
8. Reduce deferred citation chunk sizes if possible.

## Conclusion

The plugin does **not** show a serious runtime security problem in the current codebase. The main issues before WordPress.org submission are operational and performance-oriented rather than security-critical:

- finish metadata/readme submission polish
- get Plugin Check running in a reliable environment
- improve per-entry CSL formatting cost
- add manual URL/DOI validation

