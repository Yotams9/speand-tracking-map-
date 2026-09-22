"""Read only the retained NP0 sample; write aggregate QA evidence, never a DB."""
import json
import socket
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/nearby-prices'))
from offline import Projection, Rejected, Source, normalize


def main():
    attempts = []
    def block(*args, **kwargs):
        attempts.append('BLOCKED')
        raise RuntimeError('OFFLINE_ONLY')
    socket.socket.connect = block
    socket.create_connection = block
    base = Path('artifacts/nearby-prices-np0')
    evidence = json.loads((base / 'sample-manifest.json').read_text())
    results, stores, batches = [], frozenset(), []
    now = datetime.now(timezone.utc).isoformat()
    for file in sorted(evidence['files'], key=lambda f: f['kind'] != 'Stores'):
        source = Source(file['name'], file['source'], file['sha256'], now)
        try:
            batch = normalize((base / 'sample' / file['name']).read_bytes(), source, stores)
            if batch.kind == 'Stores':
                stores = frozenset(tuple(row['key']) for row in batch.rows)
            batches.append(batch)
            results.append({'file': file['name'], 'status': 'normalized', 'rows': len(batch.rows),
                            'gtin_rows': sum(bool(r.get('gtin14')) for r in batch.rows),
                            'eligible_rows': sum(bool(r.get('comparison_eligible')) for r in batch.rows),
                            'missing_package_count': sum(r.get('package', {}).get('count') is None for r in batch.rows if 'package' in r)})
        except Rejected as error:
            results.append({'file': file['name'], 'status': 'quarantined', 'code': str(error)})
    projection = Projection()
    replay = []
    for batch in sorted(batches, key=lambda b: (not (b.kind.endswith('Full') or b.kind == 'Stores'), b.published_at)):
        try:
            replay.append({'kind': batch.kind, 'partition': batch.partition, 'result': projection.apply(batch)})
        except Rejected as error:
            replay.append({'kind': batch.kind, 'result': str(error)})
    before = len(projection.observations)
    repeats = [projection.apply(b) for b in batches if b.file_key in projection.files]
    assert len(projection.observations) == before
    report = {'ingested_at': now, 'downloaded_at': None,
              'timestamp_note': 'NP0 did not retain exact download timestamps; not invented.',
              'files': results, 'replay': replay, 'repeat_results': repeats,
              'observations': before, 'source_files': len(projection.files),
              'unique_contents': len(projection.contents),
              'network_attempts': len(attempts)}
    out = Path('artifacts/nearby-prices-np1'); out.mkdir(exist_ok=True)
    (out / 'replay.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
