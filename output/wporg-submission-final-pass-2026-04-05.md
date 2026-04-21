# WordPress.org submission final pass

Date: 2026-04-05
Repo: `/Users/danknauss/Developer/GitHub/wp-bibliography-block`

## Final pass summary

The plugin now has:

- a more native Gutenberg notification pattern in the editor
- a clean release-packaging script
- a staged release artifact
- a successful local Plugin Check pass against the staged artifact

## Notification follow-up completed

The editor now uses Gutenberg primitives more directly:

- block-local inline `Notice` for mixed-result, warning, and error feedback
- block-local `Snackbar` for pure success messages such as add, delete, reset, and style-change success
- `core/notices` as the backing state store

This keeps validation context attached to the bibliography block while aligning success handling more closely with Gutenberg norms.

## Release packaging

Release packaging is now reproducible with:

```bash
npm run package:release
```

That command creates:

- staging directory: `/Users/danknauss/Developer/GitHub/wp-bibliography-block/output/release/bibliography-builder`
- zip archive: `/Users/danknauss/Developer/GitHub/wp-bibliography-block/output/release/bibliography-builder.zip`

The staged release contains only runtime/release files:

- `bibliography-builder.php`
- `block.json`
- `readme.txt`
- `LICENSE`
- `build/`

## Metadata/readme fixes included

- `readme.txt` now uses `Tested up to: 6.9`
- tags were reduced to 5 to satisfy Plugin Check
- `package.json` now has `author: "Dan Knauss"`

## Validation run

### Local checks

- `npm run lint:js` ✅
- `npm run lint:css` ✅
- `TMPDIR=$PWD/.tmp npm test -- --runInBand --silent` ✅
  - 15 suites passed
  - 183 tests passed
  - 1 benchmark suite skipped by default
- `npm run build` ✅
- `npm run package:release` ✅

### Plugin Check

To access the CLI subcommand, the local `plugin-check` plugin was temporarily activated in the Studio site, then deactivated after the check.

Command used:

```bash
wp plugin check /Users/danknauss/Developer/GitHub/wp-bibliography-block/output/release/bibliography-builder --path=/Users/danknauss/Studio/single-instance --format=json
```

Result:

- `Success: Checks complete. No errors found.`

## Remaining non-blocking notes

- webpack still warns that `citation-citeproc.js` is oversized, but this is a performance concern, not a wp.org submission blocker
- the release process should continue to use the staged artifact, not the raw repo root, for any final wp.org packaging/upload checks
