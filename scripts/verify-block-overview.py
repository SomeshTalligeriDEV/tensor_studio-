"""Verify Etherscan-style real Subtensor block details and every block entry point."""
import json,os
from playwright.sync_api import sync_playwright
base=os.environ.get('SCAN_URL','https://tensorscan.vercel.app')
networks=os.environ.get('SCAN_NETWORKS','finney,test,local').split(',')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel='chrome');page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];results=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 for network in networks:
  print('Checking block overview on '+network,flush=True)
  page.goto(base+'/scan?network='+network,wait_until='domcontentloaded')
  page.wait_for_function('(n)=>window.__tensorChain?.network===n && window.__tensorChain.decoded>0 && window.__tensorChain.blocks>=3',arg=network,timeout=90000)
  row=page.locator('.scan-block-row').first
  href=row.get_attribute('href');row.locator('.scan-feed-main').click()
  page.get_by_role('heading',name='Block details',exact=True).wait_for(timeout=15000)
  page.locator('.scan-definition').wait_for(timeout=15000)
  assert not page.get_by_role('alert').count(),page.get_by_role('alert').all_inner_texts()
  definition=page.locator('.scan-definition')
  for label in ['Encoded block size','Recorded transaction fees','State root','Extrinsics root','Unsigned system calls']:assert label in definition.inner_text()
  assert 'bytes' in definition.inner_text()
  roots=definition.locator('dd').all_inner_texts();assert sum('0x' in value for value in roots)>=4
  page.get_by_role('link',name='Events (').click()
  event=page.locator('.scan-event').first;event.locator('summary').click();assert event.locator('pre').inner_text()
  page.screenshot(path='artifacts/block-overview-'+network+'.png',full_page=True)
  parent=definition.locator('dt').filter(has_text='Parent hash').locator('xpath=following-sibling::dd[1]').locator('a')
  parent.click();page.locator('.scan-definition').wait_for();assert not page.get_by_role('alert').count()
  page.get_by_role('navigation',name='Explorer sections',exact=True).get_by_role('link',name='Overview',exact=True).click()
  page.wait_for_function('window.__tensorChain.decoded>0',timeout=60000)
  chart=page.locator('.scan-activity-plot a').last
  chart.click();page.get_by_role('heading',name='Block details',exact=True).wait_for();page.locator('.scan-definition').wait_for()
  tx=page.locator('#block-extrinsics tbody tr td:first-child a').first
  tx.click();page.get_by_role('heading',name='Transaction details',exact=True).wait_for(timeout=30000);page.locator('.scan-definition').wait_for()
  page.reload();page.get_by_role('heading',name='Transaction details',exact=True).wait_for(timeout=60000)
  page.get_by_role('navigation',name='Explorer sections',exact=True).get_by_role('link',name='Overview',exact=True).click();page.wait_for_function('window.__tensorChain.decoded>0',timeout=60000)
  if network=='local':
   feed=page.locator('.scan-feeds .scan-panel').nth(1)
   feed.locator('.scan-feed-row--transaction').first.wait_for(timeout=30000)
   assert feed.locator('.scan-feed-row--transaction').count()>0
   assert 'Unsigned system call' in feed.inner_text()
  page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.set_viewport_size({'width':1440,'height':1100})
  results.append({'network':network,'block':href,'row_chart_parent_transaction_refresh':True})
 assert not errors,errors
 with open('artifacts/block-overview-verification.json','w') as f:json.dump({'results':results,'errors':errors},f,indent=2)
 print(json.dumps({'results':results,'errors':errors}));browser.close()
