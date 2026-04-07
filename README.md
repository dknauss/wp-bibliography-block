# Scholarly Bibliography Block

[![License: GPL v2+](https://img.shields.io/badge/License-GPLv2%2B-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)
[![WordPress: 6.4+](https://img.shields.io/badge/WordPress-6.4%2B-21759b.svg)](https://wordpress.org/)

A WordPress block plugin that transforms pasted scholarly references into a semantically rich, auto-sorted bibliography block with static saved output.

No shortcodes. Static HTML output survives plugin deactivation.

## Features

-   **Multiple input paths** — add bare DOIs, DOI URLs, BibTeX entries, and supported formatted citations
-   **Current style support** — Chicago Notes-Bibliography by default, with Chicago Author-Date, APA 7, Harvard, Vancouver, IEEE, MLA 9, OSCOLA, and ABNT selectable now
-   **Structured editing** — plain-text editing plus per-field editing for heuristic or warning-marked citations
-   **Semantic output** — DPUB-ARIA bibliography roles, `<cite>` wrappers, `lang` attributes, JSON-LD by default, with optional COinS and CSL-JSON layers
-   **Practical export** — download the current bibliography as CSL-JSON from the editor
-   **Reference-manager export** — download the current bibliography as BibTeX from the editor
-   **Broad interoperability export** — download the current bibliography as RIS from the editor
-   **Static save** — bibliography HTML and metadata are baked into post content at save time
-   **Accessible editor UX** — focus management, block-local Gutenberg notices, keyboard escape/cancel flows, and row action controls

## Quick Start

1. Clone and build:
    ```bash
    git clone https://github.com/dknauss/wp-bibliography-block.git
    cd wp-bibliography-block
    npm install
    npm run build
    ```
2. Copy or symlink the plugin folder into `wp-content/plugins/`.
3. Activate **Scholarly Bibliography** in the WordPress admin.
4. Add the **Bibliography** block to a post.
5. Paste DOI(s), BibTeX entries, or citations in supported styles for books, articles, chapters, and webpages.

## Supported Input

### First-class inputs

-   **Bare DOI** — `10.1000/xyz123`
-   **DOI URL** — `https://doi.org/10.1000/xyz123`
-   **BibTeX** — `@article{key, title={...}, ...}`

### Supported formatted citation coverage

The free-text parser currently supports a growing set of formatted citations for:

-   books
-   journal articles
-   chapters
-   webpages / social posts
-   reviews
-   theses / dissertations

Support is heuristic rather than universal. Unsupported inputs fail closed with a block-local inline Gutenberg notice. Manual entry is now available as a fallback for unsupported formats.

## Notice model

Editor notices intentionally remain **block-local** even though notice state now uses the Gutenberg `core/notices` store.

Why:

-   parse/import feedback is easier to understand when it stays attached to the bibliography block that triggered it
-   mixed-result notices (added, skipped, unparsed, review-needed) are more contextual than a global snackbar
-   deliberate focus movement to the current notice works better when the notice is rendered next to the active form

Tradeoff:

-   pure success messages now use a local Gutenberg snackbar pattern inside the block
-   richer validation and mixed-result feedback still uses inline notices attached to the add form
-   this is slightly less “global-editor-native” than sending every message to the editor’s global snackbar region
-   but it is clearer and more accessible for bibliography-specific workflows

## Output

Each saved bibliography block currently produces:

-   **Semantic HTML** — `role="doc-bibliography"`, `role="doc-biblioentry"`, hanging-indent styling, and `lang` attributes
-   **JSON-LD** — Schema.org objects for search engines, AI systems, and semantic consumers, enabled by default
-   **COinS** — optional OpenURL spans for browser-based citation manager detection
-   **CSL-JSON** — optional raw scholarly metadata for tool interoperability

Current output-layer defaults:

-   **JSON-LD** on
-   **COinS** off
-   **CSL-JSON** off

### Why would you enable COinS or CSL-JSON?

-   **COinS** is useful if you want readers using Zotero or similar citation-manager browser tools to detect and save citations directly from the page.
-   **CSL-JSON** is useful if you want developers, research tools, or scholarly services to reuse your bibliography data without scraping the visible citation text.

## Export

The editor currently includes:

-   **Download CSL-JSON** — exports the current bibliography as structured citation data you can reuse in scholarly tools, scripts, and conversion workflows.
-   **Download BibTeX** — exports the current bibliography as BibTeX for reference managers and scholarly writing tools.
-   **Download RIS** — exports the current bibliography as RIS for citation-manager import/export workflows.
-   **Copy citation** — copies the visible formatted citation text for an individual entry directly to the clipboard.
-   **Copy bibliography** — copies the full current bibliography as plain text in the current order and style.

## API

The plugin now exposes a read-only REST endpoint for bibliography data:

-   `GET /wp-json/scholarly-bibliography/v1/posts/<post_id>/bibliographies`
-   `GET /wp-json/scholarly-bibliography/v1/posts/<post_id>/bibliographies/<index>`

Behavior:

-   published posts are readable publicly
-   non-public posts require permission to edit the post
-   the collection route returns each bibliography block found in the post, including style settings and citation data
-   the single-bibliography route supports `?format=json`, `?format=text`, and `?format=csl-json`

## Development

Requires Node.js 18+ and npm 9+.

```bash
npm install          # Install dependencies
npm run build        # Production build
npm run start        # Development mode with file watching
npm run lint:js          # ESLint
npm run lint:css         # Stylelint
npm run test             # Unit tests
npm run test:rest:local  # Local REST endpoint smoke test (Studio site)
npm run test:e2e         # Playwright smoke suite against local site
npm run test:runtime:local # Docker-based runtime smoke environment
```

The GitHub Actions runtime matrix currently covers:

-   Apache + PHP 7.4 + WordPress 6.4
-   Apache + PHP 8.1 + WordPress 6.4
-   Apache + PHP 8.1 + WordPress 6.7
-   Apache + PHP 8.2 + latest WordPress
-   Apache + PHP 8.3 + latest WordPress
-   Apache + PHP 8.3 + latest WordPress + SQLite
-   Apache + PHP 8.4 + latest WordPress
-   Nginx + PHP 8.1 + WordPress 6.7
-   Nginx + PHP 8.2 + latest WordPress
-   Nginx + PHP 8.3 + latest WordPress

Each runtime smoke job uploads artifacts including Docker logs, service status, HTTP responses, and environment summaries under `output/runtime-matrix/<matrix-name>`.

## File Structure

```text
scholarly-bibliography/
├── scholarly-bibliography.php    # Plugin bootstrap
├── block.json                    # Block metadata & attributes
├── src/
│   ├── index.js                  # Block registration
│   ├── edit.js                   # Editor component
│   ├── save.js                   # Static save entrypoint
│   ├── save-markup.js            # Shared static save markup
│   ├── editor.scss               # Editor-only styles
│   ├── style.scss                # Frontend bibliography styles
│   └── lib/
│       ├── parser.js             # Input detection & parsing orchestration
│       ├── sorter.js             # Style-family bibliography sort comparator
│       ├── coins.js              # CSL-JSON → COinS builder
│       ├── jsonld.js             # CSL-JSON → Schema.org JSON-LD mapper
│       └── formatting/           # Style registry + CSL-backed formatting
├── package.json
└── readme.txt                    # WordPress.org readme
```

## Roadmap

Current near-term priorities:

1. docs/spec/checklist sync
2. parser/storage hardening
3. manual citation entry via a general structured form with CSL type selection
4. follow-on manual-entry/output hardening and remaining specialized style work

See [SPEC.md](SPEC.md) for the authoritative behavior and roadmap.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and PR process.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE) for the full text.
