"""Explicit bounded public Shufersal refresh. No credentials or user data.

One invocation, no resume/retry; retain every attempted response before parsing.
Uses curl's normal certificate verification and manually counts redirects.
"""
import argparse, gzip, hashlib, io, json, os, re, subprocess, sys
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, parse_qs, urlunsplit
import xml.etree.ElementTree as ET

CHAIN = '7290027600007'
COMPRESSED = 25_000_000
EXPANDED = 200_000_000

class Stop(ValueError):
    pass

def require(ok, code):
    if not ok:
        raise Stop(code)

def utc():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def safe_public_query(query):
    if not query:
        return True
    q = parse_qs(query, strict_parsing=True)
    return (len(query) <= 1024 and set(q) == {'sv', 'sr', 'sig', 'se', 'sp'}
            and all(len(v) == 1 for v in q.values()) and q['sp'] == ['r']
            and q['sr'] == ['b'] and re.fullmatch(r'[A-Za-z0-9+/=]{20,200}', q['sig'][0])
            and re.fullmatch(r'\d{4}-\d{2}-\d{2}', q['sv'][0])
            and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', q['se'][0]))

def canonical(url):
    u = urlsplit(url)
    return urlunsplit((u.scheme, u.netloc, u.path, '', ''))

def allowed(url):
    u = urlsplit(url)
    return (u.scheme == 'https' and not u.username and not u.password and not u.fragment
            and u.port in (None, 443) and
            ((u.netloc == 'prices.shufersal.co.il' and u.path == '/FileObject/UpdateCategory'
              and u.query in ('catID=5&storeId=0', 'catID=2&storeId=104', 'catID=2&storeId=285'))
             or (u.netloc == 'pricesprodpublic.blob.core.windows.net' and safe_public_query(u.query)
                 and re.fullmatch(r'/(stores/Stores?7290027600007-\d{3}-\d{8}-\d{3,6}|pricefull/PriceFull7290027600007-\d{3}-(104|285)-\d{8}-\d{6})\.gz', u.path))))

def durable(path, data):
    with open(path, 'x', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())

def headers(raw):
    # curl may include proxy CONNECT headers: inspect the final response only.
    block = re.split(r'\r?\n\r?\n', raw.strip())[-1]
    out = {}
    for line in block.splitlines()[1:]:
        if ':' in line:
            k, v = line.split(':', 1)
            k = k.lower().strip()
            if k in ('last-modified', 'location', 'content-type', 'content-length'):
                require(k not in out, 'duplicate-response-header')
                out[k] = v.strip()
    return out

class Collector:
    def __init__(self, folder, run=subprocess.run, resume=False):
        self.folder, self.run = Path(folder), run
        if resume:
            require(self.folder.is_dir(), 'session-missing')
            session = json.loads((self.folder / 'session.json').read_text())
            require(session['maxAttempts'] == 8 and session['certificateVerification'] is True, 'session-policy-invalid')
        else:
            self.folder.mkdir(exist_ok=False)
        self.used, self.compressed, self.expanded, self.files = 0, 0, 0, 0
        if resume:
            for f in sorted(self.folder.glob('attempt-*-reserved.json'), key=lambda f: int(f.name.split('-')[1])):
                n = int(f.name.split('-')[1]); require(n == self.used + 1, 'session-gap')
                m = json.loads((self.folder / f'attempt-{n}-result.json').read_text())
                b = self.folder / f'attempt-{n}.body'
                require(m['httpStatus'] == 200 and m['transportExit'] == 0 and hashlib.sha256(b.read_bytes()).hexdigest() == m['sha256'], 'prior-attempt-not-successful')
                self.used = n; self.compressed += m['bodyBytes']
                if urlsplit(m['url']).path.endswith('.gz'):
                    self.files += 1
                    with gzip.GzipFile(fileobj=io.BytesIO(b.read_bytes())) as z: self.expanded += len(z.read(EXPANDED-self.expanded+1))
                require(self.used <= 8 and self.compressed <= COMPRESSED and self.expanded <= EXPANDED and self.files <= 3, 'session-bound-exceeded')
            return
        durable(self.folder / 'session.json', {'maxAttempts': 8, 'maxFiles': 3,
            'compressedLimit': COMPRESSED, 'expandedLimit': EXPANDED,
            'createdAt': utc(), 'certificateVerification': True, 'automaticRetries': 0})

    def get(self, url, feed=False):
        require(allowed(url), 'source-not-allowlisted')
        require(not feed or self.files < 3, 'feed-limit')
        while True:
            require(self.used < 8, 'attempt-limit')
            self.used += 1
            prefix = self.folder / f'attempt-{self.used}'
            durable(Path(str(prefix) + '-reserved.json'), {'ordinal': self.used, 'url': canonical(url) if feed else url, 'reservedAt': utc()})
            body, head = Path(str(prefix) + '.body'), Path(str(prefix) + '.headers')
            limit = min(COMPRESSED - self.compressed, COMPRESSED if feed else 2_000_000)
            require(limit > 0, 'compressed-limit')
            p = self.run(['/usr/bin/curl', '--disable', '--no-insecure', '--silent', '--proto', '=https', '--max-redirs', '0',
                '--retry', '0', '--connect-timeout', '10', '--max-time', '45',
                '--max-filesize', str(limit), '--dump-header', str(head), '--output', str(body),
                '--write-out', '%{http_code}', url], capture_output=True, text=True, timeout=50)
            size = body.stat().st_size if body.exists() else 0
            self.compressed += size
            h = headers(head.read_text()) if head.exists() else {}
            status = int(p.stdout) if re.fullmatch(r'\d{3}', p.stdout) else 0
            m = {'url': canonical(url) if feed else url, 'httpStatus': status, 'transportExit': p.returncode,
                 'bodyBytes': size, 'fetchedAt': utc(), 'headers': h,
                 'sha256': hashlib.sha256(body.read_bytes()).hexdigest() if body.exists() else None}
            durable(Path(str(prefix) + '-result.json'), m)
            require(p.returncode == 0, 'certificate-or-transport-failure')
            require(self.compressed <= COMPRESSED and size <= limit, 'compressed-limit')
            if status in (301, 302, 303, 307, 308):
                url = urljoin(url, h.get('location', ''))
                require(allowed(url) and h.get('location'), 'redirect-not-allowlisted')
                continue
            require(status == 200, 'source-http-failure')
            require(size > 0, 'empty-response')
            if feed:
                self.files += 1
                with gzip.GzipFile(fileobj=io.BytesIO(body.read_bytes())) as f:
                    xml = f.read(EXPANDED - self.expanded + 1)
                self.expanded += len(xml)
                require(self.expanded <= EXPANDED, 'expanded-limit')
                require(b'<!DOCTYPE' not in xml.upper() and b'<!ENTITY' not in xml.upper()
                        and b'\0' not in xml, 'unsafe-xml')
                m['expandedBytes'] = len(xml)
            return body.read_bytes(), m

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.urls += [v for k, v in attrs if k == 'href' and v]

def published(raw, store=None):
    p = Links()
    p.feed(raw.decode('utf-8-sig'))
    pattern = (r'Stores?' + CHAIN + r'-\d{3}-\d{8}-\d{3,6}\.gz' if store is None else
               r'PriceFull' + CHAIN + r'-' + ('001' if store == '104' else '007') + '-' + store + r'-\d{8}-\d{6}\.gz')
    choices = {u for u in p.urls if allowed(u) and re.fullmatch(pattern, Path(urlsplit(u).path).name)}
    require(bool(choices), 'published-link-missing')
    return max(choices, key=lambda u: Path(urlsplit(u).path).name)

def value(node, tag):
    rows = [x for x in node if x.tag.lower() == tag.lower()]
    require(len(rows) == 1 and rows[0].text and rows[0].text.strip(), 'required-directory-field')
    return rows[0].text.strip()

def directory(raw):
    xml = gzip.decompress(raw)
    r = ET.fromstring(xml)
    require(r.tag == 'Chain' and value(r, 'ChainID') == CHAIN, 'directory-chain')
    rows, ids = [], set()
    for sub in r.findall('./SubChains/SubChain'):
        subid = str(int(value(sub, 'SubChainID')))
        for s in sub.findall('./Stores/Store'):
            sid = str(int(value(s, 'StoreID')))
            require((subid, sid) not in ids, 'directory-duplicate')
            ids.add((subid, sid))
            if (subid, sid) in [('1', '104'), ('7', '285')]:
                require(value(s, 'StoreType') == '1' and value(s, 'City') == '7900'
                        and re.search(r'פ["״]ת|פתח[ -]תקו[וו]?ה', value(s, 'StoreName')), 'directory-city')
                rows.append({'key': [CHAIN, subid, sid], 'check': value(s, 'BikoretNo'),
                    'type': '1', 'name': value(s, 'StoreName'), 'address': value(s, 'Address'), 'city': '7900'})
    require(len(rows) == 2, 'directory-branch-missing')
    return {'city': 'Petah Tikva', 'directoryHash': hashlib.sha256(raw).hexdigest(),
            'cityEvidence': 'Official physical branch names and City 7900; coordinates and distances unqualified', 'branches': rows}

def collect(folder, resume=False):
    c = Collector(folder, resume=resume)
    if resume:
        require(c.used == 1 and c.files == 0, 'resume-state-unsupported')
        listing = (c.folder / 'attempt-1.body').read_bytes()
    else:
        listing, _ = c.get('https://prices.shufersal.co.il/FileObject/UpdateCategory?catID=5&storeId=0')
    raw, meta = c.get(published(listing), feed=True)
    branches = directory(raw)
    durable(c.folder / 'branches.json', branches)
    for b in branches['branches']:
        sid = b['key'][2]
        listing, _ = c.get('https://prices.shufersal.co.il/FileObject/UpdateCategory?catID=2&storeId=' + sid)
        url = published(listing, sid)
        raw, m = c.get(url, feed=True)
        name = Path(urlsplit(url).path).name
        publication = parsedate_to_datetime(m['headers'].get('last-modified', ''))
        fetched = datetime.fromisoformat(m['fetchedAt'].replace('Z', '+00:00'))
        require(publication.tzinfo and 0 <= (fetched - publication).total_seconds() <= 86400, 'publication-stale-or-unknown')
        (c.folder / name).write_bytes(raw)
        durable(c.folder / ('price-' + sid + '-result.json'), {**m, 'source': canonical(url), 'name': name,
            'lastModified': m['headers']['last-modified'],
            'publicationRaw': ''.join(name[:-3].split('-')[-2:])})
    # Current qualifier expects a legacy aggregate reserve; zero here because
    # this invocation independently enforces the complete expanded budget.
    durable(c.folder / 'ledger.json', {'priorExpandedReserve': 0, 'attempts': c.used,
        'compressedBytes': c.compressed, 'expandedBytes': c.expanded, 'feedFiles': c.files})
    return {'status': 'collected', 'attempts': c.used, 'remaining': 8-c.used,
            'compressedBytes': c.compressed, 'expandedBytes': c.expanded, 'files': c.files}

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--continue-cached-listing', action='store_true')
    ap.add_argument('--approved-public-refresh', required=True, metavar='NEW_DIRECTORY')
    args = ap.parse_args()
    try:
        print(json.dumps(collect(args.approved_public_refresh, args.continue_cached_listing)))
    except Exception as e:
        print(json.dumps({'status': 'stopped', 'reason': str(e) if isinstance(e, Stop) else 'source-processing-failed'}))
        sys.exit(1)
