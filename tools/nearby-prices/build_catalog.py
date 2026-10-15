"""Build the Tel Aviv published-price catalog used by the barcode scanner.

Downloads the store list and the latest full price file of every physical
Tel Aviv store for Shufersal (public HTTPS listing) and for Rami Levy and Osher
Ad (public FTPS guest user names published for price transparency; empty
password, approved by the project owner on 2026-10-02). Standard library only.

Only external barcodes with a valid GTIN checksum are kept. Prices are the
published ordinary shelf prices in ILS; promotions and club prices are not
applied. Raw downloads are cached under artifacts/ (ignored by Git).

    python tools/nearby-prices/build_catalog.py
"""
import ftplib
import gzip
import html
import json
import re
import ssl
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'artifacts' / 'nearby-prices-catalog' / 'raw'
OUT = ROOT / 'data' / 'catalog' / 'tel-aviv.json'
CITY_CODE = '5000'  # Tel Aviv-Yafo in the source files' numeric city field.
USER_AGENT = 'Spendscape-college-demo/1.0 (student project; Israeli price transparency files)'
SHUFERSAL = 'https://prices.shufersal.co.il/FileObject/UpdateCategory?catID={cat}&storeId={store}'
FTP_HOST = 'url.retail.publishedprices.co.il'
CHAINS = {
    'shufersal': {'name': {'en': 'Shufersal', 'he': 'שופרסל'}, 'id': '7290027600007'},
    'ramilevi': {'name': {'en': 'Rami Levy', 'he': 'רמי לוי'}, 'id': '7290058140886', 'user': 'RamiLevi'},
    'osherad': {'name': {'en': 'Osher Ad', 'he': 'אושר עד'}, 'id': '7290103152017', 'user': 'osherad'},
}


def log(message):
    print(message, file=sys.stderr, flush=True)


def gtin14(code):
    """Valid GTIN-8/12/13/14 padded to 14 digits, else None."""
    if not re.fullmatch(r'\d{8}|\d{12,14}', code or ''):
        return None
    total = sum(int(d) * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(code[:-1])))
    return code.zfill(14) if (10 - total % 10) % 10 == int(code[-1]) else None


def parse_xml(raw):
    if raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    for encoding in ('utf-8-sig', 'utf-16', 'cp1255'):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeError:
            continue
    else:
        raise ValueError('undecodable XML')
    text = text[text.index('<'):]
    if text.startswith('<?xml'):
        text = text[text.index('?>') + 2:]
    if re.search(r'<!\s*(?:DOCTYPE|ENTITY)', text, re.I):
        raise ValueError('XML declarations are not accepted')
    return ET.fromstring(text)


def fields(element):
    return {child.tag.lower(): (child.text or '').strip() for child in element}


def http_get(url):
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


class Ftp:
    """One FTPS session per chain; the server's PASV address differs from the control host."""
    def __init__(self, user):
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE  # The published server certificate does not match its host name.
        self.ftp = ftplib.FTP_TLS(FTP_HOST, timeout=60, context=context)
        self.ftp.trust_server_pasv_ipv4_address = True
        self.ftp.login(user, '')
        self.ftp.prot_p()

    def names(self):
        return self.ftp.nlst()

    def read(self, name):
        chunks = []
        self.ftp.retrbinary(f'RETR {name}', chunks.append)
        return b''.join(chunks)

    def close(self):
        try:
            self.ftp.quit()
        except ftplib.all_errors:
            self.ftp.close()


def cached(name, fetch):
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / name
    if path.exists():
        return path.read_bytes()
    data = fetch()
    path.write_bytes(data)
    time.sleep(0.4)
    return data


def tel_aviv_stores(root):
    stores = []
    for element in root.iter():
        if element.tag.lower() != 'store':
            continue
        f = fields(element)
        if f.get('city', '').lstrip('0') == CITY_CODE and f.get('storetype', '1') == '1':
            stores.append({'storeId': str(int(f['storeid'])), 'name': f.get('storename', ''), 'address': f.get('address', '')})
    return stores


def shufersal_links(cat, store):
    page = http_get(SHUFERSAL.format(cat=cat, store=store)).decode('utf-8', 'replace')
    return [html.unescape(link) for link in re.findall(r'href="(https://pricesprodpublic[^"]+)"', page)]


def price_stamp(name):
    """Publication stamp YYYYMMDDHHMM[SS] from a price file name."""
    parts = name.split('.')[0].split('-')[1:]
    return ''.join(parts[-2:]) if len(parts) >= 3 and len(parts[-2]) == 8 else parts[-1]


def store_from_name(name):
    parts = name.split('.')[0].split('-')[1:]
    return str(int(parts[-3] if len(parts) >= 3 and len(parts[-2]) == 8 else parts[-2]))


def collect():
    """Yields (chain key, store dict, price file name, raw bytes)."""
    links = shufersal_links(5, 0)
    stores = tel_aviv_stores(parse_xml(cached(links[0].split('?')[0].rsplit('/', 1)[-1], lambda: http_get(links[0]))))
    log(f'shufersal: {len(stores)} Tel Aviv stores')
    for store in stores:
        price_links = [link for link in shufersal_links(2, store['storeId']) if '/pricefull/' in link.lower()]
        if not price_links:
            log(f'  no PriceFull for store {store["storeId"]}')
            continue
        link = max(price_links, key=lambda value: price_stamp(value.split('?')[0].rsplit('/', 1)[-1]))
        name = link.split('?')[0].rsplit('/', 1)[-1]
        yield 'shufersal', store, name, cached(name, lambda: http_get(link))
    for key in ('ramilevi', 'osherad'):
        chain = CHAINS[key]
        ftp = Ftp(chain['user'])
        try:
            names = ftp.names()
            store_file = max((n for n in names if n.startswith('Stores')), key=price_stamp)
            stores = tel_aviv_stores(parse_xml(cached(store_file, lambda: ftp.read(store_file))))
            log(f'{key}: {len(stores)} Tel Aviv stores')
            latest = {}
            for name in names:
                if name.startswith(f'PriceFull{chain["id"]}-') and name.endswith('.gz'):
                    store = store_from_name(name)
                    if store not in latest or price_stamp(name) > price_stamp(latest[store]):
                        latest[store] = name
            for store in stores:
                name = latest.get(store['storeId'])
                if not name:
                    log(f'  no PriceFull for store {store["storeId"]}')
                    continue
                yield key, store, name, cached(name, lambda: ftp.read(name))
        finally:
            ftp.close()


def published_local(name):
    """Israel local publication time from the file name; no offset is assumed."""
    stamp = price_stamp(name).ljust(14, '0')[:14]
    return datetime.strptime(stamp, '%Y%m%d%H%M%S').strftime('%Y-%m-%d %H:%M')


def build():
    stores, products = [], {}
    for chain_key, store, file_name, raw in collect():
        root = parse_xml(raw)
        index = len(stores)
        stores.append({'id': f'{chain_key}-{store["storeId"]}', 'chain': chain_key, 'chainName': CHAINS[chain_key]['name'],
                       'storeId': store['storeId'], 'name': store['name'], 'address': store['address'],
                       'file': file_name, 'publishedLocal': published_local(file_name)})
        kept = 0
        for element in root.iter():
            if element.tag.lower() != 'item':
                continue
            f = fields(element)
            if f.get('itemtype', '1') != '1':
                continue  # Internal retailer codes are not product identities.
            code = gtin14(f.get('itemcode', ''))
            try:
                price = round(float(f.get('itemprice', '')), 2)
            except ValueError:
                continue
            if not code or price <= 0:
                continue
            product = products.setdefault(code, {'n': f.get('itemname') or f.get('itemnm') or '', 'm': f.get('manufacturername', ''),
                                                 'q': ' '.join(v for v in (f.get('quantity', ''), f.get('unitqty', '')) if v and v != '0'),
                                                 'w': 1 if f.get('bisweighted') == '1' else 0, 'p': []})
            if not any(entry[0] == index for entry in product['p']):
                product['p'].append([index, price])
                kept += 1
        log(f'  {chain_key} {store["storeId"]} {store["name"]}: {kept} priced barcodes')
    for product in products.values():
        product['p'].sort(key=lambda entry: (entry[1], entry[0]))
    return {'version': 1, 'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
            'area': {'en': 'Tel Aviv-Yafo', 'he': 'תל אביב-יפו'}, 'currency': 'ILS',
            'priceBasis': 'Published ordinary shelf price; promotions and club prices are not applied.',
            'source': 'Israeli food price transparency files published by each chain.',
            'stores': stores, 'products': dict(sorted(products.items()))}


if __name__ == '__main__':
    from store_locations import ATTRIBUTION, locate
    catalog = build()
    locate(catalog['stores'], log=log)
    catalog['locationSource'] = ATTRIBUTION
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    log(f'wrote {OUT.relative_to(ROOT)}: {len(catalog["stores"])} stores, {len(catalog["products"])} products, {OUT.stat().st_size / 1e6:.1f} MB')
