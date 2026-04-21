#!/usr/bin/env python3
"""
Generate WP.org banner assets from the SVG master.

Workflow
--------
1. Inkscape renders the SVG master to a full-resolution reference PNG (1920x560).
2. Pillow downscales the reference PNG to the two deployed WP.org banner sizes.

The reference PNG lives in .wordpress-org/source/ as a rendered snapshot of the
SVG; it is not the source of truth -- the SVG master is.  Always re-render from
the SVG when the design changes.

Usage
-----
  python3 scripts/generate_brand_assets.py            # full run
  python3 scripts/generate_brand_assets.py --skip-render  # skip Inkscape step
"""

import argparse
import subprocess
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install pillow")

ROOT   = Path(__file__).resolve().parent.parent
ASSETS = ROOT / ".wordpress-org"
SOURCE = ASSETS / "source"

SVG_MASTER = SOURCE / "bibliography-builder-banner.svg"
REFERENCE  = SOURCE / "bibliography-builder-banner-reference-source-1920x560.png"

# Inkscape: prefer Homebrew path, fall back to PATH
_INKSCAPE_HOMEBREW = "/opt/homebrew/bin/inkscape"
INKSCAPE = _INKSCAPE_HOMEBREW if Path(_INKSCAPE_HOMEBREW).exists() else shutil.which("inkscape")

# Deployed banner sizes: (output_path, width, height)
BANNER_SIZES = [
    (ASSETS / "banner-1544x500.png", 1544, 500),
    (ASSETS / "banner-772x250.png",   772, 250),
]


def render_reference() -> None:
    """Render SVG master -> reference PNG at 1920x560 via Inkscape."""
    if not SVG_MASTER.exists():
        sys.exit(f"SVG master not found: {SVG_MASTER}")
    if not INKSCAPE:
        sys.exit("inkscape not found. Install via Homebrew: brew install inkscape")

    print(f"Rendering {SVG_MASTER.name} -> {REFERENCE.name} via Inkscape ...")
    result = subprocess.run(
        [
            INKSCAPE, str(SVG_MASTER),
            "--export-type=png",
            f"--export-filename={REFERENCE}",
            "--export-width=1920",
            "--export-height=560",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.exit(f"Inkscape error:\n{result.stderr}")
    print(f"  OK  {REFERENCE.name}")


def export_banner(reference: Path, output: Path, width: int, height: int) -> None:
    """Downscale reference PNG to target dimensions.

    Scales to fill the target height, preserving aspect ratio, then crops from
    the left edge (the banner design is left-anchored).  If the scaled width is
    narrower than the target, the image is centred on the background colour.
    """
    img = Image.open(reference).convert("RGBA")
    ref_w, ref_h = img.size

    scale    = height / ref_h
    scaled_w = round(ref_w * scale)
    scaled   = img.resize((scaled_w, height), Image.Resampling.LANCZOS)

    if scaled_w >= width:
        out = scaled.crop((0, 0, width, height))
    else:
        out = Image.new("RGBA", (width, height), "#F5F3EF")
        out.alpha_composite(scaled, ((width - scaled_w) // 2, 0))

    out.save(output)
    print(f"  OK  {output.name}  ({width}x{height})")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--skip-render",
        action="store_true",
        help="Skip Inkscape step and use existing reference PNG",
    )
    args = parser.parse_args()

    ASSETS.mkdir(exist_ok=True)
    SOURCE.mkdir(exist_ok=True)

    if args.skip_render:
        if not REFERENCE.exists():
            sys.exit(f"--skip-render set but reference PNG is missing:\n{REFERENCE}")
        print(f"Skipping Inkscape render; using existing {REFERENCE.name}")
    else:
        render_reference()

    print(f"Exporting deployed banners from {REFERENCE.name} ...")
    for output, w, h in BANNER_SIZES:
        export_banner(REFERENCE, output, w, h)

    print("Done.")


if __name__ == '__main__':
    main()
