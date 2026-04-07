=== Bibliography ===
Contributors: danknauss
Tags: bibliography, citation, academic, scholarly, DOI, Chicago, MLA, APA, IEEE, BibTex, OSCOLA, ABNT
Requires at least: 6.4
Tested up to: 6.9
Stable tag: 0.1.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A block editor plugin that transforms DOI(s), BibTeX entries, and supported formatted citations into a semantically rich, auto-sorted bibliography.

== Description ==

Bibliography is a WordPress block plugin for building reference lists. Add DOI(s), BibTeX entries, and supported citations in common scholarly styles to get a properly formatted, semantically rich bibliography with:

* Chicago Notes-Bibliography formatting by default
* Chicago Author-Date, APA 7, Harvard, Vancouver, IEEE, MLA 9, OSCOLA, and ABNT as selectable styles today
* Automatic alphabetical sorting
* Schema.org JSON-LD structured data by default
* Optional COinS metadata for citation manager detection (Zotero, Mendeley)
* Optional CSL-JSON machine-readable output
* Downloadable CSL-JSON export from the editor
* Downloadable BibTeX export from the editor
* Downloadable RIS export from the editor
* DPUB-ARIA semantic roles for accessibility
* Static HTML output that survives plugin deactivation
* Structured field editing for heuristic/warning-marked imports
* Manual Entry fallback for unsupported formats

No shortcodes. No database tables. No server-side rendering. Clean, portable HTML.

Project URL: https://dan.knauss.ca/

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/scholarly-bibliography/`.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Add the "Bibliography" block to any post or page.
4. Paste DOI(s), BibTeX entries, or supported citations for books, articles, chapters, and webpages.

== Frequently Asked Questions ==

= What input formats are supported? =

Bare DOIs, DOI URLs, BibTeX entries, and supported formatted citations for books, articles, chapters, webpages, reviews, and theses/dissertations. You can paste multiple entries at once, up to 50 entries per add.

= What happens if I deactivate the plugin? =

Your bibliographies remain fully readable. The block uses static HTML output, so all formatted citations stay in your post content.

= Does this work with Zotero? =

Yes, if you enable the optional COinS output layer. That metadata is intended for Zotero's browser connector and similar tools.

= Why would I enable CSL-JSON? =

Enable CSL-JSON if you want your bibliography data to be reusable by scholarly tools, scripts, or services without scraping the visible citation text.

= Can I export the bibliography data? =

Yes. The editor currently includes Download CSL-JSON, Download BibTeX, Download RIS, per-entry Copy citation, and Copy bibliography actions for exporting or reusing bibliography data.

= Can I access bibliography data via API? =

Yes. The plugin exposes read-only REST endpoints at `/wp-json/scholarly-bibliography/v1/posts/<post_id>/bibliographies` and `/wp-json/scholarly-bibliography/v1/posts/<post_id>/bibliographies/<index>`. Published posts are readable publicly; non-public posts require permission to edit the post. The single-bibliography route also supports `format=json`, `format=text`, and `format=csl-json`.


== Screenshots ==

1. Discover the Bibliography block in the inserter.
2. Paste DOI, BibTeX, or supported citation text into the default import form.
3. Use Manual Entry to build a citation with Publication Type and structured fields.
4. Configure citation style, metadata output, and export actions in the block settings sidebar.
5. View the rendered bibliography on the site front end with linked URLs and semantic output.

== Changelog ==

= 0.1.0 =
* Initial release.
* DOI, BibTeX, and supported formatted citation input.
* Chicago Notes-Bibliography default formatting.
* Chicago Author-Date, APA 7, Harvard, Vancouver, IEEE, MLA 9, OSCOLA, and ABNT selectable styles.
* JSON-LD output by default, with optional COinS and CSL-JSON layers.
* Accessible editor with keyboard navigation.
