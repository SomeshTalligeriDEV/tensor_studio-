"""Real chain link, detail, search, icon, theme and responsive acceptance."""
import json,os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=os.environ.get('SCAN_URL','http://localhost:10000')
networks=os.environ.get('SCAN_NETWORKS','finney,test,local').split(',')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel='chrome');page=browser.new_page(viewport={'width':1600,'height':1100});errors=[];records=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 for network in networks:
  print('Verifying '+network,flush=True)
  page.goto(base+'/scan?network='+network,wait_until='domcontentloaded')
  page.wait_for_function('(network)=>window.__tensorChain?.network===network && window.__tensorChain.decoded>0 && window.__tensorChain.blocks>=3',arg=network,timeout=90000)
  if network=='local':
   page.wait_for_function('document.querySelector(".scan-index-status progress")?.value>0',timeout=60000)
   assert page.get_by_role('button',name='Chain events',exact=True).get_attribute('aria-pressed')=='true'
  before=page.evaluate('window.__tensorChain')
  assert page.locator('html').get_attribute('data-theme')=='dark'
  assert not page.locator('a[href*="taostats.io"]').count()
  icon=page.locator('.scan-search>.rune-icon')
  assert '/icons/rune/search.svg' in icon.evaluate('(e)=>getComputedStyle(e).maskImage')
  page.wait_for_function('(height)=>window.__tensorChain.decoded>height',arg=before['decoded'],timeout=60000)
  page.screenshot(path='artifacts/scan-polish-'+network+'.png',full_page=True)
  first=page.locator('.scan-block-row').first
  href=first.get_attribute('href');assert href.startswith('/scan/block/') and 'network='+network in href,href
  first.click()
  page.get_by_role('heading',name='Block details',exact=True).wait_for(timeout=30000)
  page.locator('.scan-definition').wait_for(timeout=45000)
  assert urlparse(page.url).netloc==urlparse(base).netloc
  assert not page.get_by_role('alert').count(),page.get_by_role('alert').all_inner_texts()
  block_url=page.url
  tx=page.locator('.scan-detail .scan-table-wrap tbody tr td:first-child a').first
  txhref=tx.get_attribute('href');assert '/scan/extrinsic/' in txhref and 'network='+network in txhref
  tx.click();page.get_by_role('heading',name='Transaction details',exact=True).wait_for(timeout=30000)
  page.locator('.scan-definition').wait_for();assert not page.get_by_role('alert').count(),page.get_by_role('alert').all_inner_texts()
  transaction_url=page.url
  print(network+' block and transaction links loaded internally',flush=True)
  page.reload(wait_until='domcontentloaded');page.get_by_role('heading',name='Transaction details',exact=True).wait_for(timeout=60000)
  records.append({'network':network,'before':before,'block_url':block_url,'transaction_url':transaction_url,'refresh':True})
  page.get_by_role('navigation',name='Explorer sections',exact=True).get_by_role('link',name='Overview',exact=True).click()
  page.wait_for_function('window.__tensorChain.decoded>0',timeout=60000)
  if network=='test':
   field=page.get_by_label('Search blocks, transactions, accounts or subnets',exact=True)
   field.fill(str(before['decoded']));page.get_by_role('button',name='Search',exact=True).click()
   page.get_by_role('heading',name='Block details',exact=True).wait_for(timeout=30000);page.locator('.scan-definition').wait_for(timeout=30000)
   assert not page.get_by_role('alert').count()
   page.get_by_role('navigation',name='Explorer sections',exact=True).get_by_role('link',name='Overview',exact=True).click()
  if network==networks[-1]:
   page.set_viewport_size({'width':390,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'mobile overflow'
   page.screenshot(path='artifacts/scan-polish-mobile.png',full_page=True)
   page.get_by_label('Toggle color theme',exact=True).click()
   page.wait_for_function('document.documentElement.dataset.theme==="light"')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.screenshot(path='artifacts/scan-polish-light-mobile.png',full_page=True)
   page.get_by_label('Toggle color theme',exact=True).click()
 assert not errors,errors
 print(json.dumps({'records':records,'page_errors':errors,'mobile_overflow':False}))
 with open('artifacts/scan-polish-verification.json','w') as f:json.dump({'records':records,'page_errors':errors,'mobile_overflow':False},f,indent=2)
 browser.close()
