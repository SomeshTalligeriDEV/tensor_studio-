import json,os
from playwright.sync_api import sync_playwright
base=os.environ.get('SCAN_URL','http://localhost:10000')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel='chrome');page=browser.new_page(viewport={'width':1440,'height':1100});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'/scan?network=local',wait_until='domcontentloaded')
 page.wait_for_function('window.__tensorChain?.network==="local" && window.__tensorChain.decoded>0 && window.__tensorChain.blocks>=3',timeout=90000)
 evidence=page.get_by_label('Transaction feed source',exact=True)
 evidence.get_by_text('No signed transactions in these blocks',exact=True).wait_for()
 before=page.evaluate('window.__tensorChain')
 counts=evidence.locator('.scan-tx-counts dd').all_inner_texts();assert all(int(v.replace(',',''))>0 for v in counts),counts
 evidence.get_by_text('Inspect data source',exact=True).click()
 assert 'wss://tensorscan-localnet-' in evidence.inner_text()
 assert before['genesis'] in evidence.inner_text()
 assert 'recent observed window, not lifetime activity' in evidence.inner_text()
 page.wait_for_function('(height)=>window.__tensorChain.decoded>height',arg=before['decoded'],timeout=60000)
 after=page.evaluate('window.__tensorChain')
 evidence.scroll_into_view_if_needed();page.screenshot(path='artifacts/transaction-source-desktop.png',full_page=True)
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'mobile overflow'
 page.screenshot(path='artifacts/transaction-source-mobile.png',full_page=True)
 page.goto(base+'/scan/transactions?network=local',wait_until='domcontentloaded')
 page.get_by_label('Transaction feed source',exact=True).wait_for(timeout=30000)
 assert not errors,errors
 print(json.dumps({'before':before,'after':after,'observed_blocks_unsigned_calls_events':counts,'source_visible':True,'page_errors':errors,'mobile_overflow':False}));browser.close()
