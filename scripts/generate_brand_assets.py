from pathlib import Path
from PIL import Image

ROOT = Path('/Users/danknauss/Developer/GitHub/wp-bibliography-block')
ASSETS = ROOT / '.wordpress-org'
SOURCE = ASSETS / 'source'
REFERENCE = SOURCE / 'banner-reference-1920x560.png'


def export_banner(reference_path: Path, output_path: Path, size: tuple[int, int]) -> None:
    width, height = size
    image = Image.open(reference_path).convert('RGBA')
    ref_width, ref_height = image.size

    scale = height / ref_height
    scaled_width = round(ref_width * scale)
    scaled = image.resize((scaled_width, height), Image.Resampling.LANCZOS)

    if scaled_width < width:
        canvas = Image.new('RGBA', (width, height), '#F5F3EF')
        canvas.alpha_composite(scaled, ((width - scaled_width) // 2, 0))
        canvas.save(output_path)
        return

    crop_left = 0
    crop_right = crop_left + width
    cropped = scaled.crop((crop_left, 0, crop_right, height))
    cropped.save(output_path)


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    SOURCE.mkdir(exist_ok=True)

    if not REFERENCE.exists():
        raise FileNotFoundError(f'Missing banner reference image: {REFERENCE}')

    export_banner(REFERENCE, ASSETS / 'banner-1544x500.png', (1544, 500))
    export_banner(REFERENCE, ASSETS / 'banner-772x250.png', (772, 250))


if __name__ == '__main__':
    main()
