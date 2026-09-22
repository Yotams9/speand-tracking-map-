"""Offline NP0 measurements; aggregate evidence only, no normalized product store."""
import asyncio
import contextlib
import gzip
import hashlib
import io
import json
import logging
import resource
import socket
import time
from decimal import Decimal, InvalidOperation
from pathlib import Path
from xml.etree import ElementTree as ET

BASE = Path('artifacts/nearby-prices-np0')
# Configure the upstream named loggers before import; their defaults create a file.
for logger_name in ('mylogger', 'Logger'):
    logging.getLogger(logger_name).addHandler(logging.NullHandler())
    logging.getLogger(logger_name).propagate = False
logging.disable(logging.CRITICAL)


def gtin(value):
    return (value.isascii() and value.isdigit() and len(value) in (8, 12, 13, 14)
            and sum(int(c) * (3 if i % 2 == 0 else 1)
                    for i, c in enumerate(reversed(value[:-1]))) % 10 == (-int(value[-1])) % 10)


async def main():
    logging.disable(logging.CRITICAL)
    requests_blocked = []

    def reject_network(*args, **kwargs):
        requests_blocked.append('NETWORK_ATTEMPT')
        raise RuntimeError('NETWORK_DISABLED')

    socket.socket.connect = reject_network
    socket.create_connection = reject_network
    from il_supermarket_parsers.parsers.shufersal import ShufersalFileConverter
    from il_supermarket_parsers.utils.xml_utils import get_root_from_content
    converter = ShufersalFileConverter()
    parsers = {'Price': converter.price_parser, 'PriceFull': converter.pricefull_parser,
               'Promo': converter.promo_parser, 'PromoFull': converter.promofull_parser,
               'Stores': converter.stores_parser}
    manifest = json.loads((BASE / 'sample-manifest.json').read_text())
    results = []
    for file in manifest['files']:
        xml = gzip.decompress((BASE / 'sample' / file['name']).read_bytes())
        root = ET.fromstring(xml)  # independent strict preflight; no recovery
        tags = sorted({e.tag for e in root.iter()})
        result = {'name': file['name'], 'kind': file['kind'], 'xml_tags': tags,
                  'runs': [], 'coordinate_tags': [t for t in tags if t.lower() in
                  ('latitude', 'longitude', 'lat', 'lon', 'lng', 'x', 'y')]}
        for _ in range(3):
            start = time.perf_counter()
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                rows = [row async for row in parsers[file['kind']].convert(
                    'NP0', file['name'], file_content=xml)]
            if file['kind'] == 'Stores':
                rows = [r for r in rows if str(r.get('storeid', '')).lstrip('0') in ('1', '2')]
            result['runs'].append({'rows': len(rows), 'seconds': round(time.perf_counter()-start, 6),
                'sha256': hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()})
        result['repeat_identical'] = len({r['sha256'] for r in result['runs']}) == 1
        result['output_keys'] = sorted({k for row in rows for k in row})
        if file['kind'].startswith('Price'):
            items = root.findall('.//Item')
            def field(item, name):
                return (item.findtext(name) or '').strip()
            valid_prices = 0
            for item in items:
                try:
                    v = Decimal(field(item, 'ItemPrice'))
                    valid_prices += int(v.is_finite() and v > 0)
                except InvalidOperation:
                    pass
            result['source_items'] = len(items)
            result['valid_positive_prices'] = valid_prices
            result['valid_gtin_external_items'] = sum(field(i, 'ItemType') == '1' and gtin(field(i, 'ItemCode')) for i in items)
            result['item_types'] = sorted({field(i, 'ItemType') for i in items})
            result['package_quantity_present'] = sum(bool(field(i, 'Quantity')) for i in items)
            dates = sorted({field(i, 'PriceUpdateTime') for i in items})
            result['source_update_range'] = [dates[0], dates[-1]] if dates else []
            result['ids'] = {k: root.findtext(k) for k in ('ChainId', 'SubChainId', 'StoreId')}
            source_by_id = {field(i, 'ItemCode'): i for i in items}
            mismatches = 0
            for row in rows:
                item = source_by_id.get(row.get('itemcode'))
                if item is None:
                    mismatches += 1
                    continue
                for element in item:
                    if len(element) == 0 and element.text:
                        mismatches += row.get(element.tag.lower()) != element.text
            result['nonempty_source_leaf_mismatches'] = mismatches
            result['duplicate_source_itemcodes'] = len(items) - len(source_by_id)
        results.append(result)
    malformed = b'<Root><Items><Item><ItemCode>123</ItemCode></Items></Root>'
    try:
        get_root_from_content(malformed)
        recovery = 'ACCEPTED_MALFORMED_XML'
    except Exception:
        recovery = 'REJECTED_MALFORMED_XML'
    report = {'files': results, 'library_malformed_xml': recovery,
              'network_attempts': len(requests_blocked),
              'peak_process_rss_bytes_macos': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
              'scope': 'In-memory library conversion; three runs per file; not ingestion idempotency or production safety.'}
    (BASE / 'benchmark-results.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'files': len(results), 'repeat_identical': all(x['repeat_identical'] for x in results),
                      'malformed': recovery, 'network_attempts': len(requests_blocked)}))


if __name__ == '__main__':
    asyncio.run(main())
