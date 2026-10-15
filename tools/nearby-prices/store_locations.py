"""Address-point locations for catalog stores, from OpenStreetMap Nominatim.

Follows the Nominatim usage policy: at most one request per second, an
identifying User-Agent, results cached on disk so each address is asked once.
A location is accepted only when the result has the store's house number and
lies inside the Tel Aviv area; otherwise the store stays unlocated rather than
being placed at a street centre. Data © OpenStreetMap contributors, ODbL 1.0.

    python tools/nearby-prices/store_locations.py   # updates data/catalog/tel-aviv.json in place
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'artifacts' / 'nearby-prices-catalog' / 'nominatim-cache.json'
CATALOG = ROOT / 'data' / 'catalog' / 'tel-aviv.json'
USER_AGENT = 'Spendscape-college-demo/1.0 (student project; one-time geocoding of public store addresses)'
SEARCH = 'https://nominatim.openstreetmap.org/search?'
BOUNDS = (32.02, 32.16, 34.73, 34.86)  # south, north, west, east around Tel Aviv-Yafo
ATTRIBUTION = 'Store locations: address points from OpenStreetMap Nominatim, © OpenStreetMap contributors, ODbL 1.0'


# Spelling in the source store files that differs from OpenStreetMap street names.
STREET_ALIASES = {'ארלוזרוב': 'ארלוזורוב', 'דיזינגוף': 'דיזנגוף', 'יהודה מכבי': 'יהודה המכבי', 'אהרוןבקר': 'אהרון בקר', 'חשמונאים': 'החשמונאים', 'וייצמן': 'ויצמן'}


def split_address(address):
    """"רח' בן יהודה 79" -> ('בן יהודה', '79'); trailing text after the number is ignored."""
    text = address.replace('״', '"').strip()
    text = re.sub(r"^(?:רח(?:וב|')?|שד(?:רות|')?)\s*", '', text)
    text = re.sub(r"(?<=[א-ת\"'])(?=\d)", ' ', text).replace(',', ' ')
    match = re.match(r'\s*(\d{1,4})[א-ת]?\s+([^\d]+?)\s*$', text) or re.match(r'\s*([^\d]+?)\s+(\d{1,4})(?!\d)', text)
    if not match:
        return None
    first, second = match.group(1).strip(), match.group(2).strip()
    street, number = (second, first) if first.isdigit() else (first, second)
    street = re.sub(r'\s+', ' ', street).strip(' -')
    return STREET_ALIASES.get(street, street), number


def accept(results, number):
    south, north, west, east = BOUNDS
    for result in results:
        lat, lon = float(result['lat']), float(result['lon'])
        house = re.sub(r'\D', '', result.get('address', {}).get('house_number', ''))
        if house == number and south <= lat <= north and west <= lon <= east:
            return {'lat': round(lat, 6), 'lon': round(lon, 6), 'osm': f"{result['osm_type']}/{result['osm_id']}", 'accuracy': 'address point'}
    return None


def search(params):
    query = urllib.parse.urlencode({**params, 'format': 'jsonv2', 'addressdetails': 1, 'limit': 3})
    request = urllib.request.Request(SEARCH + query, headers={'User-Agent': USER_AGENT, 'Accept-Language': 'he'})
    with urllib.request.urlopen(request, timeout=30) as response:
        results = json.load(response)
    time.sleep(1.1)
    return results


def locate(stores, log=print):
    cache = json.loads(CACHE.read_text(encoding='utf-8')) if CACHE.exists() else {}
    asked = 0
    for store in stores:
        parts = split_address(store['address'])
        if not parts:
            store['location'] = None
            continue
        street, number = parts
        key = f'{street}|{number}'
        if key not in cache:
            cache[key] = search({'street': f'{number} {street}', 'city': 'תל אביב-יפו', 'country': 'ישראל'})
            asked += 1
        location = accept(cache[key], number)
        if not location:
            fallback = f'q|{street} {number}, תל אביב'
            if fallback not in cache:
                cache[fallback] = search({'q': f'{street} {number}, תל אביב-יפו'})
                asked += 1
            location = accept(cache[fallback], number)
        store['location'] = location
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding='utf-8')
    located = sum(1 for store in stores if store.get('location'))
    log(f'locations: {located}/{len(stores)} stores located, {asked} new Nominatim requests')
    return stores


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    locate(catalog['stores'])
    catalog['locationSource'] = ATTRIBUTION
    for store in catalog['stores']:
        print(store['id'], store['name'], '|', store['address'], '->', store['location'] and (store['location']['lat'], store['location']['lon']))
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
