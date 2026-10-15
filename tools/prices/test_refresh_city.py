import importlib.util, unittest, tempfile, pathlib, subprocess, gzip, json
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('refresh',pathlib.Path(__file__).with_name('refresh_city.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def test_published_only_and_exact_branch(self):
  good='https://pricesprodpublic.blob.core.windows.net/pricefull/PriceFull7290027600007-001-104-20261015-121701.gz'
  self.assertEqual(m.published(('<a href="'+good+'">price</a>').encode(),'104'),good)
  for u in [good.replace('https:','http:'),good+'?key=private',good.replace('-104-','-285-'),good.replace('pricesprodpublic.blob.core.windows.net','evil.test')]:
   with self.assertRaises(m.Stop):m.published(('<a href="'+u+'">x</a>').encode(),'104')
 def runner(self,status=200,body=b'listing',extra='',code=0):
  def fake(args,**kwargs):
   self.assertIn('--disable',args);self.assertIn('--no-insecure',args);self.assertNotIn('--location',args);self.assertEqual(args[args.index('--retry')+1],'0')
   pathlib.Path(args[args.index('--dump-header')+1]).write_text('HTTP/1.1 '+str(status)+' OK\r\n'+extra+'\r\n')
   pathlib.Path(args[args.index('--output')+1]).write_bytes(body)
   return subprocess.CompletedProcess(args,code,str(status),'SENSITIVE provider prose must not be retained')
  return fake
 def test_transport_failure_counted_and_body_retained_without_error_text(self):
  with tempfile.TemporaryDirectory() as t:
   c=m.Collector(pathlib.Path(t)/'new',self.runner(code=60));
   with self.assertRaisesRegex(m.Stop,'certificate-or-transport-failure'):c.get('https://prices.shufersal.co.il/FileObject/UpdateCategory?catID=5&storeId=0')
   self.assertEqual(c.used,1);self.assertTrue((c.folder/'attempt-1-reserved.json').exists());self.assertEqual((c.folder/'attempt-1.body').read_bytes(),b'listing');self.assertNotIn('SENSITIVE',(c.folder/'attempt-1-result.json').read_text())
 def test_redirects_count_and_bound(self):
  with tempfile.TemporaryDirectory() as t:
   url='https://prices.shufersal.co.il/FileObject/UpdateCategory?catID=5&storeId=0'
   c=m.Collector(pathlib.Path(t)/'new',self.runner(status=302,extra='Location: '+url+'\r\n'))
   with self.assertRaisesRegex(m.Stop,'attempt-limit'):c.get(url)
   self.assertEqual(c.used,8)
 def test_feed_limit_and_unsafe_xml(self):
  with tempfile.TemporaryDirectory() as t:
   c=m.Collector(pathlib.Path(t)/'new',self.runner(body=gzip.compress(b'<!DOCTYPE root><root/>')))
   with self.assertRaisesRegex(m.Stop,'unsafe-xml'):c.get('https://pricesprodpublic.blob.core.windows.net/stores/Stores7290027600007-000-20261015-020.gz',True)
   c.files=3
   with self.assertRaisesRegex(m.Stop,'feed-limit'):c.get('https://pricesprodpublic.blob.core.windows.net/stores/Stores7290027600007-000-20261015-020.gz',True)
 def test_existing_session_never_reused_and_unsafe_sources_never_transmitted(self):
  with tempfile.TemporaryDirectory() as t:
   f=pathlib.Path(t)/'new';c=m.Collector(f,self.runner())
   with self.assertRaises(FileExistsError):m.Collector(f,self.runner())
   with self.assertRaises(m.Stop):c.get('https://example.com/')
   self.assertEqual(c.used,0)
 def test_headers_proxy_and_duplicate(self):
  self.assertEqual(m.headers('HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 200\r\nlast-modified: Thu, 15 Oct 2026 10:00:00 GMT\r\n\r\n')['last-modified'],'Thu, 15 Oct 2026 10:00:00 GMT')
  with self.assertRaises(m.Stop):m.headers('HTTP/2 200\nlocation: a\nlocation: b')
 def test_published_read_only_signature_and_cached_resume(self):
  url='https://pricesprodpublic.blob.core.windows.net/stores/Stores7290027600007-000-20261015-020.gz?sv=2014-02-14&sr=b&sig=AAAAAAAAAAAAAAAAAAAAAAAAAAAA%3D&se=2026-10-15T20%3A30%3A42Z&sp=r'
  self.assertTrue(m.allowed(url));self.assertFalse(m.allowed(url.replace('sp=r','sp=w')))
  self.assertEqual(m.canonical(url),url.split('?')[0])
  with tempfile.TemporaryDirectory() as t:
   c=m.Collector(pathlib.Path(t)/'new',self.runner());c.get('https://prices.shufersal.co.il/FileObject/UpdateCategory?catID=5&storeId=0')
   resumed=m.Collector(c.folder,self.runner(),resume=True);self.assertEqual(resumed.used,1);self.assertEqual(resumed.compressed,len(b'listing'))
 def test_actual_entry_point_help(self):
  r=subprocess.run(['python3',str(pathlib.Path(m.__file__)),'--help'],capture_output=True,text=True);self.assertEqual(r.returncode,0);self.assertIn('--approved-public-refresh',r.stdout)
if __name__=='__main__':unittest.main()
