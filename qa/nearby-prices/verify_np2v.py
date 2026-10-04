"""NP2V Stage 1 only: stateless, bounded public HTTPS verification.

No upstream imports, cookies, proxy environment, redirects, retries or datasets.
Callers explicitly inspect each response before authorizing another request.
"""
import hashlib
import contextlib
import http.client
import ssl
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit, urljoin

HOSTS = frozenset({'carrefour.co.il', 'www.carrefour.co.il', 'prices.carrefour.co.il'})
HEADERS = {'User-Agent': 'Spendscape-NP2V-college-source-verification/1.0',
           'Accept': 'text/html,text/plain', 'Accept-Encoding': 'identity'}


class Stopped(Exception):
    """Fixed error code only; never propagate a transport exception."""


def checked_url(url):
    try:
        u = urlsplit(url)
        if (u.scheme != 'https' or u.hostname not in HOSTS or u.port not in (None, 443)
                or u.username is not None or u.password is not None or u.query or u.fragment
                or '%' in u.path or '\\' in url or any(ord(c) < 33 or ord(c) > 126 for c in url)):
            raise ValueError()
        path = u.path or '/'
        if path.lower().endswith(('.gz', '.zip', '.xml', '.json')):
            raise ValueError()
        return u.hostname, path
    except Exception:
        raise Stopped('URL_REJECTED') from None


def checked_redirect(base, location):
    """Validate only. Never follow automatically, including same-site redirects."""
    try:
        if not location:
            raise ValueError()
        target = urljoin(base, location)
        host, path = checked_url(target)
        return 'https://' + host + path
    except Exception:
        raise Stopped('REDIRECT_REJECTED') from None


class Verifier:
    def __init__(self, connection_factory=http.client.HTTPSConnection):
        self.connection_factory = connection_factory
        self.records = []
        self.bytes = 0
        self.halted = False

    def get(self, url):
        if self.halted:
            raise Stopped('RUN_HALTED')
        host, path = checked_url(url)
        if len(self.records) >= 4 or self.bytes >= 2_000_000:
            raise Stopped('BUDGET_EXHAUSTED')
        record = {'url': 'https://' + host + path, 'status': None,
                  'content_type': 'unknown', 'body_bytes': 0,
                  'fetched_at': datetime.now(timezone.utc).isoformat()}
        self.records.append(record)
        start = time.perf_counter()
        connection = None
        try:
            connection = self.connection_factory(host, timeout=15, context=ssl.create_default_context())
            connection.request('GET', path, headers=dict(HEADERS))
            response = connection.getresponse()
            record['status'] = response.status
            # Only allowlisted MIME labels are preserved, never arbitrary header values.
            mime = (response.getheader('Content-Type') or '').split(';')[0].strip().lower()
            if mime in ('text/html', 'text/plain', 'application/xhtml+xml'):
                record['content_type'] = mime
            # Set-Cookie values are not read, stored or retransmitted.
            if response.status in (301, 302, 303, 307, 308):
                record['redirect'] = checked_redirect(url, response.getheader('Location') or '')
                record['result'] = 'REDIRECT_NOT_FOLLOWED'
                return None
            if response.status != 200:
                raise Stopped('HTTP_ACCESS_STOP')
            if record['content_type'] == 'unknown':
                raise Stopped('CONTENT_TYPE_STOP')
            if (response.getheader('Content-Encoding') or 'identity').lower() != 'identity':
                raise Stopped('CONTENT_ENCODING_STOP')
            length = response.getheader('Content-Length')
            remaining = 2_000_000 - self.bytes
            if length is not None and (not length.isdecimal() or int(length) > remaining):
                raise Stopped('BODY_BUDGET_STOP')
            data = bytearray()
            while remaining:
                block = response.read(min(65536, remaining))
                if not block:
                    break
                data.extend(block)
                remaining -= len(block)
                self.bytes += len(block)
                record['body_bytes'] += len(block)
            if not remaining:
                # Fail closed at the cap; do not read an extra byte to prove EOF.
                raise Stopped('BODY_BUDGET_STOP')
            if length is not None and len(data) != int(length):
                raise Stopped('INCOMPLETE_BODY_STOP')
            lower = bytes(data).lower()
            if any(marker in lower for marker in
                   (b'captcha', b'cf-chl-', b'challenge-platform', b'type="password"',
                    b"type='password'", b'just a moment', b'access denied')):
                raise Stopped('ACCESS_CONTROL_STOP')
            record['sha256'] = hashlib.sha256(data).hexdigest()
            record['result'] = 'PUBLIC_RESPONSE_REQUIRES_REVIEW'
            return bytes(data)
        except Exception as error:
            self.halted = True
            code = str(error) if type(error) is Stopped else 'HTTPS_TRANSPORT_STOP'
            record['result'] = code
            raise Stopped(code) from None
        finally:
            record['seconds'] = round(time.perf_counter() - start, 3)
            if connection is not None:
                with contextlib.suppress(Exception):
                    connection.close()
