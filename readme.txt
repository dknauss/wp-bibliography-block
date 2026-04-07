=== Bibliography ===
Contributors: dpknauss
Donate link: https://www.paypal.com/paypalme/DanKnauss
Tags: bibliography, citation, doi, bibtex, academic
Requires at least: 6.4
Tested up to: 7.0
Stable tag: 1.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Paste a DOI or BibTeX entry — get a formatted, auto-sorted bibliography in any of nine academic citation styles.

== Description ==

**Bibliography** transforms pasted DOI(s), BibTeX entries, and citations into a semantically rich, auto-sorted reference list.

**One-click import.** Paste a DOI, and CrossRef resolves the metadata instantly. Paste BibTeX or formatted citations for books, articles, chapters, webpages, reviews, and theses.

**Nine citation styles.** Choose from Chicago Notes-Bibliography, Chicago Author-Date, APA 7, MLA 9, Harvard, Vancouver, IEEE, OSCOLA, and ABNT — all with automatic alphabetical sorting per style rules.

**Portable.** Static HTML output survives plugin deactivation. No shortcodes. No database tables.

**Zotero-ready.** Schema.org JSON-LD by default. Optional COinS metadata for citation manager detection. Download CSL-JSON, BibTeX, or RIS for reuse in reference managers and scripts.

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/scholarly-bibliography/`, or install directly through the WordPress plugin screen.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Add the "Bibliography" block to any post or page.
4. Paste DOI(s), BibTeX entries, or supported citations for books, articles, chapters, and webpages.

== Frequently Asked Questions ==

= What citation input formats does Bibliography support? =

Bare DOIs, DOI URLs, BibTeX entries, and supported formatted citations for books, articles, chapters, webpages, reviews, and theses/dissertations. You can paste multiple entries at once, up to 50 entries per add.

= What happens if I deactivate the plugin? =

Your bibliographies remain fully readable. The block uses static HTML output, so all formatted citations stay in your post content.

= Does Bibliography work with Zotero? =

Yes, if you enable the optional COinS output layer. That metadata is intended for Zotero's browser connector and similar tools.

= Why would I enable CSL-JSON? =

Enable CSL-JSON if you want your bibliography data to be reusable by scholarly tools, scripts, or services without scraping the visible citation text.

= Can I export the bibliography data? =

Yes. The editor currently includes Download CSL-JSON, Download BibTeX, Download RIS, per-entry Copy citation, and Copy bibliography actions for exporting or reusing bibliography data.

= Can I access bibliography data via API? =

Yes. The plugin exposes read-only REST endpoints at `/wp-json/scholarly-bibliography/v1/posts/<post_id>/bibliographies` and `/wp-json/scholarly-bibliography/v1/posts/<post_id>/bibliographies/<index>`. Published posts are readable publicly; non-public posts require permission to edit the post. The single-bibliography route also supports `format=json`, `format=text`, and `format=csl-json`.

= Does Bibliography work on WordPress Multisite? =

Expected to work — block registration is site-local by default — but Multisite has not been explicitly tested yet. If you encounter issues, please report them.

= What PHP and WordPress versions are supported? =

PHP 7.4+ and WordPress 6.4+. The plugin has minimal PHP runtime (block registration and REST endpoints only). CI tests cover PHP 7.4 through 8.4 and WordPress 6.4 through 7.0.

== Screenshots ==

1. Discover the Bibliography block in the inserter.
2. Paste DOI, BibTeX, or supported citation text into the default import form.
3. Use Manual Entry to build a citation with Publication Type and structured fields.
4. Configure citation style, metadata output, and export actions in the block settings sidebar.
5. View the rendered bibliography on the site front end with linked URLs and semantic output.

== Development ==

Source code, issue tracker, and contribution guidelines are on GitHub:

[https://github.com/dknauss/wp-bibliography-block](https://github.com/dknauss/wp-bibliography-block)

Bug reports, feature requests, and pull requests are welcome. See CONTRIBUTING.md in the repository for development setup, coding standards, and the PR process.

== External Services ==

This plugin connects to the **CrossRef REST API** (https://api.crossref.org/) when you paste a DOI to resolve citation metadata. No account or API key is required. Requests are made only when you explicitly add a DOI in the block editor — no data is sent automatically or in the background.

* CrossRef service: https://www.crossref.org/
* CrossRef REST API documentation: https://api.crossref.org/swagger-ui/index.html
* CrossRef privacy policy: https://www.crossref.org/privacy/
* CrossRef terms of service: https://www.crossref.org/terms/

== Changelog ==

= 1.0.0 =
* Initial release.
* DOI, BibTeX, and supported formatted citation input.
* Chicago Notes-Bibliography default formatting.
* Chicago Author-Date, APA 7, Harvard, Vancouver, IEEE, MLA 9, OSCOLA, and ABNT selectable styles.
* JSON-LD output by default, with optional COinS and CSL-JSON layers.
* Accessible editor with keyboard navigation.
* Manual entry with structured fields and validation.
* Duplicate detection across paste and manual entry.
* Export: Download CSL-JSON, BibTeX, RIS; copy per-entry or full bibliography.
* REST API for programmatic bibliography access.
* Static HTML output survives plugin deactivation.

== Upgrade Notice ==

= 1.0.0 =
Initial release.
