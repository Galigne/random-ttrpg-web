"""Regenerate website-only derivatives; originals and portable editions stay intact.

Requires Pillow and fonttools[woff]. The generated files are committed so they
are not needed to run the website or rebuild its HTML editions.
"""
import json
from pathlib import Path
from PIL import Image
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
artwork = json.loads((root / 'media/rulebook/artwork.json').read_text(encoding='utf-8'))['artworks']
output = root / 'public/rulebook-art'
output.mkdir(parents=True, exist_ok=True)
for item in artwork:
    source = root / 'media/rulebook' / item['web']['path']
    with Image.open(source) as image:
        resampling = getattr(Image, 'Resampling', Image)
        image.thumbnail((1200, 1200), resampling.LANCZOS)
        image.save(output / source.name, 'WEBP', quality=82, method=6)
for name in ('EBGaramond', 'EBGaramond-Italic', 'Cinzel'):
    source = root / 'documentation/rulebook/fonts' / (name + '.ttf')
    font = TTFont(source)
    font.flavor = 'woff2'
    font.save(source.with_suffix('.woff2'))
    font.close()
