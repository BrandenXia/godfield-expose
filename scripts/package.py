from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parents[1]
extension = root / 'extension'
manifest = json.loads((extension / 'manifest.json').read_text())
version = manifest['version']
if json.loads((root / 'package.json').read_text())['version'] != version:
    raise SystemExit('package.json and manifest.json versions must match')

# Include only the manifest and its declared scripts/styles. Local captures,
# editor files, or accidentally copied credentials must not enter a release.
files = {'manifest.json'}
for content_script in manifest['content_scripts']:
    files.update(content_script.get('js', []))
    files.update(content_script.get('css', []))
for name in files:
    candidate = extension / name
    if not candidate.is_file() or not candidate.resolve().is_relative_to(extension.resolve()):
        raise SystemExit(f'Invalid extension resource: {name}')

out = root / 'dist' / f'godfield-room-inspector-{version}.zip'
out.parent.mkdir(exist_ok=True)
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for name in sorted(files):
        archive.write(extension / name, name)
print(out)
