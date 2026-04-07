# Bibliography Block

[![License: GPL v2+](https://img.shields.io/badge/License-GPLv2%2B-blue.svg)](https://www.gnu.org/licenses/gpl-2.0.html)
[![WordPress tested](https://img.shields.io/badge/WordPress-6.4%E2%80%93latest-21759b.svg?logo=wordpress&logoColor=white)](https://github.com/dknauss/wp-bibliography-block/actions/workflows/runtime-matrix.yml)
[![PHP tested](https://img.shields.io/badge/PHP-7.4%E2%80%938.4-777bb4.svg?logo=php&logoColor=white)](https://github.com/dknauss/wp-bibliography-block/actions/workflows/runtime-matrix.yml)
[![CI](https://github.com/dknauss/wp-bibliography-block/actions/workflows/ci.yml/badge.svg)](https://github.com/dknauss/wp-bibliography-block/actions/workflows/ci.yml)
[![Runtime matrix](https://github.com/dknauss/wp-bibliography-block/actions/workflows/runtime-matrix.yml/badge.svg)](https://github.com/dknauss/wp-bibliography-block/actions/workflows/runtime-matrix.yml)
[![CodeQL](https://github.com/dknauss/wp-bibliography-block/actions/workflows/codeql.yml/badge.svg)](https://github.com/dknauss/wp-bibliography-block/actions/workflows/codeql.yml)
[![Codecov](https://codecov.io/gh/dknauss/wp-bibliography-block/branch/main/graph/badge.svg)](https://codecov.io/gh/dknauss/wp-bibliography-block)
[![WordPress Playground](https://img.shields.io/badge/WordPress%20Playground-Try%20it-3858e9.svg?logo=wordpress&logoColor=white)](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/dknauss/wp-bibliography-block/main/playground/blueprint.json)

The only all-in-one bibliography block for the WordPress editor that transforms pasted scholarly references — DOI(s), BibTeX entries, and supported formatted citations — into a semantically rich, auto-sorted bibliography with static saved output. Export your work as CSL-JSON, BibTeX, and RIS.

No shortcodes. No database storage. Static HTML output survives plugin deactivation.

## Try it in WordPress Playground

Launch a disposable WordPress instance with the plugin preinstalled:

- [Open Scholarly Bibliography Block in WordPress Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/dknauss/wp-bibliography-block/main/playground/blueprint.json)

The Playground installs the plugin from the latest GitHub Release zip artifact.

## Screenshots

| Editor with citations | Front-end output |
|---|---|
| ![](.wordpress-org/screenshot-4.png) | ![](.wordpress-org/screenshot-5.png) |

| Block inserter | Empty-state form | Manual entry |
|---|---|---|
| ![](.wordpress-org/screenshot-1.png) | ![](.wordpress-org/screenshot-2.png) | ![](.wordpress-org/screenshot-3.png) |

## Features

- **Multiple input paths** — add bare DOIs, DOI URLs, BibTeX entries, and supported formatted citations
- **Current style support** — Chicago Notes-Bibliography by default, with Chicago Author-Date, APA 7, Harvard, Vancouver, IEEE, MLA 9, OSCOLA, and ABNT selectable now
- **Structured editing** — plain-text editing plus per-field editing for heuristic or warning-marked citations
- **Semantic output** — DPUB-ARIA bibliography roles, `<cite>` wrappers, `lang` attributes, JSON-LD by default, with optional COinS and CSL-JSON layers
- **Practical export** — download the current bibliography as CSL-JSON from the editor
- **Reference-manager export** — download the current bibliography as BibTeX from the editor
- **Broad interoperability export** — download the current bibliography as RIS from the editor
- **Static save** — bibliography HTML and metadata are baked into post content at save time
- **Accessible editor UX** — focus management, block-local Gutenberg notices, keyboard escape/cancel flows, and row action controls

## Supported Input

### First-class inputs

- **Bare DOI** — `10.1000/xyz123`
- **DOI URL** — `https://doi.org/10.1000/xyz123`
- **BibTeX** — `@article{key, title={...}, ...}`

### Supported formatted citation coverage

The free-text parser currently supports a growing set of formatted citations for:

- books
- journal articles
- chapters
- webpages / social posts
- reviews
- theses / dissertations

Support is heuristic rather than universal. Unsupported inputs fail closed with a block-local inline Gutenberg notice. Manual entry is now available as a fallback for unsupported formats.

## Output

Each saved bibliography block currently produces:

- **Semantic HTML** — `role="doc-bibliography"`, `role="doc-biblioentry"`, hanging-indent styling, and `lang` attributes
- **JSON-LD** — Schema.org objects for search engines, AI systems, and semantic consumers, enabled by default
- **COinS** — optional OpenURL spans for browser-based citation manager detection
- **CSL-JSON** — optional raw scholarly metadata for tool interoperability

Current output-layer defaults:

- **JSON-LD** on
- **COinS** off
- **CSL-JSON** off

### Why would you enable COinS or CSL-JSON?

- **COinS** is useful if you want readers using Zotero or similar citation-manager browser tools to detect and save citations directly from the page.
- **CSL-JSON** is useful if you want developers, research tools, or scholarly services to reuse your bibliography data without scraping the visible citation text.

## Export

The editor currently includes:

- **Download CSL-JSON** — exports the current bibliography as structured citation data you can reuse in scholarly tools, scripts, and conversion workflows.
- **Download BibTeX** — exports the current bibliography as BibTeX for reference managers and scholarly writing tools.
- **Download RIS** — exports the current bibliography as RIS for citation-manager import/export workflows.
- **Copy citation** — copies the visible formatted citation text for an individual entry directly to the clipboard.
- **Copy bibliography** — copies the full current bibliography as plain text in the current order and style.

## API

The plugin now exposes a read-only REST endpoint for bibliography data:

- `GET /wp-json/scholarly-bibliography/v1/posts/<post_id>/bibliographies`
- `GET /wp-json/scholarly-bibliography/v1/posts/<post_id>/bibliographies/<index>`

Behavior:

- published posts are readable publicly
- non-public posts require permission to edit the post
- the collection route returns each bibliography block found in the post, including style settings and citation data
- the single-bibliography route supports `?format=json`, `?format=text`, and `?format=csl-json`

## Development

Requires Node.js 18+, npm 9+, and Composer.

```bash
npm install          # Install dependencies
composer install     # Install PHP tooling
npm run build        # Production build
npm run start        # Development mode with file watching
npm run lint:js          # ESLint
npm run lint:css         # Stylelint
npm run lint:php         # WPCS/PHPCS
npm run test             # Unit tests
npm run test:js:coverage # JS coverage for Codecov
npm run test:rest:local  # Local REST endpoint smoke test (Studio site)
npm run test:e2e         # Playwright smoke suite against local site
npm run test:e2e:playground # Playground-based Playwright smoke suite
npm run test:e2e:lifecycle  # Plugin lifecycle e2e tests (activate/deactivate/delete)
npm run test:runtime:local # Docker-based runtime smoke environment
composer test:php        # PHPUnit REST and bootstrap tests
composer test:php:coverage # PHP coverage for Codecov
composer analyze:php     # Psalm static analysis
```

GitHub Actions currently runs:

- Node quality/build checks
- PHPUnit across PHP 7.4, 8.1, and 8.3
- Psalm static analysis
- CodeQL for JavaScript and PHP
- Codecov uploads from JS + PHP coverage
- Playwright smoke and lifecycle tests against WordPress Playground

The GitHub Actions runtime matrix currently covers:

- Apache + PHP 7.4 + WordPress 6.4
- Apache + PHP 8.1 + WordPress 6.4
- Apache + PHP 8.1 + WordPress 6.7
- Apache + PHP 8.2 + latest WordPress
- Apache + PHP 8.3 + latest WordPress
- Apache + PHP 8.4 + latest WordPress
- Nginx + PHP 8.1 + WordPress 6.7
- Nginx + PHP 8.2 + latest WordPress
- Nginx + PHP 8.3 + latest WordPress

Each runtime smoke job uploads artifacts including Docker logs, service status, HTTP responses, and environment summaries under `output/runtime-matrix/<matrix-name>`.

SQLite runtime smoke remains a planned follow-up while the CI bootstrap path is stabilized.

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

## Compatibility

- **WordPress** 6.4+ (block.json v3 requires 6.4+)
- **PHP** 7.4+ (minimal PHP runtime — the plugin registers a block and REST endpoints only)
- **Multisite** — expected to work (block registration is site-local by default), but not yet tested

The GitHub Actions runtime matrix covers PHP 7.4 through 8.4 and WordPress 6.4 through latest on both Apache and Nginx. Multisite-specific and SQLite runtime e2e tests are on the backlog.

## Roadmap

See [SPEC.md](SPEC.md) for the authoritative behavior specification and future plans.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and PR process.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE) for the full text.
