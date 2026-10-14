"""Offline qualifier for a bounded public PriceFull city slice; no network."""
import sys,json,gzip,io,re,hashlib,xml.etree.ElementTree as ET
from pathlib import Path
from decimal import Decimal,InvalidOperation
from datetime import datetime,timezone
from email.utils import parsedate_to_datetime
CHAIN='7290027600007'
def check(ok,code):
 if not ok:raise ValueError(code)
def field(node,name):
 a=[n for n in node if n.tag.lower()==name.lower()];check(len(a)==1,'field-missing-or-duplicate');return(a[0].text or '').strip()
def gtin(s):return bool(re.fullmatch(r'\d{8}|\d{12}|\d{13}',s))and sum(int(c)*(3 if i%2==0 else 1)for i,c in enumerate(reversed(s[:-1])))%10==(-int(s[-1]))%10
def decimal(s):
 check(bool(re.fullmatch(r'\d{1,8}(?:\.\d{1,4})?',s)),'decimal-invalid');return Decimal(s)
def parse(raw,branch,remaining):
 check(raw.startswith(b'\x1f\x8b'),'gzip-required')
 with gzip.GzipFile(fileobj=io.BytesIO(raw))as f:b=f.read(remaining+1)
 check(len(b)<=remaining,'expanded-limit');check(b'<!DOCTYPE'not in b.upper()and b'<!ENTITY'not in b.upper(),'xml-unsafe');r=ET.fromstring(b)
 check(r.tag=='Root','root-invalid');check(field(r,'ChainID')==CHAIN and str(int(field(r,'SubChainID')))==branch['key'][1]and str(int(field(r,'StoreID')))==branch['key'][2],'branch-linkage-invalid')
 check(bool(re.fullmatch(r'\d{1,6}',field(r,'BikoretNo'))),'vendor-check-invalid')
 rows={};unqualified=0
 for n in r.findall('./Items/Item'):
  code=field(n,'ItemCode');check(bool(re.fullmatch(r'\d{1,32}',code))and code not in rows,'item-id-invalid-or-duplicate');price=decimal(field(n,'ItemPrice'));check(price*100==(price*100).to_integral()and price<=1000000,'price-invalid');name=field(n,'ItemName');check(0<len(name)<=160,'label-invalid')
  qty=decimal(field(n,'Quantity'));unit=field(n,'UnitQty');count=field(n,'QtyInPackage');weight=field(n,'bIsWeighted');update=field(n,'PriceUpdateTime');check(bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}',update)),'item-update-invalid');datetime.fromisoformat(update)
  row={'code':code,'label':name,'priceMinor':int(price*100),'quantityRaw':str(qty),'unitRaw':unit,'countRaw':count,'weightedRaw':weight,'updatedRaw':update,'gtin':code if field(n,'ItemType')=='1'and gtin(code)else None}
  rows[code]=row
  if price<=0:unqualified+=1
 return rows,len(b),{'priceVendorCheck':field(r,'BikoretNo'),'directoryVendorCheck':branch['check'],'unqualifiedZeroPrices':unqualified}
def iso(d):return d.astimezone(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def main(folder,out):
 f=Path(folder);directory=json.loads((f/'branches.json').read_text());products={};publications=[];prices=[];updates=[];stats=[];remaining=200000000-json.loads((f/'ledger.json').read_text())['priorExpandedReserve']-92928
 for branch in directory['branches']:
  sid=branch['key'][2];m=json.loads((f/('price-'+sid+'-result.json')).read_text());raw=(f/m['name']).read_bytes();check(hashlib.sha256(raw).hexdigest()==m['sha256'],'hash-invalid');rows,size,vendor=parse(raw,branch,remaining);remaining-=size
  published=parsedate_to_datetime(m['lastModified']);fetched=datetime.fromisoformat(m['fetchedAt'].replace('Z','+00:00'));now=datetime.now(timezone.utc);check(published<=fetched<=now and(now-published).total_seconds()<=86400,'publication-stale');check(m['publicationRaw'][:8]==published.strftime('%Y%m%d'),'publication-date-conflict')
  storeId='shufersal-'+sid;publications.append({'storeId':storeId,'address':branch['address'],'cityCode':branch['city'],'directoryName':branch['name'],'source':m['source'],'hash':m['sha256'],'publishedAt':iso(published),'fetchedAt':m['fetchedAt'],'filenamePublicationRaw':m['publicationRaw']})
  stats.append({'storeId':sid,'sourceRows':len(rows),'expandedBytes':size,**vendor})
  chosen={code:row for code,row in rows.items()if 'מונסטר'in row['label']and row['gtin']and row['weightedRaw']=='0'and row['unitRaw']=='מיליליטר'and row['quantityRaw']=='500.00'and row['countRaw']=='1'and row['priceMinor']>0}
  products[storeId]=chosen
 common=set.intersection(*(set(v)for v in products.values()));catalog=[]
 for code in sorted(common):
  observed=[v[code]for v in products.values()];check(len({(x['label'],x['quantityRaw'],x['unitRaw'],x['countRaw'])for x in observed})==1,'product-identity-conflict');row=observed[0];pid='shufersal-'+code
  catalog.append({'id':pid,'label':{'en':row['label'],'he':row['label']},'brand':'מונסטר','variant':row['label'],'package':{'quantity':500,'unit':'ml','count':1},'gtin':code})
  for storeId,v in products.items():prices.append({'storeId':storeId,'productId':pid,'unitMinor':v[code]['priceMinor'],'basis':'package'});updates.append({'storeId':storeId,'productId':pid,'updatedRaw':v[code]['updatedRaw']})
 check(bool(catalog),'no-common-qualified-products')
 snap={'version':1,'classification':'qualified','source':{'id':'shufersal-city-20261014','label':'Shufersal public PriceFull','hash':hashlib.sha256(''.join(p['hash']for p in publications).encode()).hexdigest(),'publishedAt':min(p['publishedAt']for p in publications),'fetchedAt':max(p['fetchedAt']for p in publications),'currency':'ILS','currencyEvidence':'2015 regulator ItemPrice / shekels-agorot mapping','coverage':'partial'},'products':catalog,'stores':[{'id':'shufersal-'+b['key'][2],'retailerId':CHAIN,'label':{'en':b['name'],'he':b['name']},'coordinates':None,'coordinateEvidence':None}for b in directory['branches']],'prices':prices}
 result={'version':1,'city':{'en':'Petah Tikva','he':'פתח תקווה'},'directoryHash':directory['directoryHash'],'cityEvidence':directory['cityEvidence'],'snapshot':snap,'publications':publications,'itemUpdates':updates,'catalogScope':'Shared explicitly packaged Monster 500 ml products only'}
 Path(out).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');(f/'qualification.json').write_text(json.dumps({'classification':'city-qualified','coordinateQualification':'deferred','catalogProducts':len(catalog),'stats':stats,'publicationClock':'publisher HTTP Last-Modified UTC; filename/item local times preserved raw','vendorCheckPolicy':'BikoretNo numeric vendor metadata preserved; identity is exact Chain/SubChain/Store plus filename and directory, not vendor check value'},ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':
 try:main(sys.argv[1],sys.argv[2]);print(json.dumps({'status':'qualified'}))
 except (ValueError,KeyError,ET.ParseError,InvalidOperation,OSError):print(json.dumps({'status':'unqualified','reason':'source-validation-failed'}));sys.exit(1)
