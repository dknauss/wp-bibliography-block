# Bibliography Block — Brand Notes

## Visual System

Three-book shelf mark with the following design language:

- Three upright books, left book leaning **inward** toward the stack (`rotate(4, 42, 148)`)
- Center book shows a **slate-blue** face/page edge (`#7B8FA1`) as the accent colour
- Books are **near-black** (`#2D3136`) on a **warm off-white** background (`#F5F3EF`)
- **Gold baseline rule** (`#C4973E`) runs under both the books and the wordmark as a single unified element — no separate shelf line; gold rule also anchors the icon mark
- **Baskerville** (Libre Baskerville as the web-safe substitute) for both wordmark and subtitle
- Wordmark: `#2D3136` at 148px; subtitle: slate-blue `#7B8FA1` at 50px (scaled proportionally across sizes)
- Subtitle text: *Scholarly references for WordPress*

Three colours only: near-black `#2D3136`, slate-blue `#7B8FA1`, gold `#C4973E` — on white/off-white.

---

## Source Files (`.wordpress-org/source/`)

| File | Purpose |
|------|---------|
| `bibliography-block-banner.svg` | **SVG master** — edit this for future changes |
| `bibliography-block-banner-1920x560.png` | Master raster reference at full resolution |
| `bibliography-block-banner-1544x500.png` | Deploy candidate → `banner-1544x500.png` |
| `bibliography-block-banner-772x250.png` | Deploy candidate → `banner-772x250.png` |
| `bibliography-block-icon.svg` | Icon SVG source (books + gold shelf rule) |
| `bibliography-block-icon-512x512.png` | High-res icon master (rendered via Inkscape Apr 20) |
| `brand-mark-bookshelf.svg` | Superseded draft — left book leans outward, kept for reference only |
| `bibliography-block-banner.png` | Earlier/interim banner render, superseded by 1920x560 |

Icons are rendered from `bibliography-block-icon.svg` via Inkscape:
```
inkscape bibliography-block-icon.svg --export-type=png --export-filename=<output> --export-width=<w> --export-height=<h>
```

Banners are regenerated from the SVG master via (requires Inkscape + Pillow):
`scripts/generate_brand_assets.py`

---

## Deployed Files (`.wordpress-org/`)

| File | Status |
|------|--------|
| `icon-128x128.png` | ✅ Deployed (gold shelf, rendered Apr 20) |
| `icon-256x256.png` | ✅ Deployed (gold shelf, rendered Apr 20) |
| `icon.svg` | ✅ Deployed (gold shelf rule #C4973E) |
| `screenshot-1.png` … `screenshot-5.png` | ✅ Deployed |
| `banner-772x250.png` | ✅ Deployed (Apr 20) |
| `banner-1544x500.png` | ✅ Deployed (Apr 20) |

---

## Release Checklist

- [x] Copy `source/bibliography-block-banner-772x250.png` → `.wordpress-org/banner-772x250.png`
- [x] Copy `source/bibliography-block-banner-1544x500.png` → `.wordpress-org/banner-1544x500.png`
- [x] Verify `icon-128x128.png` and `icon-256x256.png` match current icon design — confirmed gold shelf (#C4973E), re-rendered Apr 20 from `bibliography-block-icon.svg` via Inkscape
- [x] Confirm scripts/generate_brand_assets.py produces consistent output — verified Apr 20, now drives Inkscape directly from SVG master
- [x] Screenshots current and representative of the released version
