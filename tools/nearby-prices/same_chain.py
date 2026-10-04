"""NP2F offline qualification only. No network, persistence or product imports.

Inputs are strict NP1 observations. Conservative exact text/package equivalence;
no semantic repairs, substitutions, currency defaults or inferred coordinates.
"""
import math
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from offline import CHAIN, normalized_gtin

EARTH_RADIUS_M = 6_371_008.8  # Mean-radius spherical model, not route distance.


def positive(value):
    try:
        number = Decimal(value) if isinstance(value, str) else None
        return number if number is not None and number.is_finite() and number > 0 else None
    except (InvalidOperation, ValueError):
        return None


def store_pair(a, b):
    return (isinstance(a, tuple) and isinstance(b, tuple) and len(a) == len(b) == 3
            and a[0] == b[0] == CHAIN and a != b
            and all(isinstance(x, str) and x.isascii() and x.isdecimal() and x == str(int(x))
                    for x in (*a, *b)))


def gtin(row):
    valid = normalized_gtin(row.get('original_code'), row.get('item_type'))
    return valid if valid and valid == row.get('gtin14') else None


def index_gtins(rows):
    """Multiple observations for the same GTIN fail closed, never choose a winner."""
    index, ambiguous = {}, set()
    for row in rows:
        code = gtin(row)
        if not code:
            continue
        if code in index:
            ambiguous.add(code)
        else:
            index[code] = row
    return {k: v for k, v in index.items() if k not in ambiguous}, ambiguous


def package_equal(a, b):
    if a.get('weighted') != '0' or b.get('weighted') != '0':
        return False  # Variable-weight purchase quantities are outside this proof.
    x, y = a.get('package', {}), b.get('package', {})
    if not x.get('unit', '').strip() or x.get('unit') != y.get('unit'):
        return False
    for key in ('quantity', 'count'):
        left, right = positive(x.get(key)), positive(y.get(key))
        if left is None or right is None or left != right:
            return False
        if key == 'count' and left != left.to_integral_value():
            return False
    return True


def variant_equal(a, b):
    # Exact known labels/descriptions; conservative false negatives are acceptable.
    if not a.get('label', '').strip() or a.get('label') != b.get('label'):
        return False
    x, y = a.get('raw_fields', {}), b.get('raw_fields', {})
    for field in ('ManufactureItemDescription', 'ManufactureName'):
        if not (x.get(field) or '').strip() or x.get(field) != y.get(field):
            return False
    return x.get('ManufactureCountry') == y.get('ManufactureCountry')


def ordinary_price(row, kind):
    if kind not in ('Price', 'PriceFull') or row.get('operation') not in ('snapshot', 'add', 'update'):
        return None
    if row.get('conditional') or row.get('promotion') or row.get('effective_price') is not None:
        return None
    return positive(row.get('price'))


def matching(a, b, kind_a='PriceFull', kind_b='PriceFull'):
    if not gtin(a) or gtin(a) != gtin(b):
        return 'GTIN'
    if not package_equal(a, b):
        return 'PACKAGE_OR_WEIGHT'
    if not variant_equal(a, b):
        return 'VARIANT'
    if ordinary_price(a, kind_a) is None or ordinary_price(b, kind_b) is None:
        return 'NOT_ORDINARY_BASE_PRICE'
    return None


def coordinates(lat, lon):
    if any(isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v)
           for v in (lat, lon)) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ValueError('INVALID_COORDINATE')
    return (lat, lon)


def qualify_location(results, *, house, road, cities, verified_at):
    """One exact public-address match only; street centroids are never accepted."""
    if len(results) != 1:
        return None
    result = results[0]
    address = result.get('address', {})
    if (address.get('house_number') != house or address.get('road') != road
            or address.get('city') not in cities or address.get('country_code') != 'il'
            or result.get('type') not in ('house', 'supermarket', 'building')
            or not result.get('licence') or result.get('osm_type') not in ('node', 'way', 'relation')
            or not result.get('osm_id') or not verified_at):
        return None
    try:
        lat, lon = coordinates(float(result['lat']), float(result['lon']))
    except (ValueError, TypeError, KeyError):
        return None
    return {'point': [lat, lon], 'source': 'Nominatim/OpenStreetMap',
            'osm_type': result['osm_type'], 'osm_id': result['osm_id'],
            'address': address, 'licence': result['licence'], 'verified_at': verified_at,
            'accuracy': 'address point; not independently surveyed store entrance'}


def haversine(a, b):
    lat1, lon1 = coordinates(*a)
    lat2, lon2 = coordinates(*b)
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(min(1, max(0, h))))


def within_radius(distance_m, radius_m=5000):
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0
           for v in (distance_m, radius_m)):
        raise ValueError('INVALID_DISTANCE_OR_RADIUS')
    return distance_m <= radius_m


def fresh(publication, comparison):
    try:
        published, compared = datetime.fromisoformat(publication), datetime.fromisoformat(comparison)
        return (published.tzinfo is not None and compared.tzinfo is not None
                and timedelta(0) <= compared - published <= timedelta(hours=24))
    except (ValueError, TypeError):
        return False


def savings(a, b, currency_evidence):
    """Caller must supply attributed currency qualification, never a bare default."""
    if not currency_evidence or currency_evidence.get('currency') != 'ILS' or not all(
            currency_evidence.get(k) for k in ('source', 'scope', 'retrieved_at')):
        raise ValueError('UNRESOLVED_CURRENCY')
    x, y = positive(a), positive(b)
    if x is None or y is None:
        raise ValueError('INVALID_PRICE')
    return x - y  # Exact signed Decimal, no rounding/FX/synthetic conversion.


def historical_comparison(store_a, store_b, a, b, location_a, location_b, currency_evidence):
    if not store_pair(store_a, store_b):
        return {'eligible': False, 'reason': 'STORE_IDENTITY'}
    reason = matching(a, b)
    if reason:
        return {'eligible': False, 'reason': reason}
    try:
        amount = savings(a['price'], b['price'], currency_evidence)
    except ValueError:
        return {'eligible': False, 'reason': 'UNRESOLVED_CURRENCY'}
    if any(not loc or not all(loc.get(k) for k in ('source', 'osm_type', 'osm_id',
                                                  'address', 'licence', 'verified_at', 'accuracy'))
           for loc in (location_a, location_b)):
        return {'eligible': False, 'reason': 'UNVERIFIED_COORDINATE'}
    distance = haversine(location_a['point'], location_b['point'])
    if not within_radius(distance):
        return {'eligible': False, 'reason': 'OUTSIDE_RADIUS'}
    if amount <= 0:
        return {'eligible': False, 'reason': 'NO_LOWER_PRICE'}
    return {'eligible': True, 'historical_only': True, 'savings': format(amount, 'f'),
            'currency': 'ILS', 'distance_m': distance}
