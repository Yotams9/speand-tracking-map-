"""NP0 only: bounded Shufersal sample. No broad scraper or product integration."""
import gzip
import hashlib
import io
import json
import re
import time
from pathlib import Path
from urllib.parse import urlsplit

import requests
from bs4 import BeautifulSoup

OUT = Path('artifacts/nearby-prices-np0/sample')
LIMIT = 50_000_000
EXPANDED_LIMIT = 250_000_000
KINDS = {1: 'Price', 2: 'PriceFull', 3: 'Promo', 4: 'PromoFull', 5: 'Stores'}


def main():
    OUT.mkdir(parents=True, exist_ok=False)  # Do not silently repeat downloads.
    session = requests.Session()
    session.trust_env = False
    evidence = {'requests': [], 'files': [], 'compressed_bytes': 0, 'expanded_bytes': 0}

    def get(url, limit):
        parsed = urlsplit(url)
        assert parsed.scheme == 'https' and parsed.hostname in {
            'prices.shufersal.co.il', 'pricesprodpublic.blob.core.windows.net'}
        start = time.perf_counter()
        record = {'host': parsed.hostname, 'path': parsed.path}
        evidence['requests'].append(record)
        with session.get(url, stream=True, timeout=(10, 30), allow_redirects=False) as response:
            record['status'] = response.status_code
            if response.status_code != 200:
                raise RuntimeError('SOURCE_ACCESS_FAILED')
            data = bytearray()
            for chunk in response.iter_content(65536):
                if len(data) + len(chunk) > limit:
                    raise RuntimeError('SIZE_LIMIT')
                data.extend(chunk)
        record.update(bytes=len(data), seconds=round(time.perf_counter() - start, 3))
        return bytes(data)

    try:
        for branch in ('001', '002'):
            for category, kind in KINDS.items():
                if category == 5 and branch == '002':
                    continue  # Store directory is chain-wide; only inspect two branches later.
                html = get(f'https://prices.shufersal.co.il/FileObject/UpdateCategory?catID={category}&storeId={int(branch) if category != 5 else 0}', 2_000_000)
                soup = BeautifulSoup(html, 'html.parser')
                choices = []
                for link in soup.find_all('a', href=True):
                    url = link['href']
                    name = Path(urlsplit(url).path).name
                    if not name.endswith('.gz'):
                        continue
                    if category == 5:
                        eligible = name.startswith(('Stores7290027600007', 'Store7290027600007'))
                    else:
                        eligible = bool(re.fullmatch(rf'{kind}7290027600007-\d+-{branch}-\d{{8}}-\d{{6}}\.gz', name))
                    if eligible:
                        choices.append((name, url))
                if not choices:
                    raise RuntimeError('EXPECTED_FILE_UNAVAILABLE')
                name, url = sorted(choices, reverse=True)[0]
                raw = get(url, LIMIT - evidence['compressed_bytes'])
                evidence['compressed_bytes'] += len(raw)
                with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
                    xml = stream.read(EXPANDED_LIMIT - evidence['expanded_bytes'] + 1)
                if evidence['expanded_bytes'] + len(xml) > EXPANDED_LIMIT:
                    raise RuntimeError('EXPANDED_SIZE_LIMIT')
                evidence['expanded_bytes'] += len(xml)
                if b'<!DOCTYPE' in xml.upper() or b'<!ENTITY' in xml.upper():
                    raise RuntimeError('UNSAFE_XML')
                (OUT / name).write_bytes(raw)
                evidence['files'].append({'name': name, 'kind': kind, 'branch': branch,
                    'source': url.split('?')[0], 'sha256': hashlib.sha256(raw).hexdigest(),
                    'bytes': len(raw), 'xml_bytes': len(xml)})
                print(kind, branch, len(raw), flush=True)
        evidence['status'] = 'COLLECTED'
    except Exception as error:
        evidence['status'] = str(error) if type(error) is RuntimeError else type(error).__name__
        print('STOP:', evidence['status'])
    finally:
        session.close()
        (OUT.parent / 'sample-manifest.json').write_text(json.dumps(evidence, indent=2) + '\n')


if __name__ == '__main__':
    main()
