import unittest,gzip,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('city_qualifier',Path(__file__).with_name('qualify_city.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def feed(**changes):
 fields={'ItemCode':'4006381333931','ItemPrice':'8.25','ItemName':'Synthetic cereal','Quantity':'250.00','UnitQty':'גרם','QtyInPackage':'1','bIsWeighted':'0','PriceUpdateTime':'2026-10-14T10:00:00','ItemType':'1'};fields.update(changes);row='<Item>'+''.join('<'+k+'>'+v+'</'+k+'>'for k,v in fields.items())+'</Item>';return gzip.compress(('<Root><ChainID>7290027600007</ChainID><SubChainID>001</SubChainID><StoreID>104</StoreID><BikoretNo>5</BikoretNo><Items>'+row+'</Items></Root>').encode())
branch={'key':['7290027600007','1','104'],'check':'7'}
class Tests(unittest.TestCase):
 def test_real_schema_fixture_exact_decimals_and_vendor_metadata_preserved(self):
  rows,size,v=m.parse(feed(),branch,10000);self.assertEqual(rows['4006381333931']['priceMinor'],825);self.assertEqual(v['priceVendorCheck'],'5');self.assertEqual(v['directoryVendorCheck'],'7');self.assertIsNone(rows['4006381333931'].get('stock'))
 def test_invalid_price_calendar_or_expansion_rejected(self):
  for b in [feed(ItemPrice='8.251'),feed(ItemPrice='NaN'),feed(PriceUpdateTime='2026-02-30T10:00:00')]:
   with self.assertRaises(ValueError):m.parse(b,branch,10000)
  with self.assertRaises(ValueError):m.parse(feed(),branch,20)
 def test_branch_mismatch_and_duplicate_rejected(self):
  with self.assertRaises(ValueError):m.parse(feed(),{**branch,'key':['7290027600007','7','285']},10000)
  xml=gzip.decompress(feed()).decode();item=xml[xml.index('<Item>'):xml.index('</Item>')+7];raw=gzip.compress(xml.replace('</Items>',item+'</Items>').encode())
  with self.assertRaises(ValueError):m.parse(raw,branch,10000)
 def test_internal_codes_and_zero_prices_never_invent_identity_or_quote(self):
  rows,_,v=m.parse(feed(ItemCode='12345',ItemType='0',ItemPrice='0.00'),branch,10000);self.assertIsNone(rows['12345']['gtin']);self.assertEqual(v['unqualifiedZeroPrices'],1)
if __name__=='__main__':unittest.main()
