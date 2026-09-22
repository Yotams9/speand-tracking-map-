"""NP1 Shufersal-only offline prototype. No I/O, transport or database client.

Original code; deliberately does not use upstream XML recovery. Not a live-price
service: currency, coordinates and promotional eligibility remain unresolved.
"""
import gzip
import hashlib
import io
import json
import re
import zlib
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from lxml import etree

VERSION = 'np1-shufersal-1.1'
CHAIN = '7290027600007'
MAX_RAW = 50_000_000
MAX_XML = 250_000_000
MAX_ROWS = 100_000


class Rejected(ValueError):
    """Only fixed codes leave the boundary, never source values."""


def fail(code):
    raise Rejected(code)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':')).encode()).hexdigest()


def source_id(raw):
    if not re.fullmatch(r'[0-9]{1,16}', raw or ''):
        fail('INVALID_SOURCE_ID')
    return str(int(raw))  # Only retailer store/subchain IDs, never product codes.


def timestamp(raw):
    try:
        if not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?', raw):
            fail('INVALID_SOURCE_TIME')
        naive = datetime.fromisoformat(raw)
        zone = ZoneInfo('Asia/Jerusalem')
        candidates = {naive.replace(tzinfo=zone, fold=f).astimezone(timezone.utc)
                      for f in (0, 1) if naive.replace(tzinfo=zone, fold=f)
                      .astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) == naive}
        if len(candidates) != 1:
            fail('AMBIGUOUS_OR_NONEXISTENT_TIME')
        return next(iter(candidates)).isoformat()
    except (ValueError, TypeError):
        fail('INVALID_SOURCE_TIME')


def decimal_value(raw, optional=False):
    if not re.fullmatch(r'[0-9]{1,9}(?:\.[0-9]{1,6})?', raw or '') or Decimal(raw) <= 0:
        if optional:
            return None
        fail('INVALID_PRICE')
    return format(Decimal(raw), 'f')


def normalized_gtin(code, item_type):
    if item_type != '1' or not re.fullmatch(r'(?:[0-9]{8}|[0-9]{12,14})', code or ''):
        return None
    weighted = sum(int(v) * (3 if i % 2 == 0 else 1)
                   for i, v in enumerate(reversed(code[:-1])))
    return code.zfill(14) if (weighted + int(code[-1])) % 10 == 0 else None


def fields(element):
    result = {}
    for child in element:
        key = child.tag.lower()
        if key in result:
            fail('DUPLICATE_FIELD')
        result[key] = child
    return result


def text(element, key, required=False):
    child = fields(element).get(key.lower())
    if child is not None and len(child):
        fail('NONSCALAR_FIELD')
    value = child.text if child is not None else None
    if required and not value:
        fail('MISSING_FIELD')
    return value or ''


def strict_root(raw):
    if len(raw) > MAX_RAW:
        fail('COMPRESSED_LIMIT')
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
            xml = stream.read(MAX_XML + 1)
        if len(xml) > MAX_XML:
            fail('EXPANDED_LIMIT')
        # Require UTF-8; no alternate-encoding declaration or hidden UTF-16 DTD.
        decoded = xml.decode('utf-8-sig')
        if re.search(r'<!\s*(?:DOCTYPE|ENTITY)', decoded, re.I):
            fail('UNSAFE_XML_DECLARATION')
        if re.search(r'encoding\s*=\s*[\'"](?!utf-8[\'"])[^\'"]+', decoded, re.I):
            fail('UNSUPPORTED_ENCODING')
        root = etree.fromstring(xml, etree.XMLParser(resolve_entities=False,
            no_network=True, load_dtd=False, recover=False, huge_tree=False))
        if any(not isinstance(e.tag, str) or '{' in e.tag for e in root.iter()):
            fail('UNSUPPORTED_XML_NODE')
        return root
    except Rejected:
        raise
    except (OSError, EOFError, UnicodeError, etree.XMLSyntaxError, zlib.error):
        raise Rejected('INVALID_GZIP_OR_XML') from None


@dataclass(frozen=True)
class Source:
    filename: str
    url: str
    sha256: str
    ingested_at: str
    fetched_at: str | None = None


@dataclass(frozen=True)
class Batch:
    file_key: str
    kind: str
    partition: tuple
    published_at: str
    provenance_json: str
    rows_json: str

    @property
    def content_key(self):
        return digest([CHAIN, json.loads(self.provenance_json)['sha256']])

    @property
    def rows(self):
        return json.loads(self.rows_json)  # callers cannot mutate the batch


def normalize(raw, source, stores=frozenset()):
    actual_hash = hashlib.sha256(raw).hexdigest()
    if actual_hash != source.sha256:
        fail('CHECKSUM_MISMATCH')
    url = urlsplit(source.url)
    if url.scheme != 'https' or url.hostname != 'pricesprodpublic.blob.core.windows.net' or url.query or url.fragment or url.username or url.password:
        fail('INVALID_PROVENANCE_URL')
    if url.path.rsplit('/', 1)[-1] != source.filename:
        fail('SOURCE_NAME_MISMATCH')
    try:
        fetched = datetime.fromisoformat(source.ingested_at)
        if fetched.tzinfo is None:
            fail('INVALID_INGEST_TIME')
    except ValueError:
        fail('INVALID_INGEST_TIME')
    if source.fetched_at is not None:
        try:
            download_time = datetime.fromisoformat(source.fetched_at)
            if download_time.tzinfo is None or download_time > fetched:
                fail('INVALID_FETCH_TIME')
        except ValueError:
            fail('INVALID_FETCH_TIME')
    root = strict_root(raw)
    root_fields = fields(root)
    chain = text(root, 'chainid', True)
    if chain != CHAIN:
        fail('UNAPPROVED_CHAIN')
    match = re.fullmatch(r'(PriceFull|Price|PromoFull|Promo)'+CHAIN+r'-(\d+)-(\d+)-(\d{8})-(\d{6})\.gz', source.filename)
    if match:
        kind, sub, store, date, clock = match.groups()
        partition = (chain, source_id(sub), source_id(store))
        if partition[2] not in ('1', '2') or partition not in stores:
            fail('UNKNOWN_OR_UNAPPROVED_STORE')
        if (source_id(text(root, 'subchainid', True)), source_id(text(root, 'storeid', True))) != partition[1:]:
            fail('FILE_ID_MISMATCH')
        published = timestamp(f'{date[:4]}-{date[4:6]}-{date[6:]}T{clock[:2]}:{clock[2:4]}:{clock[4:]}')
        parent = root_fields.get('items' if kind.startswith('Price') else 'promotions')
        if parent is None:
            fail('MISSING_COLLECTION')
        nodes = list(parent)
        expected = 'item' if kind.startswith('Price') else 'promotion'
        if any(n.tag.lower() != expected for n in nodes):
            fail('UNEXPECTED_ROW_TYPE')
    elif re.fullmatch(r'Stores'+CHAIN+r'-\d+-\d{8}-\d+\.gz', source.filename):
        kind, partition = 'Stores', (chain,)
        published = timestamp(text(root, 'lastupdatedate', True)+'T'+text(root, 'lastupdatetime', True))
        nodes = root.findall('.//Store')
    else:
        fail('INVALID_FILENAME')
    if datetime.fromisoformat(published) > fetched:
        fail('FUTURE_SOURCE_TIME')
    if not nodes or len(nodes) > MAX_ROWS:
        fail('EMPTY_OR_OVERSIZED_COLLECTION')
    rows, seen = [], set()
    for node in nodes:
        if kind == 'Stores':
            raw_store = text(node, 'storeid', True)
            if source_id(raw_store) not in ('1', '2'):
                continue
            raw_sub = text(node.getparent().getparent(), 'subchainid', True)
            key = (chain, source_id(raw_sub), source_id(raw_store))
            row = {'key': key, 'raw_store': raw_store, 'raw_subchain': raw_sub,
                   'name': text(node, 'storename', True), 'address': text(node, 'address'),
                   'city': text(node, 'city'), 'store_type': text(node, 'storetype', True),
                   'coordinates': None, 'coordinate_provenance': None}
        elif kind.startswith('Price'):
            code, item_type = text(node, 'itemcode', True), text(node, 'itemtype', True)
            if not re.fullmatch('[0-9]{1,32}', code) or item_type not in ('0', '1'):
                fail('INVALID_ITEM_IDENTITY')
            key = (item_type, code)
            status = text(node, 'itemstatus')
            if kind == 'PriceFull' and status == '':
                operation = 'snapshot'
            elif status in ('0', '1', '2'):
                operation = {'0': 'remove', '1': 'update', '2': 'add'}[status]
            else:
                fail('UNSUPPORTED_ITEM_STATUS')
            changed = timestamp(text(node, 'priceupdatetime', True))
            if changed > published:
                fail('ITEM_TIME_AFTER_FILE')
            package = {'quantity': decimal_value(text(node, 'quantity'), True),
                       'unit': text(node, 'unitqty'), 'count': decimal_value(text(node, 'qtyinpackage'), True)}
            row = {'key': key, 'original_code': code, 'item_type': item_type,
                   'gtin14': normalized_gtin(code, item_type), 'label': text(node, 'itemname'),
                   'price': None if operation == 'remove' else decimal_value(text(node, 'itemprice')),
                   'currency': None, 'operation': operation, 'raw_status': status,
                   'item_changed_at': changed, 'package': package,
                   'weighted': text(node, 'bisweighted'), 'comparison_eligible': False,
                   'raw_fields': {c.tag: c.text for c in node}}
        else:
            key = text(node, 'promotionid', True)
            start = timestamp(text(node, 'promotionstartdatetime', True))
            end = timestamp(text(node, 'promotionenddatetime', True))
            if end < start:
                fail('INVALID_PROMOTION_RANGE')
            row = {'key': key, 'starts_at': start, 'ends_at': end,
                   'eligibility': 'unresolved', 'effective_price': None,
                   'conditions_xml': etree.tostring(node, encoding='unicode')}
        encoded_key = json.dumps(key)
        if encoded_key in seen:
            fail('DUPLICATE_RECORD')
        seen.add(encoded_key)
        row['observation_id'] = digest([VERSION, kind, partition, published, row])
        rows.append(row)
    if not rows:
        fail('NO_APPROVED_ROWS')
    provenance = {'adapter': VERSION, 'source': source.url, 'filename': source.filename,
                  'sha256': actual_hash, 'fetched_at': source.fetched_at, 'ingested_at': source.ingested_at,
                  'published_at': published, 'timestamp_basis': 'filename' if kind != 'Stores' else 'source_fields'}
    # Public source naming/time identify a publication; fetch/ingestion time do not.
    publication_key = digest([CHAIN, kind, partition, source.filename, source.url,
                              published, actual_hash])
    return Batch(publication_key, kind, partition, published,
                 json.dumps(provenance, sort_keys=True), json.dumps(rows, sort_keys=True))


class Projection:
    """In-memory replay only. Validate all rows before any mutation."""
    def __init__(self):
        self.files, self.observations, self.current, self.watermarks = {}, {}, {}, {}
        self.publications = []
        self.contents = set()

    def apply(self, batch, expected_previous=None):
        if batch.file_key in self.files:
            return 'duplicate'
        family = 'Price' if batch.kind.startswith('Price') else 'Promo' if batch.kind.startswith('Promo') else 'Stores'
        key = (*batch.partition, family)
        old = self.watermarks.get(key)
        full = batch.kind.endswith('Full') or family == 'Stores'
        if old and batch.published_at == old:
            fail('CONFLICTING_SAME_TIME_FILE')
        if not full and old is None:
            fail('DELTA_WITHOUT_BASELINE')
        if not full and batch.published_at > old and expected_previous != old:
            fail('UNVERIFIED_DELTA_CONTINUITY')
        rows = batch.rows
        self.files[batch.file_key] = batch.provenance_json
        self.contents.add(batch.content_key)
        for row in rows:
            self.observations[row['observation_id']] = json.dumps(row, sort_keys=True)
        if old and batch.published_at < old:
            return 'historical_only'
        updated = {} if full else dict(self.current.get(key, {}))
        for row in rows:
            row_key = json.dumps(row['key'])
            if row.get('operation') == 'remove':
                updated.pop(row_key, None)
            else:
                updated[row_key] = row
        self.current[key] = updated
        self.watermarks[key] = batch.published_at
        self.publications.append({'file': batch.file_key, 'content': batch.content_key, 'partition': key,
                                  'mode': 'full_replacement' if full else 'verified_delta',
                                  'rows': len(updated)})
        return 'applied'
