"""Retained NP0 input only, offline. Aggregate evidence, no raw dataset export."""
import json
import socket
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/nearby-prices'))
from offline import CHAIN, Projection, Rejected, Source, normalize
from same_chain import index_gtins, package_equal, variant_equal, ordinary_price, fresh, qualify_location


def qualify(base, locations, now):
    manifest = json.loads((base / 'sample-manifest.json').read_text())
    batches, stores, statuses = [], frozenset(), []
    store_rows = []
    for f in sorted(manifest['files'], key=lambda f: f['kind'] != 'Stores'):
        try:
            b = normalize((base / 'sample' / f['name']).read_bytes(),
                          Source(f['name'], f['source'], f['sha256'], now), stores)
            if b.kind == 'Stores':
                store_rows = b.rows
                stores = frozenset(tuple(r['key']) for r in b.rows)
            batches.append(b)
            statuses.append({'name': f['name'], 'status': 'normalized', 'rows': len(b.rows)})
        except Rejected as error:
            statuses.append({'name': f['name'], 'status': 'quarantined', 'code': str(error)})
    p = Projection()
    replay = []
    for b in sorted(batches, key=lambda b: (not (b.kind.endswith('Full') or b.kind == 'Stores'), b.published_at)):
        try:
            replay.append({'kind': b.kind, 'partition': b.partition, 'status': p.apply(b)})
        except Rejected as error:
            replay.append({'kind': b.kind, 'partition': b.partition, 'status': 'quarantined', 'code': str(error)})
    before = repr(p.current)
    repeats = [p.apply(b) for b in batches if b.file_key in p.files]
    assert repr(p.current) == before
    keys = [(CHAIN, '1', branch, 'Price') for branch in ('1', '2')]
    if any(k not in p.current for k in keys):
        raise ValueError('MISSING_APPROVED_BASELINE')
    indexes = [index_gtins(p.current[k].values()) for k in keys]
    shared = sorted(set(indexes[0][0]) & set(indexes[1][0]))
    packaged = [g for g in shared if package_equal(indexes[0][0][g], indexes[1][0][g])]
    variants = [g for g in packaged if variant_equal(indexes[0][0][g], indexes[1][0][g])]
    paired = [g for g in variants if all(ordinary_price(i[0][g], 'PriceFull') is not None for i in indexes)]
    directions = Counter()
    for g in paired:
        a, b = (ordinary_price(i[0][g], 'PriceFull') for i in indexes)
        directions['equal' if a == b else 'store_1_lower' if a < b else 'store_2_lower'] += 1
    qualified_locations = []
    specs = [('79', 'בן יהודה', {'תל־אביב–יפו'}), ('1', 'אגרון', {'ירושלים', 'ירושלים | القدس'})]
    for record, (house, road, cities) in zip(locations, specs):
        qualified_locations.append(qualify_location(record.get('results', []), house=house,
            road=road, cities=cities, verified_at=record['time']))
    return {'comparison_time': now, 'files': statuses, 'replay': replay,
            'provenance': [json.loads(b.provenance_json) for b in batches],
            'stores': store_rows, 'rows_per_store': [len(p.current[k]) for k in keys],
            'unique_valid_gtins': [len(i[0]) for i in indexes],
            'ambiguous_gtins_excluded': [len(i[1]) for i in indexes],
            'shared_valid_gtins': len(shared), 'package_matches': len(packaged),
            'variant_matches': len(variants), 'ordinary_base_pairs': len(paired),
            'price_ordering_without_currency_claim': dict(directions),
            'source_publications': [p.watermarks[k] for k in keys],
            'within_24_hours': [fresh(p.watermarks[k], now) for k in keys],
            'known_coverage_complete_at_comparison': False,
            'currency': None, 'qualified_locations': qualified_locations,
            'distance_m': None, 'within_5km': None, 'fully_eligible_historical_examples': 0,
            'blockers': ['UNRESOLVED_CURRENCY', 'AMBIGUOUS_AGRON_COORDINATE'],
            'repeat_results': repeats, 'observations': len(p.observations)}


def main():
    attempts = []
    def blocked(*args, **kwargs):
        attempts.append('BLOCKED')
        raise RuntimeError('OFFLINE_ONLY')
    with patch.object(socket.socket, 'connect', blocked), patch.object(socket, 'create_connection', blocked):
        base = Path('artifacts/nearby-prices-np0')
        locations = json.loads(Path('artifacts/nearby-prices-np2f/location-evidence.json').read_text())
        report = qualify(base, locations, datetime.now(timezone.utc).isoformat())
    report['network_attempts'] = len(attempts)
    Path('artifacts/nearby-prices-np2f/comparison.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ('provenance', 'files', 'replay', 'stores')}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
