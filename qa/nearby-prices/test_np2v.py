"""Synthetic offline Stage 1 collector tests; no retailer data or sockets."""
import io
import json
import socket
import unittest
from unittest.mock import patch
from verify_np2v import Verifier, Stopped, checked_url, checked_redirect, HEADERS


class Response:
    def __init__(self, status=200, body=b'SYNTHETIC PUBLIC PAGE', **headers):
        self.status = status
        self.headers = {'Content-Type': 'text/html', **headers}
        self.body = io.BytesIO(body)
    def getheader(self, name):
        return self.headers.get(name)
    def read(self, size):
        return self.body.read(size)


class CollectorTests(unittest.TestCase):
    def setUp(self):
        self.network = patch.object(socket.socket, 'connect', side_effect=AssertionError('NETWORK_FORBIDDEN'))
        self.connect = self.network.start()
        self.addCleanup(self.network.stop)
        self.calls = []

    def client(self, response=None, error=False):
        calls = self.calls
        class Connection:
            def __init__(self, *args, **kwargs):
                pass
            def request(self, method, path, headers):
                calls.append((method, path, headers))
                if error:
                    raise OSError('SYNTHETIC_SECRET_MUST_NOT_ESCAPE')
            def getresponse(self):
                return response or Response()
            def close(self):
                pass
        return Verifier(Connection)

    def tearDown(self):
        self.connect.assert_not_called()

    def test_no_cookie_auth_or_variable_user_agent(self):
        v = self.client(Response(**{'Set-Cookie': 'SYNTHETIC_COOKIE'}))
        v.get('https://www.carrefour.co.il/')
        v.get('https://prices.carrefour.co.il/')
        self.assertTrue(all(c[2] == HEADERS for c in self.calls))
        self.assertNotIn('SYNTHETIC_COOKIE', json.dumps(v.records))

    def test_reject_unsafe_urls_before_request(self):
        for url in ['http://prices.carrefour.co.il/', 'https://other.invalid/',
                    'https://u:p@prices.carrefour.co.il/', 'https://prices.carrefour.co.il/?token=x',
                    'https://prices.carrefour.co.il/a.gz', 'https://prices.carrefour.co.il/%61.gz',
                    'https://prices.carrefour.co.il:444/']:
            with self.subTest(url=url), self.assertRaisesRegex(Stopped, '^URL_REJECTED$'):
                checked_url(url)

    def test_redirect_checked_never_followed(self):
        v = self.client(Response(302, **{'Location': '/public'}))
        self.assertIsNone(v.get('https://prices.carrefour.co.il/'))
        self.assertEqual(len(self.calls), 1)
        for target in ['', 'https://other.invalid/', 'http://prices.carrefour.co.il/', '/?token=x']:
            with self.assertRaisesRegex(Stopped, '^REDIRECT_REJECTED$'):
                checked_redirect('https://prices.carrefour.co.il/', target)

    def test_error_body_not_read_and_run_halted(self):
        response = Response(403, b'SYNTHETIC_PRIVATE_ERROR_BODY')
        v = self.client(response)
        with self.assertRaisesRegex(Stopped, '^HTTP_ACCESS_STOP$'):
            v.get('https://prices.carrefour.co.il/')
        self.assertEqual(response.body.tell(), 0)
        self.assertNotIn('PRIVATE', json.dumps(v.records))
        with self.assertRaisesRegex(Stopped, '^RUN_HALTED$'):
            v.get('https://prices.carrefour.co.il/')

    def test_transport_exception_redacted(self):
        v = self.client(error=True)
        with self.assertRaisesRegex(Stopped, '^HTTPS_TRANSPORT_STOP$'):
            v.get('https://prices.carrefour.co.il/')
        self.assertNotIn('SECRET', json.dumps(v.records))

    def test_request_budget(self):
        v = self.client()
        for _ in range(4):
            v.get('https://prices.carrefour.co.il/')
        with self.assertRaisesRegex(Stopped, '^BUDGET_EXHAUSTED$'):
            v.get('https://prices.carrefour.co.il/')
        self.assertEqual(len(self.calls), 4)

    def test_aggregate_byte_budget(self):
        v = self.client(Response(body=b'x' * 2_000_001))
        with self.assertRaisesRegex(Stopped, '^BODY_BUDGET_STOP$'):
            v.get('https://prices.carrefour.co.il/')
        self.assertEqual(v.bytes, 2_000_000)

    def test_byte_budget_carries_across_requests(self):
        response = Response(body=b'x' * 1_100_000)
        v = self.client(response)
        v.get('https://www.carrefour.co.il/')
        response.body = io.BytesIO(b'x' * 1_100_000)
        with self.assertRaisesRegex(Stopped, '^BODY_BUDGET_STOP$'):
            v.get('https://prices.carrefour.co.il/')
        self.assertEqual([r['body_bytes'] for r in v.records], [1_100_000, 900_000])
        self.assertEqual(v.bytes, 2_000_000)

    def test_length_and_encoding_rejected_without_read(self):
        for header in [{'Content-Length': '2000001'}, {'Content-Encoding': 'gzip'}]:
            r = Response(**header)
            v = self.client(r)
            with self.assertRaises(Stopped):
                v.get('https://prices.carrefour.co.il/')
            self.assertEqual(r.body.tell(), 0)

    def test_access_challenge_not_returned(self):
        v = self.client(Response(body=b'SYNTHETIC captcha'))
        with self.assertRaisesRegex(Stopped, '^ACCESS_CONTROL_STOP$'):
            v.get('https://prices.carrefour.co.il/')
        self.assertNotIn('captcha', json.dumps(v.records))


if __name__ == '__main__':
    unittest.main()
