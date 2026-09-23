"""NP2F synthetic fixtures. No source prices/coordinates in arithmetic examples."""
import copy
import math
import socket
import sys
import unittest
from dataclasses import replace
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/nearby-prices'))
import same_chain as c
import offline as o
from test_np1 import normalized, batch_source, STORES, item


def row():
    value = normalized().rows[0]
    value['raw_fields'].update(ManufactureName='SYNTHETIC', ManufactureItemDescription='SYNTHETIC regular 100g')
    return value


def result():
    return {'lat': '0', 'lon': '0', 'type': 'house', 'osm_type': 'node', 'osm_id': 1,
            'licence': 'SYNTHETIC TEST ONLY',
            'address': {'house_number': '1', 'road': 'SYNTHETIC', 'city': 'SYNTHETIC', 'country_code': 'il'}}


def location(results=None):
    return c.qualify_location([result()] if results is None else results,
        house='1', road='SYNTHETIC', cities={'SYNTHETIC'}, verified_at='2026-09-23T00:00:00+00:00')


CURRENCY = {'currency': 'ILS', 'source': 'SYNTHETIC TEST ONLY',
            'scope': 'SYNTHETIC price fixture', 'retrieved_at': '2026-09-23T00:00:00+00:00'}


class NP2F(unittest.TestCase):
    def setUp(self):
        self.guards = [patch.object(socket.socket, 'connect', side_effect=AssertionError('OFFLINE_ONLY')),
                       patch.object(socket, 'create_connection', side_effect=AssertionError('OFFLINE_ONLY'))]
        self.mocks = [g.start() for g in self.guards]

    def tearDown(self):
        for mock, guard in zip(self.mocks, self.guards):
            try: mock.assert_not_called()
            finally: guard.stop()

    def test_same_chain_store_identity(self):
        a, b = (o.CHAIN, '1', '1'), (o.CHAIN, '1', '2')
        self.assertTrue(c.store_pair(a, b))
        for bad in [a, ('other', '1', '2'), (o.CHAIN, '1', '01'), (o.CHAIN, '1', '')]:
            self.assertFalse(c.store_pair(a, bad))

    def test_exact_gtin_leading_zero_and_invalid(self):
        a = row(); b = copy.deepcopy(a)
        self.assertEqual(c.gtin(a), '04006381333931')
        b['original_code'] = '04006381333931'
        self.assertIsNone(c.matching(a, b))
        for code in ['4006381333932', '４００６３８１３３３９３１', '123']:
            b['original_code'] = code
            self.assertIsNone(c.gtin(b))

    def test_internal_identity_never_joins(self):
        a = row(); b = copy.deepcopy(a); a['item_type'] = b['item_type'] = '0'
        self.assertEqual(c.matching(a, b), 'GTIN')

    def test_ambiguous_gtin_is_excluded(self):
        a = row()
        index, bad = c.index_gtins([a, copy.deepcopy(a)])
        self.assertFalse(index); self.assertEqual(bad, {a['gtin14']})

    def test_package_mismatches_and_unknowns(self):
        a = row()
        for key, val in [('quantity', '101'), ('unit', 'ml'), ('count', '2'),
                         ('count', None), ('quantity', '0'), ('count', '1.5')]:
            b = copy.deepcopy(a); b['package'][key] = val
            self.assertEqual(c.matching(a, b), 'PACKAGE_OR_WEIGHT')

    def test_variant_regular_zero_and_missing(self):
        a = row()
        for changes in [{'label': 'SYNTHETIC zero'}, {'raw_fields': {}},
                        {'raw_fields': {**a['raw_fields'], 'ManufactureItemDescription': 'SYNTHETIC zero'}}]:
            b = {**a, **changes}
            self.assertEqual(c.matching(a, b), 'VARIANT')

    def test_weighted_uncertainty_and_variable_weight(self):
        a = row()
        for flag in ['', None, '1', 'unknown']:
            b = copy.deepcopy(a); b['weighted'] = flag
            self.assertFalse(c.package_equal(a, b))

    def test_conditional_promotions_excluded(self):
        a = row()
        for kind in ['Promo', 'PromoFull']:
            self.assertIsNone(c.ordinary_price(a, kind))
        for field in ['conditional', 'promotion', 'effective_price']:
            self.assertIsNone(c.ordinary_price({**a, field: 'SYNTHETIC'}, 'PriceFull'))
        self.assertIsNone(c.ordinary_price({**a, 'operation': 'remove'}, 'Price'))

    def test_exact_decimal_savings_and_currency(self):
        self.assertEqual(c.savings('10.10', '9.80', CURRENCY), Decimal('0.30'))
        for evidence in [None, {}, {**CURRENCY, 'source': ''}, {**CURRENCY, 'currency': 'USD'}]:
            with self.assertRaisesRegex(ValueError, 'UNRESOLVED_CURRENCY'):
                c.savings('10.10', '9.80', evidence)

    def test_ambiguous_wrong_and_unverified_address(self):
        self.assertIsNotNone(location())
        self.assertIsNone(location([result(), result()]))
        self.assertIsNone(location([]))
        bad = result(); bad['address']['house_number'] = '2'
        self.assertIsNone(location([bad]))
        bad = result(); bad['type'] = 'tertiary'
        self.assertIsNone(location([bad]))

    def test_invalid_coordinates(self):
        for point in [(91, 0), (0, 181), (math.nan, 0), (0, math.inf), (True, 0), ('0', 0)]:
            with self.assertRaisesRegex(ValueError, 'INVALID_COORDINATE'):
                c.haversine(point, (0, 0))
        bad = result(); bad['lat'] = 'NaN'
        self.assertIsNone(location([bad]))

    def test_zero_known_distance_and_symmetry(self):
        self.assertEqual(c.haversine((0, 0), (0, 0)), 0)
        self.assertAlmostEqual(c.haversine((0, 0), (0, 1)), 111195.0802335329, places=6)
        self.assertEqual(c.haversine((10, 20), (11, 21)), c.haversine((11, 21), (10, 20)))

    def test_radius_boundary(self):
        self.assertTrue(c.within_radius(5000))
        self.assertFalse(c.within_radius(math.nextafter(5000, math.inf)))
        self.assertTrue(c.within_radius(math.nextafter(5000, 0)))
        for value in [-1, math.inf, math.nan]:
            with self.assertRaises(ValueError): c.within_radius(value)

    def test_stale_replay_not_current_and_idempotent(self):
        raw, source = batch_source()
        b = o.normalize(raw, source, STORES)
        later = o.normalize(raw, replace(source, ingested_at='2026-10-01T00:00:00+00:00',
                           fetched_at='2026-10-01T00:00:00+00:00'), STORES)
        p = o.Projection(); p.apply(b); before = copy.deepcopy(p.__dict__)
        self.assertEqual(p.apply(later), 'duplicate')
        self.assertEqual(p.__dict__, before)
        self.assertFalse(c.fresh(later.published_at, '2026-10-01T00:00:00+00:00'))
        self.assertTrue(c.fresh('2026-09-21T00:00:00+00:00', '2026-09-22T00:00:00+00:00'))
        self.assertFalse(c.fresh('2026-09-23T00:00:00+00:00', '2026-09-22T00:00:00+00:00'))

    def test_historical_only_and_fail_closed_end_to_end(self):
        a, b = row(), row(); b['price'] = '9.80'; a['price'] = '10.10'
        args = ((o.CHAIN, '1', '1'), (o.CHAIN, '1', '2'), a, b)
        self.assertEqual(c.historical_comparison(*args, location(), location(), None)['reason'], 'UNRESOLVED_CURRENCY')
        self.assertEqual(c.historical_comparison(*args, location(), None, CURRENCY)['reason'], 'UNVERIFIED_COORDINATE')
        good = c.historical_comparison(*args, location(), location(), CURRENCY)
        self.assertTrue(good['historical_only']); self.assertEqual(good['savings'], '0.30')
        distant = location(); distant['point'] = [0, 1]
        self.assertEqual(c.historical_comparison(*args, location(), distant, CURRENCY)['reason'], 'OUTSIDE_RADIUS')


if __name__ == '__main__':
    unittest.main()
