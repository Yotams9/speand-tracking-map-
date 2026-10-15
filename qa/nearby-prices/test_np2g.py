"""NP2G synthetic selection tests only; no current price-pair qualification."""
import copy
import gzip
import math
import socket
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/nearby-prices'))
from offline import CHAIN, Rejected
from nearby_selection import shortlist, select
from same_chain import qualify_location


def store(number, name='SYNTHETIC ת"א', address='SYNTHETIC 1', kind='1'):
    return f'<Store><StoreId>{number}</StoreId><StoreType>{kind}</StoreType><StoreName>{name}</StoreName><Address>{address}</Address><City>5000</City></Store>'


def directory(rows, chain=CHAIN):
    return gzip.compress(f'<Root><ChainId>{chain}</ChainId><SubChains><SubChain><SubChainId>1</SubChainId><Stores>{rows}</Stores></SubChain></SubChains></Root>'.encode())


def candidate(number):
    return {'key': [CHAIN, '1', str(number)], 'name': 'SYNTHETIC'}


class NP2GSelection(unittest.TestCase):
    def setUp(self):
        self.stack = __import__('contextlib').ExitStack()
        self.addCleanup(self.stack.close)
        self.guards = [self.stack.enter_context(patch.object(socket.socket, 'connect', side_effect=AssertionError('OFFLINE_ONLY'))),
                       self.stack.enter_context(patch.object(socket, 'create_connection', side_effect=AssertionError('OFFLINE_ONLY')))]

    def tearDown(self):
        for guard in self.guards:
            guard.assert_not_called()

    def test_deterministic_shortlist_and_limit(self):
        rows = [store(n) for n in (39, 7, 117, 11, 1)]
        a = shortlist(directory(''.join(rows)))
        self.assertEqual(a, shortlist(directory(''.join(reversed(rows)))))
        self.assertEqual([s['key'][2] for s in a], ['7', '11', '39'])

    def test_physical_online_unresolved_locality(self):
        rows = store(7) + store(8, kind='2') + store(9, kind='') + store(10, name='SYNTHETIC')
        rows += store(12, name='SYNTHETIC ת"א מחסן') + store(13, name='SYNTHETIC ת"א אונליין')
        self.assertEqual([s['key'][2] for s in shortlist(directory(rows))], ['7'])

    def test_partial_address_and_duplicate_identity_excluded(self):
        rows = store(7, address='SYNTHETIC 1, PARTIAL') + store(8, address='')
        rows += store(9) + store('009') + store(11, address='SYNTHETIC157')
        selected = shortlist(directory(rows))
        self.assertEqual([s['key'][2] for s in selected], ['11'])
        self.assertEqual(selected[0]['house'], '157')
        self.assertEqual(selected[0]['road'], 'SYNTHETIC')

    def test_source_identity_and_strict_corrupt_directory(self):
        with self.assertRaises(Rejected): shortlist(directory(store(7), 'OTHER'))
        with self.assertRaises(Rejected): shortlist(b'CORRUPT')
        with self.assertRaises(Rejected): shortlist(directory(store('invalid')))

    def test_duplicate_identity_before_eligibility_filtering(self):
        for rejected in (store('007', kind='2'), store('007', address=''),
                         store('007', name='SYNTHETIC'),
                         store('007', name='SYNTHETIC ת"א מחסן')):
            for rows in (store(7) + rejected, rejected + store(7)):
                with self.subTest(rows=rows):
                    selected = shortlist(directory(rows + store(11)))
                    self.assertEqual([s['key'][2] for s in selected], ['11'])

    def test_multi_address_and_house_ranges_remain_unresolved(self):
        for address in ('SYNTHETIC 1, OTHER 2', 'SYNTHETIC 1 OTHER 2',
                        'SYNTHETIC, OTHER 2', 'SYNTHETIC 1/2',
                        'SYNTHETIC 1-2', 'SYNTHETIC 1–2',
                        'SYNTHETIC 1; OTHER 2', 'SYNTHETIC 1 &amp; OTHER 2',
                        'רחוב 1, אחר 2', 'רחוב 1־2', 'רחוב 1 עד 2'):
            with self.subTest(address=address):
                self.assertEqual(shortlist(directory(store(7, address=address))), [])

    def test_single_address_preserves_source_text(self):
        for address, road, house in (('אבן גבירול157', 'אבן גבירול', '157'),
                                     ('SYNTHETIC 12א', 'SYNTHETIC', '12א'),
                                     ('צה"ל 71', 'צה"ל', '71'),
                                     ('בן-יהודה 79', 'בן-יהודה', '79')):
            with self.subTest(address=address):
                selected, = shortlist(directory(store(7, address=address)))
                self.assertEqual((selected['address'], selected['road'], selected['house']),
                                 (address, road, house))

    def test_ambiguous_address_never_selected(self):
        value = {'lat': '0', 'lon': '0', 'type': 'house', 'osm_type': 'node', 'osm_id': 1,
                 'licence': 'SYNTHETIC', 'address': {'house_number': '1', 'road': 'SYNTHETIC', 'city': 'SYNTHETIC', 'country_code': 'il'}}
        loc = qualify_location([value, copy.deepcopy(value)], house='1', road='SYNTHETIC', cities={'SYNTHETIC'}, verified_at='SYNTHETIC')
        self.assertIsNone(select({'point': [0, 0]}, [(candidate(7), loc)]))

    def test_nearest_qualified_not_first(self):
        reference = {'point': [0, 0]}
        candidates = [(candidate(7), {'point': [0, .02]}), (candidate(11), {'point': [0, .01]})]
        self.assertEqual(select(reference, candidates)['store']['key'][2], '11')
        self.assertEqual(select(reference, candidates), select(reference, list(reversed(candidates))))

    def test_numeric_identity_tiebreak(self):
        selected = select({'point': [0, 0]}, [(candidate(11), {'point': [0, .01]}), (candidate(7), {'point': [0, .01]})])
        self.assertEqual(selected['store']['key'][2], '7')

    def test_zero_outside_and_inclusive_exact_radius(self):
        reference = {'point': [0, 0]}
        self.assertIsNone(select(reference, [(candidate(7), {'point': [0, 0]})]))
        self.assertIsNone(select(reference, [(candidate(7), {'point': [0, 1]})]))
        # Isolate comparison at the exact metric boundary; Haversine's
        # independent deterministic numeric fixture is covered by NP2F.
        for distance, expected in [(5000, True), (math.nextafter(5000, math.inf), False), (0, False)]:
            with patch('nearby_selection.haversine', return_value=distance):
                self.assertEqual(select(reference, [(candidate(7), {'point': [0, .01]})]) is not None, expected)


if __name__ == '__main__':
    unittest.main()
