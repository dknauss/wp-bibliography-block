# Inkscape reinstall runbook

Use this runbook when the local `inkscape` command exists but the real application bundle is missing, or when SVG → PNG export is needed for WordPress.org assets.

## Why keep Inkscape available

Inkscape is useful in this repository for:

- exporting SVG brand assets to exact WordPress.org PNG sizes
- regenerating banner and icon assets from vector source files
- preserving an editable vector-first workflow for future graphics updates

## Symptom

The command exists but fails like this:

```bash
/opt/homebrew/bin/inkscape: line 2: /opt/homebrew/Caskroom/inkscape/.../Inkscape.app/Contents/MacOS/inkscape: No such file or directory
```

That means the Homebrew wrapper is present but the app bundle it points to is missing.

## Reinstall

Standard reinstall:

```bash
brew reinstall --cask inkscape
```

If Homebrew cache permissions are a problem, use a writable local cache:

```bash
mkdir -p .tmp/homebrew-cache
HOMEBREW_CACHE="$PWD/.tmp/homebrew-cache" brew reinstall --cask inkscape
```

## Verify

```bash
file /opt/homebrew/bin/inkscape
inkscape --version
```

Expected:

- `inkscape` resolves to a valid executable launcher
- `inkscape --version` prints the installed version

## Test export

From the repository root:

```bash
inkscape /Users/danknauss/Developer/GitHub/bibliography-builder/.wordpress-org/source/banner-1544x500.svg \
  --export-type=png \
  --export-filename=/Users/danknauss/Developer/GitHub/bibliography-builder/.wordpress-org/banner-1544x500.png
```

Then confirm dimensions:

```bash
python3 - <<'PY'
from PIL import Image
im = Image.open('/Users/danknauss/Developer/GitHub/bibliography-builder/.wordpress-org/banner-1544x500.png')
print(im.size)
PY
```

Expected:

```text
(1544, 500)
```

## Source files used here

- `/Users/danknauss/Developer/GitHub/bibliography-builder/.wordpress-org/source/banner-concept.svg`
- `/Users/danknauss/Developer/GitHub/bibliography-builder/.wordpress-org/source/banner-1544x500.svg`
- `/Users/danknauss/Developer/GitHub/bibliography-builder/.wordpress-org/source/banner-772x250.svg`
- `/Users/danknauss/Developer/GitHub/bibliography-builder/.wordpress-org/icon.svg`

## Notes

If Homebrew cannot reach `formulae.brew.sh`, the reinstall will fail due to network resolution issues. In that case, retry from a network-enabled session.
