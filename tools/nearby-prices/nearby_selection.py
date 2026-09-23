"""NP2G offline store selection over the retained, hash-verified Stores directory.

No network or product integration. Do not infer locality from numeric city codes.
"""
import re
from collections import Counter

from offline import CHAIN, Rejected, source_id, strict_root, text
from same_chain import haversine, within_radius

LOCALITY = re.compile(r'תל[ ־-]אביב|ת"א')
EXCLUDED = re.compile(r'אונליין|אינטרנט|online|מחסן|מרלו|משרדים|הנהלה', re.I)
# Bounded single-address grammar, not a general address parser. Numeric street
# names, separators between addresses and house ranges remain unresolved.
ADDRESS = re.compile(r"([A-Za-zא-ת][A-Za-zא-ת '\"״׳.־-]*?)[ ]*([0-9]+[א-ת]?)")


def shortlist(raw):
    root = strict_root(raw)
    if text(root, 'chainid', True) != CHAIN:
        raise Rejected('UNAPPROVED_CHAIN')
    records = []
    for node in root.findall('.//Store'):
        key = (CHAIN, source_id(text(node.getparent().getparent(), 'subchainid', True)),
               source_id(text(node, 'storeid', True)))
        records.append((key, node))
    # Count every source record before eligibility can hide a conflicting row.
    counts = Counter(key for key, _ in records)
    candidates = []
    for key, node in records:
        if counts[key] != 1:
            continue
        name, address = text(node, 'storename'), text(node, 'address')
        # Same supermarket format as the reference is a conservative shortlist
        # preference. No BE pharmacies or unknown physical classification.
        if (key == (CHAIN, '1', '1') or key[1] != '1'
                or text(node, 'storetype') != '1' or not LOCALITY.search(name)
                or EXCLUDED.search(name + ' ' + address)):
            continue
        match = ADDRESS.fullmatch(address.strip())
        if not match or not match[1].strip():
            continue  # Partial/multi-address records are not repaired.
        candidates.append({'key': list(key), 'name': name, 'address': address,
                           'road': match[1].strip(), 'house': match[2],
                           'locality_evidence': name, 'store_type': '1'})
    return sorted(candidates, key=lambda c: (int(c['key'][1]), int(c['key'][2])))[:3]


def select(reference, candidates):
    """Qualified address results only; choose minimum distance, then numeric ID."""
    qualifying = []
    for store, location in candidates:
        if location is None:
            continue
        distance = haversine(reference['point'], location['point'])
        if distance > 0 and within_radius(distance):
            qualifying.append({'store': store, 'location': location, 'distance_m': distance})
    return min(qualifying, key=lambda c: (c['distance_m'], tuple(map(int, c['store']['key']))), default=None)
