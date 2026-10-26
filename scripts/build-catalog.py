"""Build bundled item translations from official /i18n/<language>.json files.

Usage: python3 scripts/build-catalog.py /path/to/downloaded/catalogs
Download all eight files from https://godfield.net/i18n/ before running.
"""
import json
import sys
from pathlib import Path

languages = ['en', 'fr', 'ja', 'ko', 'pt', 'ru', 'zh-hans', 'zh-hant']
source = Path(sys.argv[1])
raw = {lang: json.loads((source / f'{lang}.json').read_text()) for lang in languages}
english = raw['en']['items']
fields = ('imageName', 'category', 'atk', 'isPlusAtk', 'def', 'cost', 'price', 'ability', 'abilityValue', 'element', 'hitRate', 'curse', 'giftRate')
catalog = {'models': [{k: item[k] for k in fields if k in item} for item in english], 'languages': {}}
for lang, data in raw.items():
    assert len(data['items']) == len(english), f'{lang}: item count changed'
    for i, item in enumerate(data['items']):
        assert (item['imageName'], item['category']) == (english[i]['imageName'], english[i]['category']), f'{lang}: ID {i + 1} differs'
    catalog['languages'][lang] = {
        'label': data['texts']['langNames'][lang],
        'names': [item['name'] for item in data['items']],
        'categories': {key: data['texts']['reference'][key] for key in sorted({i['category'] for i in english})},
        'elements': data['texts']['elementNames'],
        'stats': {key: data['texts']['game'][key].replace('<br>', ' ') for key in ('atk', 'plusAtk', 'def', 'cost', 'cp')}
    }
output = Path(__file__).resolve().parents[1] / 'extension/catalog.js'
output.write_text('// Generated from God Field public /i18n/*.json catalogs. Preserve one-based item ordering.\n'
                  + 'const GODFIELD_CATALOG = ' + json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'Bundled {len(english)} items in {len(languages)} languages.')
