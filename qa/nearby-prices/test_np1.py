"""Synthetic non-personal fixtures, generated in memory; no live prices."""
import copy
import gzip
import hashlib
import sys
import unittest
import json
import contextlib
import io
import socket
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/nearby-prices'))
import offline as o

STORES = frozenset({(o.CHAIN, '1', '1')})


def item(code='4006381333931', price='10.00', status='', **changes):
    data = dict(ItemCode=code, ItemType='1', ItemPrice=price, ItemStatus=status,
                ItemName='SYNTHETIC benchmark item', Quantity='100', UnitQty='גרם',
                QtyInPackage='1', bIsWeighted='0', PriceUpdateTime='2026-09-20T10:00:00')
    data.update(changes)
    return '<Item>'+''.join(f'<{k}>{v}</{k}>' for k,v in data.items())+'</Item>'


def batch_source(body=None, kind='PriceFull', day='21', hour='030000'):
    body = item() if body is None else body
    xml = f'<Root><ChainId>{o.CHAIN}</ChainId><SubChainId>001</SubChainId><StoreId>001</StoreId><Items>{body}</Items></Root>'
    raw = gzip.compress(xml.encode(), mtime=0)
    name = f'{kind}{o.CHAIN}-001-001-202609{day}-{hour}.gz'
    source = o.Source(name, 'https://pricesprodpublic.blob.core.windows.net/price/'+name,
                      hashlib.sha256(raw).hexdigest(), '2026-09-22T12:00:00+00:00')
    return raw, source


def normalized(**kwargs):
    raw, source = batch_source(**kwargs)
    return o.normalize(raw, source, STORES)


class NP1(unittest.TestCase):
    def test_identical_content_distinct_publications(self):
        first, second = normalized(day='21'), normalized(day='22')
        self.assertEqual(first.content_key, second.content_key)
        self.assertNotEqual(first.file_key, second.file_key)
        p=o.Projection()
        self.assertEqual([p.apply(first),p.apply(second)],['applied','applied'])
        self.assertEqual(len(p.contents),1)
        self.assertEqual(len(p.files),2)
        self.assertEqual(len(p.publications),2)
        self.assertEqual(next(iter(p.watermarks.values())),second.published_at)
        self.assertEqual(first.rows[0]['item_changed_at'],second.rows[0]['item_changed_at'])
        self.assertFalse(second.rows[0]['comparison_eligible'])
        self.assertEqual(p.apply(second),'duplicate')

    def test_refetch_is_not_new_publication_or_freshness(self):
        raw, source=batch_source()
        first=o.normalize(raw,source,STORES)
        again=o.normalize(raw,replace(source,ingested_at='2026-09-24T00:00:00+00:00',fetched_at='2026-09-23T00:00:00+00:00'),STORES)
        p=o.Projection();p.apply(first)
        self.assertEqual(p.apply(again),'duplicate')
        self.assertEqual(len(p.contents),1)
        self.assertEqual(len(p.observations),1)
        self.assertEqual(next(iter(p.watermarks.values())),first.published_at)

    def test_identical_content_older_publication_retains_provenance_only(self):
        p=o.Projection();latest=normalized(day='22');p.apply(latest)
        self.assertEqual(p.apply(normalized(day='21')),'historical_only')
        self.assertEqual(len(p.files),2)
        self.assertEqual(len(p.contents),1)
        self.assertEqual(next(iter(p.watermarks.values())),latest.published_at)

    def test_corrupt_deflate_has_fixed_error(self):
        raw=bytearray(gzip.compress(b'<Root/>',mtime=0));raw[10]=7
        with self.assertRaisesRegex(o.Rejected,'^INVALID_GZIP_OR_XML$'):
            o.strict_root(bytes(raw))

    def test_real_replay_continues_after_corrupt_deflate(self):
        # Run the actual loop with synthetic files and in-memory I/O substitutes.
        import replay_np1
        name=f'Stores{o.CHAIN}-000-20260921-025.gz'
        xml=f'<Chain><ChainID>{o.CHAIN}</ChainID><LastUpdateDate>2026-09-21</LastUpdateDate><LastUpdateTime>02:52:11</LastUpdateTime><SubChains><SubChain><SubChainID>1</SubChainID><Stores><Store><StoreID>1</StoreID><StoreName>SYNTHETIC</StoreName><StoreType>1</StoreType></Store></Stores></SubChain></SubChains></Chain>'
        store_raw=gzip.compress(xml.encode(),mtime=0)
        good,source=batch_source(day='22')
        bad,bad_source=batch_source(day='21');bad=bytearray(bad);bad[10]=7;bad=bytes(bad)
        files=[{'name':name,'source':'https://pricesprodpublic.blob.core.windows.net/price/'+name,'kind':'Stores','sha256':hashlib.sha256(store_raw).hexdigest()},
               {'name':bad_source.filename,'source':bad_source.url,'kind':'PriceFull','sha256':hashlib.sha256(bad).hexdigest()},
               {'name':source.filename,'source':source.url,'kind':'PriceFull','sha256':source.sha256}]
        contents={name:store_raw,bad_source.filename:bad,source.filename:good}; reports=[]
        with patch.object(Path,'read_text',return_value=json.dumps({'files':files})), \
             patch.object(Path,'read_bytes',lambda p:contents[p.name]), \
             patch.object(Path,'mkdir'), \
             patch.object(Path,'write_text',lambda p,data:reports.append(json.loads(data))), \
             patch.object(socket.socket,'connect',socket.socket.connect), \
             patch.object(socket,'create_connection',socket.create_connection), \
             contextlib.redirect_stdout(io.StringIO()):
            replay_np1.main()
        report=reports[0]
        self.assertEqual([f['status'] for f in report['files']],['normalized','quarantined','normalized'])
        self.assertEqual(report['files'][1]['code'],'INVALID_GZIP_OR_XML')
        self.assertEqual(report['observations'],2)
        self.assertEqual(report['source_files'],2)
        self.assertEqual(report['network_attempts'],0)

    def test_exact_values_and_immutable_batch(self):
        batch = normalized()
        row = batch.rows[0]
        self.assertEqual(row['price'], '10.00')
        self.assertEqual(row['gtin14'], '04006381333931')
        self.assertIsNone(row['currency'])
        row['price'] = '999'
        self.assertEqual(batch.rows[0]['price'], '10.00')

    def test_fail_closed_xml_and_gzip(self):
        for raw in (b'not gzip', gzip.compress(b'<Root><Item></Root>'),
                    gzip.compress(b'<!DOCTYPE Root [<!ENTITY x "1">]><Root>&x;</Root>'),
                    gzip.compress('<Root/>'.encode('utf-16'))):
            with self.subTest(raw=raw[:4]), self.assertRaises(o.Rejected):
                o.strict_root(raw)
        with patch.object(o, 'MAX_XML', 5), self.assertRaises(o.Rejected):
            o.strict_root(gzip.compress(b'<Root>long</Root>'))

    def test_price_nonfinite_negative_zero_and_missing(self):
        for value in ('NaN','Infinity','-1','0','','1e2','1,00'):
            with self.subTest(value=value), self.assertRaises(o.Rejected):
                normalized(body=item(price=value))

    def test_missing_barcode_unknown_store_and_checksum(self):
        with self.assertRaises(o.Rejected): normalized(body=item(code=''))
        raw, source = batch_source()
        with self.assertRaises(o.Rejected): o.normalize(raw, source)
        with self.assertRaises(o.Rejected): o.normalize(raw, replace(source, sha256='0'*64), STORES)

    def test_internal_bad_checksum_and_package_unresolved(self):
        self.assertIsNone(normalized(body=item(ItemType='0')).rows[0]['gtin14'])
        self.assertIsNone(normalized(body=item(code='4006381333932')).rows[0]['gtin14'])
        row = normalized(body=item(QtyInPackage='0')).rows[0]
        self.assertIsNone(row['package']['count'])
        self.assertFalse(row['comparison_eligible'])

    def test_source_ids_distinct_from_gtin(self):
        self.assertEqual(o.source_id('001'), '1')
        self.assertEqual(o.normalized_gtin('04006381333931','1'), '04006381333931')
        raw, source = batch_source()
        renamed = source.filename.replace('-001-001-', '-001-002-')
        with self.assertRaises(o.Rejected):
            o.normalize(raw, replace(source, filename=renamed, url=source.url.replace(source.filename,renamed)), STORES)

    def test_file_and_observation_dedup(self):
        p = o.Projection(); b = normalized()
        self.assertEqual(p.apply(b), 'applied')
        self.assertEqual(p.apply(b), 'duplicate')
        self.assertEqual(len(p.observations), 1)

    def test_repacked_file_same_observation_conflict(self):
        p=o.Projection();b=normalized();p.apply(b)
        with self.assertRaises(o.Rejected): p.apply(replace(b,file_key='different-compression'))
        self.assertEqual(len(p.observations),1)

    def test_old_delta_does_not_override_new_full(self):
        p=o.Projection();p.apply(normalized(day='22'))
        self.assertEqual(p.apply(normalized(kind='Price',body=item(price='1',status='1'))),'historical_only')
        self.assertEqual(next(iter(next(iter(p.current.values())).values()))['price'],'10.00')

    def test_new_delta_and_explicit_removal(self):
        p=o.Projection();p.apply(normalized())
        p.apply(normalized(kind='Price',day='22',body=item(price='11',status='1')), expected_previous=next(iter(p.watermarks.values())))
        self.assertEqual(next(iter(next(iter(p.current.values())).values()))['price'],'11')
        p.apply(normalized(kind='Price',day='22',hour='040000',body=item(price='',status='0')), expected_previous=next(iter(p.watermarks.values())))
        self.assertEqual(sum(len(v) for v in p.current.values()),0)
        self.assertEqual(len(p.observations),3)

    def test_invalid_partial_file_preserves_projection(self):
        p=o.Projection();p.apply(normalized()); before=copy.deepcopy(p.__dict__)
        with self.assertRaises(o.Rejected):
            p.apply(normalized(day='22',body=item()+item(code='123',price='bad')))
        self.assertEqual(p.__dict__,before)

    def test_duplicate_rows_rejected(self):
        with self.assertRaises(o.Rejected): normalized(body=item()+item())

    def test_delta_requires_baseline_and_status(self):
        with self.assertRaises(o.Rejected): o.Projection().apply(normalized(kind='Price',body=item(status='1')))
        with self.assertRaises(o.Rejected): normalized(kind='Price')

    def test_missing_row_in_full_keeps_history(self):
        p=o.Projection();p.apply(normalized(body=item()+item(code='96385074')))
        p.apply(normalized(day='22'))
        self.assertEqual(sum(len(v) for v in p.current.values()),1)
        self.assertEqual(len(p.observations),3)

    def test_timestamp_dst_and_future(self):
        for value in ('nonsense','2026-03-27T02:30:00','2026-10-25T01:30:00'):
            with self.subTest(value=value), self.assertRaises(o.Rejected): o.timestamp(value)
        with self.assertRaises(o.Rejected): normalized(body=item(PriceUpdateTime='2026-09-22T10:00:00'))
        raw,source=batch_source()
        with self.assertRaises(o.Rejected):
            o.normalize(raw,replace(source,ingested_at='2026-09-19T00:00:00+00:00'),STORES)

    def test_provenance_query_rejected(self):
        raw,source=batch_source()
        with self.assertRaises(o.Rejected): o.normalize(raw,replace(source,url=source.url+'?sig=synthetic'),STORES)

    def test_delta_gap_fails_before_mutation(self):
        p=o.Projection();p.apply(normalized()); before=copy.deepcopy(p.__dict__)
        with self.assertRaises(o.Rejected):
            p.apply(normalized(kind='Price',day='22',body=item(status='1')))
        self.assertEqual(p.__dict__,before)

    def test_promotion_conditions_preserved_without_inferred_price(self):
        raw,source=batch_source(kind='PromoFull')
        conditions='<ClubID>7</ClubID><Groups><Group><MinQty>3</MinQty><DiscountedPrice>12.00</DiscountedPrice></Group></Groups>'
        xml=f'<Root><ChainID>{o.CHAIN}</ChainID><SubChainID>1</SubChainID><StoreID>1</StoreID><Promotions><Promotion><PromotionID>SYNTHETIC</PromotionID><PromotionStartDateTime>2026-09-20T00:00:00.000</PromotionStartDateTime><PromotionEndDateTime>2026-09-25T00:00:00.000</PromotionEndDateTime>{conditions}</Promotion></Promotions></Root>'
        raw=gzip.compress(xml.encode()); source=replace(source,sha256=hashlib.sha256(raw).hexdigest())
        row=o.normalize(raw,source,STORES).rows[0]
        self.assertIn(conditions,row['conditions_xml'])
        self.assertEqual(row['eligibility'],'unresolved')
        self.assertIsNone(row['effective_price'])

    def test_store_ids_and_coordinates_not_invented(self):
        name=f'Stores{o.CHAIN}-000-20260921-025.gz'
        xml=f'<Chain><ChainID>{o.CHAIN}</ChainID><LastUpdateDate>2026-09-21</LastUpdateDate><LastUpdateTime>02:52:11</LastUpdateTime><SubChains><SubChain><SubChainID>001</SubChainID><Stores><Store><StoreID>0001</StoreID><StoreName>SYNTHETIC store</StoreName><StoreType>1</StoreType></Store></Stores></SubChain></SubChains></Chain>'
        raw=gzip.compress(xml.encode()); source=o.Source(name,'https://pricesprodpublic.blob.core.windows.net/price/'+name,hashlib.sha256(raw).hexdigest(),'2026-09-22T12:00:00+00:00')
        row=o.normalize(raw,source).rows[0]
        self.assertEqual(row['key'],[o.CHAIN,'1','1'])
        self.assertEqual(row['raw_store'],'0001')
        self.assertIsNone(row['coordinates'])


if __name__ == '__main__':
    unittest.main()
